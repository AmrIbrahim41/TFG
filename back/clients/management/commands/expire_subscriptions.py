# yourapp/management/commands/expire_subscriptions.py
#
# Place this file at:
#   <your_app>/management/__init__.py        (empty file, if not already present)
#   <your_app>/management/commands/__init__.py  (empty file, if not already present)
#   <your_app>/management/commands/expire_subscriptions.py  ← this file
#
# Run manually:
#   python manage.py expire_subscriptions
#
# Schedule via cron (recommended — runs daily at midnight):
#   0 0 * * * /path/to/venv/bin/python /path/to/manage.py expire_subscriptions >> /var/log/expire_subs.log 2>&1
#
# Or with Celery Beat — see the block at the bottom of this file.

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

# FIX #19: المسار السابق كان مُشفَّراً كـ 'clients.models' مما يجعل الأمر
# يفشل مباشرةً لو تغيّر اسم الـ app أو نُقل المشروع.
# الحل: نستخدم اسم الـ app من إعدادات Django ديناميكياً بدلاً من تثبيته.
# إذا كنت تريد قيمة ثابتة، عدّل السطر التالي ليطابق اسم الـ app الفعلي.
#
# للتشغيل اليدوي:
#   python manage.py expire_subscriptions
#
# إذا تغيّر اسم الـ app، عدّل APP_LABEL أدناه فقط بدلاً من البحث في الكود.

APP_LABEL = 'clients'  # ← عدّل هذا السطر فقط لو غيّرت اسم الـ app

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
        "Deactivate all ClientSubscriptions whose end_date is strictly in the past. "
        "Intended to be run nightly via cron or Celery Beat."
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

        # Only target subscriptions that are:
        #   - Still marked active (is_active=True)
        #   - Past their end_date (end_date < today)
        #
        # Subscriptions with end_date=NULL are unlimited-duration plans and
        # are intentionally excluded.
        expired_qs = ClientSubscription.objects.filter(
            is_active=True,
            end_date__lt=today,
        )

        count = expired_qs.count()

        if count == 0:
            self.stdout.write(
                self.style.SUCCESS(f"[{today}] No expired subscriptions found. Nothing to do.")
            )
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[{today}] DRY RUN: {count} subscription(s) would be deactivated."
                )
            )
            # Print details of what would change so the operator can verify
            for sub in expired_qs.select_related('client', 'plan')[:20]:
                self.stdout.write(
                    f"  → ID {sub.id} | Client: {sub.client.name} | "
                    f"Plan: {sub.plan.name if sub.plan else 'None'} | "
                    f"End date: {sub.end_date}"
                )
            if count > 20:
                self.stdout.write(f"  ... and {count - 20} more.")
            return

        # Use a single bulk UPDATE rather than fetching each object and
        # calling .save() individually. This is far more efficient:
        #   - 1 SQL query regardless of how many subscriptions have expired.
        #   - No Django signal overhead per row (acceptable here since
        #     expiration is a batch maintenance task, not a user-facing event).
        #   - Wrapped in a transaction for atomicity.
        #
        # FIX: Capture the integer returned by .update() — it reflects the
        # actual rows affected inside the transaction, not the pre-transaction
        # count. If a subscription is created or reactivated in the milliseconds
        # between expired_qs.count() and expired_qs.update(), {count} would be
        # wrong. {updated_count} is always accurate.
        with transaction.atomic():
            updated_count = expired_qs.update(is_active=False)

        self.stdout.write(
            self.style.SUCCESS(
                f"[{today}] Successfully deactivated {updated_count} expired subscription(s)."
            )
        )


# ---------------------------------------------------------------------------
# OPTIONAL: Celery Beat integration
# ---------------------------------------------------------------------------
# If your project already uses Celery, you can schedule this command as a
# periodic task instead of (or in addition to) a cron entry.
#
# Step 1 — Create a thin Celery task in yourapp/tasks.py:
#
#   from celery import shared_task
#   from django.core.management import call_command
#
#   @shared_task(name='yourapp.expire_subscriptions')
#   def expire_subscriptions_task():
#       call_command('expire_subscriptions')
#
# Step 2 — Register the schedule in settings.py (or celeryconfig.py):
#
#   from celery.schedules import crontab
#
#   CELERY_BEAT_SCHEDULE = {
#       'expire-subscriptions-daily': {
#           'task': 'yourapp.expire_subscriptions',
#           'schedule': crontab(hour=0, minute=5),  # 00:05 every day
#       },
#   }
#
# Step 3 — Make sure Celery Beat is running alongside your worker:
#   celery -A yourproject beat -l info
# ---------------------------------------------------------------------------