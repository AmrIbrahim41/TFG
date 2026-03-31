from django.db import models
from django.contrib.auth.models import User

from .client import Client
from .subscription import ClientSubscription


# ---------------------------------------------------------------------------
# SESSION TRANSFER
# ---------------------------------------------------------------------------

class SessionTransferRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    from_trainer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_transfers')
    to_trainer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_transfers')
    subscription = models.ForeignKey(
        ClientSubscription, on_delete=models.CASCADE, related_name='transfer_requests'
    )
    sessions_count = models.IntegerField(help_text="How many sessions to transfer")
    schedule_notes = models.TextField(help_text="Days and times (e.g., Mon 5PM, Wed 3PM)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.from_trainer} -> {self.to_trainer}: {self.subscription.client.name}"


# ---------------------------------------------------------------------------
# MANUAL SAVES (offline calculator outputs)
# ---------------------------------------------------------------------------

class ManualNutritionSave(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='manual_nutrition_saves')
    client_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=50, blank=True, null=True, help_text="Internal ID, not printed")
    plan_name = models.CharField(max_length=200, default="My Plan")
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.client_name} - {self.plan_name}"


class ManualWorkoutSave(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='manual_workout_saves')
    client_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=50, blank=True, null=True, help_text="Internal ID, not printed")
    session_name = models.CharField(max_length=200, default="Workout")
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.client_name} - {self.session_name}"
