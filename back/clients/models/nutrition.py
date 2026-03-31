from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

from .subscription import ClientSubscription


# ---------------------------------------------------------------------------
# FOOD DATABASE
# ---------------------------------------------------------------------------

class FoodDatabase(models.Model):
    name = models.CharField(max_length=200, unique=True)
    arabic_name = models.CharField(max_length=200, blank=True, null=True, help_text="Name in Arabic")
    category = models.CharField(max_length=50)

    calories_per_100g = models.IntegerField()
    protein_per_100g = models.FloatField()
    carbs_per_100g = models.FloatField()
    fats_per_100g = models.FloatField()
    fiber_per_100g = models.FloatField(default=0.0)
    serving_unit = models.CharField(max_length=50, default="g", help_text="e.g. 'slice', 'egg', 'scoop'")
    grams_per_serving = models.FloatField(default=100.0, help_text="Weight of one serving in grams")
    common_serving_size = models.FloatField(default=100, help_text="Common serving in grams")

    is_verified = models.BooleanField(default=False, help_text="Verified nutritional data")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']
        verbose_name_plural = "Food Database"


# ---------------------------------------------------------------------------
# NUTRITION PLAN & MEALS
# ---------------------------------------------------------------------------

class NutritionPlan(models.Model):
    subscription = models.ForeignKey(
        ClientSubscription, on_delete=models.CASCADE, related_name='nutrition_plans'
    )
    name = models.CharField(max_length=200, default="Nutrition Plan")
    duration_weeks = models.IntegerField(default=1, help_text="How many weeks is this plan for?")

    calc_gender = models.CharField(max_length=10, default='male')
    calc_age = models.IntegerField(default=25)
    calc_height = models.FloatField(default=170.0, help_text="Height in cm")
    calc_weight = models.FloatField(default=70.0, help_text="Weight in kg")
    calc_activity_level = models.CharField(max_length=50, default='moderate')
    calc_tdee = models.IntegerField(default=2000, help_text="Calculated TDEE")
    calc_defer_cal = models.IntegerField(default=500, help_text="Calorie deficit/surplus")
    calc_fat_percent = models.FloatField(default=25.0, help_text="Fat percentage target")
    calc_protein_multiplier = models.FloatField(default=2.0, help_text="Protein multiplier")
    calc_protein_advance = models.IntegerField(default=0, help_text="Additional protein adjustment")
    calc_meals = models.IntegerField(default=3)
    calc_snacks = models.IntegerField(default=2)
    calc_carb_adjustment = models.CharField(max_length=50, default='moderate')

    pdf_brand_text = models.CharField(
        max_length=255, blank=True, null=True, help_text="Custom branding text for PDF export"
    )

    target_calories = models.IntegerField(default=2000)
    target_protein = models.FloatField(default=150.0)
    target_carbs = models.FloatField(default=200.0)
    target_fats = models.FloatField(default=60.0)

    notes = models.TextField(
        blank=True,
        default='',
        help_text="Coach notes, supplement recommendations, grocery list, etc."
    )

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.subscription.client.name} - {self.name}"

    class Meta:
        ordering = ['-created_at']


class MealPlan(models.Model):
    nutrition_plan = models.ForeignKey(
        NutritionPlan, on_delete=models.CASCADE, related_name='meal_plans'
    )
    day = models.IntegerField(help_text="Day number (1-7 or 1-14...)")

    MEAL_CHOICES = [
        ('breakfast', 'Breakfast'),
        ('snack_1', 'Snack 1'),
        ('lunch', 'Lunch'),
        ('snack_2', 'Snack 2'),
        ('dinner', 'Dinner'),
        ('snack_3', 'Snack 3'),
    ]

    MEAL_TYPE_ORDER = {
        'breakfast': 1,
        'snack_1':   2,
        'lunch':     3,
        'snack_2':   4,
        'dinner':    5,
        'snack_3':   6,
    }

    meal_type = models.CharField(max_length=20, choices=MEAL_CHOICES)
    meal_name = models.CharField(max_length=200, blank=True, null=True, help_text="Optional name")
    meal_time = models.TimeField(blank=True, null=True, help_text="Suggested time")

    order = models.PositiveSmallIntegerField(
        default=0,
        help_text="Chronological order within a day (auto-set from meal_type).",
        db_index=True,
    )

    total_calories = models.IntegerField(default=0)
    total_protein = models.FloatField(default=0.0)
    total_carbs = models.FloatField(default=0.0)
    total_fats = models.FloatField(default=0.0)

    notes = models.TextField(blank=True)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(blank=True, null=True)
    photo = models.ImageField(upload_to='meal_photos/', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.order = self.MEAL_TYPE_ORDER.get(self.meal_type, 99)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Day {self.day} - {self.get_meal_type_display()}"

    class Meta:
        ordering = ['day', 'order']


class FoodItem(models.Model):
    meal_plan = models.ForeignKey(MealPlan, on_delete=models.CASCADE, related_name='foods')
    name = models.CharField(max_length=200)
    amount = models.FloatField(default=0.0, help_text="Amount in grams or pieces")
    unit = models.CharField(max_length=50, default="g", help_text="e.g. 'g', 'slice', 'egg'")
    calories = models.IntegerField(default=0)
    protein = models.FloatField(default=0.0)
    carbs = models.FloatField(default=0.0)
    fats = models.FloatField(default=0.0)
    order = models.IntegerField(default=1, help_text="Order within the meal")

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.name} ({self.amount}{self.unit})"


class NutritionProgress(models.Model):
    nutrition_plan = models.ForeignKey(
        NutritionPlan, on_delete=models.CASCADE, related_name='progress_logs'
    )
    date = models.DateField(default=timezone.now)

    actual_calories = models.IntegerField(default=0)
    actual_protein = models.FloatField(default=0.0)
    actual_carbs = models.FloatField(default=0.0)
    actual_fats = models.FloatField(default=0.0)
    actual_water = models.FloatField(default=0.0, help_text="Water intake in liters")

    weight = models.FloatField(blank=True, null=True, help_text="Body weight in kg")
    body_fat = models.FloatField(blank=True, null=True, help_text="Body fat percentage")

    meals_completed = models.IntegerField(default=0, help_text="Number of meals completed")
    compliance_percentage = models.IntegerField(default=0, help_text="Overall compliance %")

    notes = models.TextField(blank=True)
    mood = models.CharField(max_length=50, blank=True, help_text="How client felt today")
    energy_level = models.IntegerField(default=5, help_text="Energy level 1-10")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nutrition_plan.subscription.client.name} - {self.date}"

    class Meta:
        ordering = ['-date']
        unique_together = ['nutrition_plan', 'date']
