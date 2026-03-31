from django.db import models
from django.utils import timezone


class Client(models.Model):
    name = models.CharField(max_length=255)
    manual_id = models.CharField(max_length=50, unique=True)
    phone = models.CharField(max_length=20)
    photo = models.ImageField(upload_to='client_photos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    nature_of_work = models.CharField(max_length=255, blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50, default='Active', help_text="Active, Inactive, Injured, etc.")
    smoking = models.BooleanField(default=False, help_text="Is the client a smoker?")
    sleep_hours = models.FloatField(blank=True, null=True, help_text="Average hours of sleep")

    is_child = models.BooleanField(default=False, help_text="Distinguish between adult clients and children")
    parent_phone = models.CharField(max_length=20, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    country = models.CharField(max_length=50, default='Egypt', blank=True)
    trained_gym_before = models.BooleanField(default=False)
    trained_coach_before = models.BooleanField(default=False)
    injuries = models.TextField(blank=True, null=True, help_text="Injuries or Surgeries history")

    def __str__(self):
        return self.name

    @property
    def age(self):
        if self.birth_date:
            today = timezone.now().date()
            return (
                today.year
                - self.birth_date.year
                - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
            )
        return None


class Country(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=5, unique=True)
    dial_code = models.CharField(max_length=10)

    def __str__(self):
        return f"{self.name} ({self.dial_code})"
