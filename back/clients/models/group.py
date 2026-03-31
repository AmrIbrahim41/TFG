from django.db import models, transaction
from django.contrib.auth.models import User
from django.utils import timezone

from .client import Client
from .subscription import ClientSubscription


# ---------------------------------------------------------------------------
# EXERCISE CATEGORY CHOICES (shared constants)
# ---------------------------------------------------------------------------

EXERCISE_CATEGORY_WEIGHT = 'weight'
EXERCISE_CATEGORY_REPS   = 'reps'
EXERCISE_CATEGORY_TIME   = 'time'

EXERCISE_CATEGORY_CHOICES = [
    (EXERCISE_CATEGORY_WEIGHT, 'Weight / وزن'),
    (EXERCISE_CATEGORY_REPS,   'Reps / عدات'),
    (EXERCISE_CATEGORY_TIME,   'Time / وقت'),
]


# ---------------------------------------------------------------------------
# COACH SCHEDULE (children group scheduling)
# ---------------------------------------------------------------------------

class CoachSchedule(models.Model):
    coach = models.ForeignKey(User, on_delete=models.CASCADE, related_name='schedules')
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='scheduled_days')
    day = models.CharField(max_length=15)
    session_time = models.TimeField(blank=True, null=True, help_text="Scheduled time for this group session")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('coach', 'client', 'day')

    def __str__(self):
        time_str = self.session_time.strftime('%H:%M') if self.session_time else 'No time set'
        return f"{self.coach.first_name} - {self.day} at {time_str}"


# ---------------------------------------------------------------------------
# GROUP SESSION LOG & PARTICIPANTS
# ---------------------------------------------------------------------------

class GroupSessionLog(models.Model):
    coach = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    date = models.DateTimeField(default=timezone.now, db_index=True)
    day_name = models.CharField(max_length=20)
    exercises_summary = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.day_name} - {self.date.date()}"


class GroupSessionParticipant(models.Model):
    session = models.ForeignKey(GroupSessionLog, on_delete=models.CASCADE, related_name='participants')
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True)
    note = models.CharField(max_length=255, blank=True)
    deducted = models.BooleanField(default=False, db_index=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        previously_deducted = False

        if not is_new:
            try:
                previously_deducted = (
                    GroupSessionParticipant.objects
                    .values_list('deducted', flat=True)
                    .get(pk=self.pk)
                )
            except GroupSessionParticipant.DoesNotExist:
                is_new = True

        super().save(*args, **kwargs)

        should_deduct = self.deducted and (is_new or not previously_deducted)
        if not (should_deduct and self.client_id):
            return

        with transaction.atomic():
            active_sub = (
                ClientSubscription.objects
                .select_for_update()
                .filter(client_id=self.client_id, is_active=True)
                .select_related('plan')
                .first()
            )
            if active_sub is None:
                return

            ClientSubscription.objects.filter(pk=active_sub.pk).update(
                sessions_used=models.F('sessions_used') + 1
            )
            active_sub.refresh_from_db(fields=['sessions_used'])

            if active_sub.plan and active_sub.sessions_used >= active_sub.plan.units:
                active_sub.is_active = False
                active_sub.save(update_fields=['is_active'])

    def __str__(self):
        return f"{self.client.name if self.client else 'Unknown'} in {self.session}"


# ---------------------------------------------------------------------------
# GROUP WORKOUT TEMPLATE
# ---------------------------------------------------------------------------

class GroupWorkoutTemplate(models.Model):
    name = models.CharField(max_length=200)
    exercises = models.JSONField(default=list)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
