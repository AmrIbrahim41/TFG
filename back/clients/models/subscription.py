from datetime import timedelta

from django.db import models, transaction
from django.contrib.auth.models import User
from django.utils import timezone

from .client import Client


class Subscription(models.Model):
    name = models.CharField(max_length=100, blank=True, default="")
    units = models.IntegerField(help_text="Number of sessions/visits")
    duration_days = models.IntegerField(help_text="Duration in days (e.g. 30 for 1 month)")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_child_plan = models.BooleanField(default=False, help_text="Is this package for children?")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.units} units)"


class ClientSubscription(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(Subscription, on_delete=models.SET_NULL, null=True)
    trainer = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, db_index=True
    )
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField(blank=True, null=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    sessions_used = models.IntegerField(default=0, help_text="Number of sessions attended")

    inbody_height = models.FloatField(default=0.0)
    inbody_weight = models.FloatField(default=0.0)
    inbody_muscle = models.FloatField(default=0.0)
    inbody_fat = models.FloatField(default=0.0)
    inbody_tbw = models.FloatField(default=0.0)

    GOAL_CHOICES = [
        ('Weight Loss', 'Weight Loss'),
        ('Bulking', 'Bulking'),
        ('Cutting', 'Cutting'),
        ('Maintenance', 'Maintenance'),
    ]
    inbody_goal = models.CharField(max_length=50, choices=GOAL_CHOICES, blank=True, default='Weight Loss')

    ACTIVITY_CHOICES = [
        ('Light', 'Light'),
        ('Moderate', 'Moderate'),
        ('High', 'High'),
    ]
    inbody_activity = models.CharField(max_length=50, choices=ACTIVITY_CHOICES, blank=True, default='Moderate')
    inbody_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['trainer', 'is_active'], name='idx_sub_trainer_active'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['client'],
                condition=models.Q(is_active=True),
                name='unique_active_subscription_per_client',
            )
        ]

    def save(self, *args, **kwargs):
        if hasattr(self.start_date, 'date'):
            self.start_date = self.start_date.date()

        if not self.end_date and self.plan:
            self.end_date = self.start_date + timedelta(days=self.plan.duration_days)

        if hasattr(self.end_date, 'date'):
            self.end_date = self.end_date.date()

        if self.is_active and self.end_date and self.end_date < timezone.now().date():
            self.is_active = False

        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return bool(self.end_date and self.end_date < timezone.now().date())

    @property
    def progress_percentage(self):
        if not self.plan or self.plan.units == 0:
            return 0
        raw = int((self.sessions_used / self.plan.units) * 100)
        return min(raw, 100)

    def __str__(self):
        return f"{self.client.name} - {self.plan.name if self.plan else 'Unknown'}"
