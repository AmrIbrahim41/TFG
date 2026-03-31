from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

from .subscription import ClientSubscription


# ---------------------------------------------------------------------------
# TRAINING PLAN & STRUCTURE
# ---------------------------------------------------------------------------

class TrainingPlan(models.Model):
    subscription = models.OneToOneField(
        ClientSubscription, on_delete=models.CASCADE, related_name='training_plan'
    )
    cycle_length = models.IntegerField(help_text="How many days in a split? (e.g. 3 for PPL)")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Plan for {self.subscription}"


class TrainingDaySplit(models.Model):
    plan = models.ForeignKey(TrainingPlan, on_delete=models.CASCADE, related_name='splits')
    order = models.IntegerField(help_text="Day 1, Day 2, etc.")
    name = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.order}: {self.name}"


# ---------------------------------------------------------------------------
# SESSION LOG (legacy)
# ---------------------------------------------------------------------------

class SessionLog(models.Model):
    subscription = models.ForeignKey(
        ClientSubscription, on_delete=models.CASCADE, related_name='logs'
    )
    session_number = models.IntegerField()
    split = models.ForeignKey(
        TrainingDaySplit, on_delete=models.SET_NULL, null=True
    )
    date_completed = models.DateField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('subscription', 'session_number')


# ---------------------------------------------------------------------------
# TRAINING EXERCISE TEMPLATE (plan-level)
# ---------------------------------------------------------------------------

class TrainingExercise(models.Model):
    split = models.ForeignKey(TrainingDaySplit, on_delete=models.CASCADE, related_name='exercises')
    order = models.IntegerField(default=1)
    name = models.CharField(max_length=200)
    note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ['order']


class TrainingSet(models.Model):
    exercise = models.ForeignKey(TrainingExercise, on_delete=models.CASCADE, related_name='sets')
    order = models.IntegerField(default=1)
    reps = models.CharField(max_length=50, blank=True)
    weight = models.CharField(max_length=50, blank=True)

    TECHNIQUE_CHOICES = [
        ('Regular', 'Regular'), ('Drop Set', 'Drop Set'), ('Super Set', 'Super Set'),
        ('Pyramid', 'Pyramid'), ('Negative', 'Negative'),
    ]
    technique = models.CharField(max_length=50, choices=TECHNIQUE_CHOICES, default='Regular')

    EQUIPMENT_CHOICES = [
        ('Bodyweight', 'Bodyweight'), ('Dumbbell', 'Dumbbell'), ('Barbell', 'Barbell'),
        ('Cable', 'Cable'), ('Machine', 'Machine'),
    ]
    equipment = models.CharField(max_length=50, choices=EQUIPMENT_CHOICES, blank=True, null=True)

    class Meta:
        ordering = ['order']


# ---------------------------------------------------------------------------
# TRAINING SESSION (authoritative session-completion record)
# ---------------------------------------------------------------------------

class TrainingSession(models.Model):
    subscription = models.ForeignKey(
        ClientSubscription, on_delete=models.CASCADE, related_name='sessions'
    )
    session_number = models.IntegerField()
    name = models.CharField(max_length=100, blank=True, default="")
    date_completed = models.DateField(blank=True, null=True, db_index=True)
    is_completed = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ('subscription', 'session_number')


class SessionExercise(models.Model):
    training_session = models.ForeignKey(
        TrainingSession, on_delete=models.CASCADE, related_name='exercises'
    )
    order = models.IntegerField(default=1)
    name = models.CharField(max_length=200)
    note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ['order']


class SessionSet(models.Model):
    exercise = models.ForeignKey(SessionExercise, on_delete=models.CASCADE, related_name='sets')
    order = models.IntegerField(default=1)
    reps = models.CharField(max_length=50, blank=True)
    weight = models.CharField(max_length=50, blank=True)
    completed = models.BooleanField(default=False)

    TECHNIQUE_CHOICES = [
        ('Regular', 'Regular'), ('Drop Set', 'Drop Set'), ('Super Set', 'Super Set'),
        ('Pyramid', 'Pyramid'), ('Negative', 'Negative'),
    ]
    technique = models.CharField(max_length=50, choices=TECHNIQUE_CHOICES, default='Regular')

    EQUIPMENT_CHOICES = [
        ('Bodyweight', 'Bodyweight'), ('Dumbbell', 'Dumbbell'), ('Barbell', 'Barbell'),
        ('Cable', 'Cable'), ('Machine', 'Machine'),
    ]
    equipment = models.CharField(max_length=50, choices=EQUIPMENT_CHOICES, blank=True, null=True)

    class Meta:
        ordering = ['order']
