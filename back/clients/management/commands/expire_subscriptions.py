# clients/management/commands/expire_subscriptions.py
#
# Run manually:
#   python manage.py expire_subscriptions
#   python manage.py expire_subscriptions --dry-run
#
# Schedule via cron (runs daily at midnight):
#   0 0 * * * /path/to/venv/bin/python /path/to/manage.py expire_subscriptions >> /var/log/expire_subs.log 2>&1
#
# Or with Celery Beat — see the block at the bottom of this file.

from django.core.management.base import BaseCommand
from django.db.models import F
from django.utils import timezone
from django.db import transaction

# APP_LABEL is the only value to change if the app is ever renamed.
APP_LABEL = 'clients'

try:
    from django.apps import apps as django_apps
    ClientSubscription = django_apps.get_model(APP_LABEL, 'ClientSubscription')
except LookupError as exc:
    raise ImportError(
        f"Could not find 'ClientSubscription' in app '{APP_LABEL}'. "
        f"Check APP_LABEL in expire_subscriptions.py. Original error: {exc}"
    )


class Command(BaseCommand):
    help = (
        "Deactivate all ClientSubscriptions that have either:\n"
        "  (a) passed their end_date  — covers ALL clients (adults + children), or\n"
        "  (b) exhausted their session allowance (sessions_used >= plan.units)\n"
        "       — the primary safety net for CHILDREN's subscriptions which are\n"
        "         served exclusively through group sessions.\n\n"
        "Intended to run nightly via cron or Celery Beat."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Preview how many subscriptions would be deactivated without making changes.',
        )

    def handle(self, *args, **options):
        today = timezone.now().date()
        dry_run = options['dry_run']

        # ── Queryset A: date-based expiry ─────────────────────────────────
        # Subscriptions still marked active whose end_date is strictly in the past.
        # Subscriptions with end_date=NULL are unlimited-duration plans and are
        # intentionally excluded.
        # Covers BOTH adult and children subscriptions.
        date_expired_qs = ClientSubscription.objects.filter(
            is_active=True,
            end_date__lt=today,
        )

        # ── Queryset B: session-limit expiry ─────────────────────────────
        # Subscriptions still marked active but whose session allowance is fully
        # consumed (sessions_used >= plan.units).
        #
        # WHY THIS IS CRITICAL FOR CHILDREN:
        # Children train exclusively via GroupSessionLog / GroupSessionParticipant.
        # The real-time deduction in GroupSessionParticipant.save() handles the
        # common case, but edge cases can leave a subscription active even after
        # all sessions are consumed:
        #   • race conditions between two concurrent group-session completions
        #   • manual sessions_used adjustments via the Admin panel or Django shell
        #   • data imports that bypass the model's save() hook
        #   • direct DB writes (e.g. migration scripts, fixtures)
        #
        # This daily catch-all guarantees that no child's subscription stays
        # "active" once all sessions have been used, regardless of how
        # sessions_used reached that value.
        #
        # Adults (individual training via TrainingSession) benefit from this
        # check equally — it is intentionally not restricted to is_child=True.
        session_exhausted_qs = ClientSubscription.objects.filter(
            is_active=True,
            plan__units__gt=0,
            sessions_used__gte=F('plan__units'),
        )

        date_count = date_expired_qs.count()
        session_count = session_exhausted_qs.count()
        total = date_count + session_count

        if total == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f"[{today}] No expired or exhausted subscriptions found. Nothing to do."
                )
            )
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[{today}] DRY RUN — {date_count} date-expired + "
                    f"{session_count} session-exhausted = {total} subscription(s) "
                    f"would be deactivated."
                )
            )
            self._print_preview(date_expired_qs, "DATE-EXPIRED")
            self._print_preview(session_exhausted_qs, "SESSION-EXHAUSTED (includes children)")
            return

        # Use a single bulk UPDATE per queryset wrapped in one atomic transaction.
        # This is O(1) SQL queries regardless of how many rows are affected and
        # avoids loading every object into Python memory.
        with transaction.atomic():
            updated_date = date_expired_qs.update(is_active=False)
            # Re-evaluate after the first update so we don't double-count rows
            # that match both criteria (end_date expired AND sessions exhausted).
            updated_session = session_exhausted_qs.update(is_active=False)

        total_updated = updated_date + updated_session

        self.stdout.write(
            self.style.SUCCESS(
                f"[{today}] Deactivated {updated_date} date-expired "
                f"+ {updated_session} session-exhausted "
                f"= {total_updated} subscription(s) total."
            )
        )

    # ── Private helpers ───────────────────────────────────────────────────

    def _print_preview(self, qs, label: str):
        """Print up to 20 rows of the queryset for dry-run inspection."""
        preview = qs.select_related('client', 'plan')[:20]
        count = qs.count()

        if not count:
            return

        self.stdout.write(f"\n  [{label}] — {count} subscription(s):")
        for sub in preview:
            client_type = "Child" if sub.client.is_child else "Adult"
            self.stdout.write(
                f"    → ID {sub.id:>5} | {client_type:<5} | "
                f"Client: {sub.client.name:<30} | "
                f"Plan: {sub.plan.name if sub.plan else 'None':<20} | "
                f"End date: {sub.end_date} | "
                f"Sessions: {sub.sessions_used}/{sub.plan.units if sub.plan else '∞'}"
            )
        if count > 20:
            self.stdout.write(f"    ... and {count - 20} more.")


# ---------------------------------------------------------------------------
# OPTIONAL: Celery Beat integration
# ---------------------------------------------------------------------------
# Step 1 — Create a thin Celery task in clients/tasks.py:
#
#   from celery import shared_task
#   from django.core.management import call_command
#
#   @shared_task(name='clients.expire_subscriptions')
#   def expire_subscriptions_task():
#       call_command('expire_subscriptions')
#
# Step 2 — Register the schedule in settings.py:
#
#   from celery.schedules import crontab
#   CELERY_BEAT_SCHEDULE = {
#       'expire-subscriptions-daily': {
#           'task': 'clients.expire_subscriptions',
#           'schedule': crontab(hour=0, minute=5),  # 00:05 every day
#       },
#   }
#
# Step 3 — Run Celery Beat alongside your worker:
#   celery -A yourproject beat -l info
# ---------------------------------------------------------------------------
