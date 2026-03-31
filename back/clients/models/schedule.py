from django.db import models
from django.contrib.auth.models import User

from .client import Client
from .subscription import ClientSubscription


class TrainerShift(models.Model):
    """
    Stores the working hours (shift) for a single trainer.
    One-to-one with User so each trainer has exactly one shift record.
    """
    trainer = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='shift',
        help_text="The trainer this shift belongs to."
    )
    shift_start = models.TimeField(
        default='08:00',
        help_text="Start of working day (HH:MM)."
    )
    shift_end = models.TimeField(
        default='20:00',
        help_text="End of working day (HH:MM)."
    )
    slot_duration = models.IntegerField(
        default=60,
        help_text="Duration of each time slot in minutes (e.g. 60 = 1 hour)."
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return (
            f"{self.trainer.first_name or self.trainer.username} — "
            f"{self.shift_start.strftime('%H:%M')} to {self.shift_end.strftime('%H:%M')}"
        )


class TrainerSchedule(models.Model):
    """
    A single booked time slot in a trainer's weekly schedule.

    Business rules enforced at the serializer layer:
      • The linked client must have an is_active=True subscription with ANY trainer.
      • Uniqueness constraint prevents double-booking the same slot for the same trainer.
    """
    DAY_CHOICES = [
        (1, 'Monday'),
        (2, 'Tuesday'),
        (3, 'Wednesday'),
        (4, 'Thursday'),
        (5, 'Friday'),
        (6, 'Saturday'),
        (7, 'Sunday'),
    ]

    trainer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='trainer_schedule_slots',
        help_text="The trainer who owns this slot."
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name='schedule_slots',
        help_text="The client booked into this slot."
    )
    day_of_week = models.IntegerField(
        choices=DAY_CHOICES,
        help_text="Day number: 1=Monday … 7=Sunday."
    )
    time_slot = models.TimeField(
        help_text="Start time of the slot (HH:MM)."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('trainer', 'day_of_week', 'time_slot')
        ordering = ['day_of_week', 'time_slot']
        constraints = [
            models.UniqueConstraint(
                fields=['client', 'day_of_week', 'time_slot'],
                name='unique_client_slot_per_week',
            )
        ]

    def __str__(self):
        day_name = dict(self.DAY_CHOICES).get(self.day_of_week, str(self.day_of_week))
        return (
            f"{self.trainer.first_name or self.trainer.username} — "
            f"{day_name} {self.time_slot.strftime('%H:%M')} → {self.client.name}"
        )
