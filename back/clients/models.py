from django.db import models
from django.conf import settings
from datetime import date,timedelta
from django.utils import timezone
from django.contrib.auth.models import User # Import User

class Client(models.Model):
    name = models.CharField(max_length=255)
    manual_id = models.CharField(max_length=50, unique=True)
    phone = models.CharField(max_length=20)
    photo = models.ImageField(upload_to='client_photos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # --- New Fields ---
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
            today = date.today()
            return today.year - self.birth_date.year - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
        return None

class Country(models.Model):
    name = models.CharField(max_length=100, unique=True) # e.g. Egypt
    code = models.CharField(max_length=5, unique=True)   # e.g. EG
    dial_code = models.CharField(max_length=10)          # e.g. +20

    def __str__(self):
        return f"{self.flag} {self.name} ({self.dial_code})"

class Subscription(models.Model):
    name = models.CharField(max_length=100) # e.g. "Gold Package"
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
    trainer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    sessions_used = models.IntegerField(default=0, help_text="Number of sessions attended")

    # InBody Data (Collapsed for brevity - keep your existing fields here)
    inbody_height = models.FloatField(default=0.0)
    inbody_weight = models.FloatField(default=0.0)
    inbody_muscle = models.FloatField(default=0.0)
    inbody_fat = models.FloatField(default=0.0)
    inbody_tbw = models.FloatField(default=0.0)
    
    GOAL_CHOICES = [('Weight Loss', 'Weight Loss'), ('Bulking', 'Bulking'), ('Cutting', 'Cutting'), ('Maintenance', 'Maintenance')]
    inbody_goal = models.CharField(max_length=50, choices=GOAL_CHOICES, blank=True, default='Weight Loss')
    
    ACTIVITY_CHOICES = [('Light', 'Light'), ('Moderate', 'Moderate'), ('High', 'High')]
    inbody_activity = models.CharField(max_length=50, choices=ACTIVITY_CHOICES, blank=True, default='Moderate')
    inbody_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.end_date and self.plan:
            self.end_date = self.start_date + timedelta(days=self.plan.duration_days)
        super().save(*args, **kwargs)

    @property
    def progress_percentage(self):
        """Helper for the Admin bar"""
        if not self.plan or self.plan.units == 0:
            return 0
        return int((self.sessions_used / self.plan.units) * 100)

    def __str__(self):
        return f"{self.client.name} - {self.plan.name if self.plan else 'Unknown'}"

class TrainingPlan(models.Model):
    # One Plan per Subscription
    subscription = models.OneToOneField(ClientSubscription, on_delete=models.CASCADE, related_name='training_plan')
    cycle_length = models.IntegerField(help_text="How many days in a split? (e.g. 3 for PPL)")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Plan for {self.subscription}"

class TrainingDaySplit(models.Model):
    plan = models.ForeignKey(TrainingPlan, on_delete=models.CASCADE, related_name='splits')
    order = models.IntegerField(help_text="Day 1, Day 2, etc.")
    name = models.CharField(max_length=100) # e.g. "Push Day", "Legs", "Rest"

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.order}: {self.name}"


# 1. Track Completed Sessions
class SessionLog(models.Model):
    subscription = models.ForeignKey(ClientSubscription, on_delete=models.CASCADE, related_name='logs')
    session_number = models.IntegerField() # e.g. Session 1, Session 2...
    split = models.ForeignKey(TrainingDaySplit, on_delete=models.SET_NULL, null=True) # Which routine was done
    date_completed = models.DateField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('subscription', 'session_number')

# 2. Exercise (The Parent)
class TrainingExercise(models.Model):
    split = models.ForeignKey(TrainingDaySplit, on_delete=models.CASCADE, related_name='exercises')
    order = models.IntegerField(default=1)
    name = models.CharField(max_length=200)
    note = models.CharField(max_length=200, blank=True, default="")
    
    class Meta:
        ordering = ['order']

# 3. Sets (The Details) - Replaces the old single fields
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
        

# NEW: Represents a specific day (e.g., Session 5)
class TrainingSession(models.Model):
    subscription = models.ForeignKey(ClientSubscription, on_delete=models.CASCADE, related_name='sessions')
    session_number = models.IntegerField() # 1, 2, 3...
    name = models.CharField(max_length=100) # e.g. "Push Day" (Copied from split)
    date_completed = models.DateField(blank=True, null=True)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ('subscription', 'session_number')

class SessionExercise(models.Model):
    training_session = models.ForeignKey(TrainingSession, on_delete=models.CASCADE, related_name='exercises')
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
        
        

# NEW: Food Item (Child of Meal Plan)
class FoodItem(models.Model):
    meal_plan = models.ForeignKey('MealPlan', on_delete=models.CASCADE, related_name='foods')
    name = models.CharField(max_length=200)
    
    # تم إضافة default=0.0 لكل الحقول أدناه لتجنب أخطاء الـ Migration
    amount = models.FloatField(default=0.0, help_text="Amount in grams or pieces")
    unit = models.CharField(max_length=50, default="g", help_text="e.g. 'g', 'slice', 'egg'")
    calories = models.IntegerField(default=0)
    protein = models.FloatField(default=0.0)
    carbs = models.FloatField(default=0.0)
    fats = models.FloatField(default=0.0)
    
    # Metadata
    order = models.IntegerField(default=1, help_text="Order within the meal")
    
    class Meta:
        ordering = ['order']
    
    def __str__(self):
        return f"{self.name} ({self.amount}{self.unit})"



# NEW: Meal Plan (Child of Nutrition Plan)
class MealPlan(models.Model):
    nutrition_plan = models.ForeignKey('NutritionPlan', on_delete=models.CASCADE, related_name='meal_plans')
    
    # Schedule
    day = models.IntegerField(help_text="Day number (1-7 or 1-14...)")
    
    MEAL_CHOICES = [
        ('breakfast', 'Breakfast'),
        ('snack_1', 'Snack 1'),
        ('lunch', 'Lunch'),
        ('snack_2', 'Snack 2'),
        ('dinner', 'Dinner'),
        ('snack_3', 'Snack 3'),
    ]
    meal_type = models.CharField(max_length=20, choices=MEAL_CHOICES)
    meal_name = models.CharField(max_length=200, blank=True, null=True, help_text="Optional name")
    meal_time = models.TimeField(blank=True, null=True, help_text="Suggested time")
    
    # Totals (Calculated from food items or set manually)
    total_calories = models.IntegerField(default=0)
    total_protein = models.FloatField(default=0.0)
    total_carbs = models.FloatField(default=0.0)
    total_fats = models.FloatField(default=0.0)
    
    # Notes & Completion
    notes = models.TextField(blank=True)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(blank=True, null=True)
    photo = models.ImageField(upload_to='meal_photos/', blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Day {self.day} - {self.get_meal_type_display()}"
    
    class Meta:
        ordering = ['day', 'meal_type']



# NEW: Nutrition Plan (Parent)
class NutritionPlan(models.Model):
    subscription = models.ForeignKey(ClientSubscription, on_delete=models.CASCADE, related_name='nutrition_plans')
    name = models.CharField(max_length=200, default="Nutrition Plan")
    duration_weeks = models.IntegerField(default=1, help_text="How many weeks is this plan for?")
    
    # Calculator inputs (stored for reference)
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
    
    # PDF Branding
    pdf_brand_text = models.CharField(max_length=255, blank=True, null=True, help_text="Custom branding text for PDF export")
    
    # Target Macros (Results)
    target_calories = models.IntegerField(default=2000)
    target_protein = models.FloatField(default=150.0)
    target_carbs = models.FloatField(default=200.0)
    target_fats = models.FloatField(default=60.0)
    
    # Meta
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.subscription.client.name} - {self.name}"
    
    class Meta:
        ordering = ['-created_at']



class NutritionProgress(models.Model):
    """
    Track daily nutrition progress/compliance
    """
    nutrition_plan = models.ForeignKey(
        NutritionPlan, 
        on_delete=models.CASCADE, 
        related_name='progress_logs'
    )
    
    date = models.DateField(default=timezone.now)
    
    # Actual intake
    actual_calories = models.IntegerField(default=0)
    actual_protein = models.FloatField(default=0.0)
    actual_carbs = models.FloatField(default=0.0)
    actual_fats = models.FloatField(default=0.0)
    actual_water = models.FloatField(default=0.0, help_text="Water intake in liters")
    
    # Body measurements (optional)
    weight = models.FloatField(blank=True, null=True, help_text="Body weight in kg")
    body_fat = models.FloatField(blank=True, null=True, help_text="Body fat percentage")
    
    # Compliance
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


class FoodDatabase(models.Model):
    """
    Database of common foods for quick selection
    (Optional - can be used to populate food items quickly)
    """
    name = models.CharField(max_length=200, unique=True)
    arabic_name = models.CharField(max_length=200, blank=True, null=True, help_text="Name in Arabic")
    category = models.CharField(max_length=50)
    
    # Nutritional info per 100g
    calories_per_100g = models.IntegerField()
    protein_per_100g = models.FloatField()
    carbs_per_100g = models.FloatField()
    fats_per_100g = models.FloatField()
    fiber_per_100g = models.FloatField(default=0.0)
    serving_unit = models.CharField(max_length=50, default="g", help_text="e.g. 'slice', 'egg', 'scoop'") 
    grams_per_serving = models.FloatField(default=100.0, help_text="Weight of one serving in grams")
    
    # Common serving info
    common_serving_size = models.FloatField(default=100, help_text="Common serving in grams")
    
    # Metadata
    is_verified = models.BooleanField(default=False, help_text="Verified nutritional data")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']
        verbose_name_plural = "Food Database"


class CoachSchedule(models.Model):
    """
    UPDATED: Added session_time field for manual time entry
    """
    coach = models.ForeignKey(User, on_delete=models.CASCADE, related_name='schedules')
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='scheduled_days')
    day = models.CharField(max_length=15) # Monday, Tuesday...
    session_time = models.TimeField(blank=True, null=True, help_text="Scheduled time for this group session")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('coach', 'client', 'day') 
        
    def __str__(self):
        time_str = self.session_time.strftime('%H:%M') if self.session_time else 'No time set'
        return f"{self.coach.first_name} - {self.day} at {time_str}"

class GroupSessionLog(models.Model):
    coach = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    date = models.DateTimeField(default=timezone.now)
    day_name = models.CharField(max_length=20)  # e.g. "Monday Group"
    
    # CHANGED: JSONField is much safer than TextField for lists
    exercises_summary = models.JSONField(default=list, blank=True) 
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.day_name} - {self.date.date()}"

class GroupSessionParticipant(models.Model):
    session = models.ForeignKey(GroupSessionLog, on_delete=models.CASCADE, related_name='participants')
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True)
    note = models.CharField(max_length=255, blank=True)
    deducted = models.BooleanField(default=False)  # Was a session deducted?

    def __str__(self):
        return f"{self.client.name if self.client else 'Unknown'} in {self.session}"
    
    
class GroupWorkoutTemplate(models.Model):
    name = models.CharField(max_length=200)
    # Storing exercises as JSON is efficient for templates: 
    # Structure: [{"name": "Squat", "type": "strength", "target": "3x10"}, ...]
    exercises = models.JSONField(default=list) 
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
    
    
class SessionTransferRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    # The trainer sending the request (YOU)
    from_trainer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_transfers')
    
    # The trainer receiving the request
    to_trainer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_transfers')
    
    # The subscription being transferred
    subscription = models.ForeignKey(ClientSubscription, on_delete=models.CASCADE, related_name='transfer_requests')
    
    sessions_count = models.IntegerField(help_text="How many sessions to transfer")
    schedule_notes = models.TextField(help_text="Days and times (e.g., Mon 5PM, Wed 3PM)")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.from_trainer} -> {self.to_trainer}: {self.subscription.client.name}"
    
    
class ManualNutritionSave(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='manual_nutrition_saves')
    client_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=50, blank=True, null=True, help_text="Internal ID, not printed")
    plan_name = models.CharField(max_length=200, default="My Plan")
    
    # This field will store the entire frontend state (calcState, results, notes)
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
    
    # This field stores the exercises array
    data = models.JSONField(default=dict)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.client_name} - {self.session_name}"
