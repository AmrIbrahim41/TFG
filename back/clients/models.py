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
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

    @property
    def age(self):
        if self.birth_date:
            today = date.today()
            return today.year - self.birth_date.year - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
        return None





class Subscription(models.Model):
    name = models.CharField(max_length=100) # e.g. "Gold Package"
    units = models.IntegerField(help_text="Number of sessions/visits")
    duration_days = models.IntegerField(help_text="Duration in days (e.g. 30 for 1 month)")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) # Optional but good to have
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.units} units)"
    
    
from .models import Client, Subscription 
    
class ClientSubscription(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(Subscription, on_delete=models.SET_NULL, null=True)
    trainer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True) # NEW: Trainer Link
    
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    # NEW: Session Tracking
    sessions_used = models.IntegerField(default=0, help_text="Number of sessions attended")

    # NEW: Expanded InBody Data
    inbody_height = models.FloatField(default=0.0, help_text="Height in CM")
    inbody_weight = models.FloatField(default=0.0, help_text="Weight in KG")
    inbody_muscle = models.FloatField(default=0.0, help_text="Muscle Mass in KG")
    inbody_fat = models.FloatField(default=0.0, help_text="Body Fat Percentage")
    inbody_tbw = models.FloatField(default=0.0, help_text="Total Body Water")
    
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
    

    
from .models import ClientSubscription, TrainingDaySplit # Keep existing imports
    
    
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
    note = models.CharField(max_length=200, blank=True) # General note
    
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
        
        
        
# ... keep existing models ...

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
    
    class Meta:
        ordering = ['order']

class SessionSet(models.Model):
    exercise = models.ForeignKey(SessionExercise, on_delete=models.CASCADE, related_name='sets')
    order = models.IntegerField(default=1)
    reps = models.CharField(max_length=50, blank=True)
    weight = models.CharField(max_length=50, blank=True)
    
    TECHNIQUE_CHOICES = [('Regular', 'Regular'), ('Drop Set', 'Drop Set'), ('Super Set', 'Super Set'), ('Pyramid', 'Pyramid'), ('Negative', 'Negative')]
    technique = models.CharField(max_length=50, choices=TECHNIQUE_CHOICES, default='Regular')

    EQUIPMENT_CHOICES = [('Bodyweight', 'Bodyweight'), ('Dumbbell', 'Dumbbell'), ('Barbell', 'Barbell'), ('Cable', 'Cable'), ('Machine', 'Machine')]
    equipment = models.CharField(max_length=50, choices=EQUIPMENT_CHOICES, blank=True, null=True)

    class Meta:
        ordering = ['order']
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
   


class NutritionPlan(models.Model):
    # Changed to ForeignKey to allow multiple plans per client
    subscription = models.ForeignKey(
        'ClientSubscription', 
        on_delete=models.CASCADE, 
        related_name='nutrition_plans'
    )
    
    # --- Card Info (New) ---
    name = models.CharField(max_length=100, default="New Diet Plan", help_text="e.g. Winter Bulk")
    duration_weeks = models.IntegerField(default=4)

    # --- The Machine: Calculator State (Saved Inputs) ---
    calc_weight = models.FloatField(default=80.0)
    calc_tdee = models.IntegerField(default=2500)
    calc_defer_cal = models.IntegerField(default=500) # Deficit
    calc_fat_percent = models.FloatField(default=25.0)
    calc_protein_multiplier = models.FloatField(default=2.2)
    calc_protein_advance = models.FloatField(default=0.8)
    calc_meals = models.IntegerField(default=4)
    calc_snacks = models.IntegerField(default=2)

    # --- The Machine: Targets (Calculated Outputs) ---
    target_calories = models.IntegerField(default=2000)
    target_protein = models.IntegerField(default=150)
    target_carbs = models.IntegerField(default=200)
    target_fats = models.IntegerField(default=60)
    
    # --- General Metadata (Restored) ---
    water_intake = models.FloatField(default=3.0)
    meals_per_day = models.IntegerField(default=5) # Kept for backward compatibility
    
    DIET_CHOICES = [
        ('Balanced', 'Balanced'),
        ('High Protein', 'High Protein'),
        ('Low Carb', 'Low Carb'),
        ('Keto', 'Keto'),
        ('Vegan', 'Vegan'),
        ('Mediterranean', 'Mediterranean'),
    ]
    diet_type = models.CharField(max_length=50, choices=DIET_CHOICES, default='Balanced')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    notes = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.name} - {self.subscription.client.name}"
    
    class Meta:
        ordering = ['-created_at']


class MealPlan(models.Model):
    """
    Individual meal plan for a specific day and meal time
    """
    nutrition_plan = models.ForeignKey(
        NutritionPlan, 
        on_delete=models.CASCADE, 
        related_name='meal_plans'
    )
    
    # Day and Meal Time
    DAY_CHOICES = [
        ('Monday', 'Monday'),
        ('Tuesday', 'Tuesday'),
        ('Wednesday', 'Wednesday'),
        ('Thursday', 'Thursday'),
        ('Friday', 'Friday'),
        ('Saturday', 'Saturday'),
        ('Sunday', 'Sunday'),
    ]
    day = models.CharField(max_length=20, choices=DAY_CHOICES)
    
    MEAL_TYPE_CHOICES = [
        ('breakfast', 'Breakfast'),
        ('snack1', 'Morning Snack'),
        ('lunch', 'Lunch'),
        ('snack2', 'Afternoon Snack'),
        ('dinner', 'Dinner'),
        ('snack3', 'Evening Snack'),
    ]
    meal_type = models.CharField(max_length=20, choices=MEAL_TYPE_CHOICES)
    
    # Meal Details
    meal_name = models.CharField(max_length=200, blank=True, help_text="e.g., Chicken Rice Bowl")
    meal_time = models.TimeField(blank=True, null=True, help_text="Suggested meal time")
    
    # Nutritional Totals (calculated from foods)
    total_calories = models.IntegerField(default=0)
    total_protein = models.FloatField(default=0.0)
    total_carbs = models.FloatField(default=0.0)
    total_fats = models.FloatField(default=0.0)
    
    # Additional Info
    notes = models.TextField(blank=True)
    is_completed = models.BooleanField(default=False, help_text="Did client complete this meal?")
    completed_at = models.DateTimeField(blank=True, null=True)
    
    # Meal Photo (optional)
    photo = models.ImageField(upload_to='meal_photos/', blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.day} - {self.get_meal_type_display()}"
    
    class Meta:
        ordering = ['day', 'meal_type']
        unique_together = ['nutrition_plan', 'day', 'meal_type']


class FoodItem(models.Model):
    """
    Individual food item in a meal
    """
    meal_plan = models.ForeignKey(
        MealPlan, 
        on_delete=models.CASCADE, 
        related_name='foods'
    )
    
    # Food Details
    name = models.CharField(max_length=200, help_text="e.g., Chicken Breast")
    quantity = models.FloatField(default=100, help_text="Quantity in grams or ml")
    
    UNIT_CHOICES = [
        ('g', 'Grams'),
        ('ml', 'Milliliters'),
        ('piece', 'Piece'),
        ('cup', 'Cup'),
        ('tbsp', 'Tablespoon'),
        ('tsp', 'Teaspoon'),
    ]
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='g')
    
    # Nutritional Info (per serving)
    calories = models.IntegerField(default=0)
    protein = models.FloatField(default=0.0)
    carbs = models.FloatField(default=0.0)
    fats = models.FloatField(default=0.0)
    fiber = models.FloatField(default=0.0, blank=True)
    
    # Food Category
    CATEGORY_CHOICES = [
        ('Protein', 'Protein'),
        ('Carbs', 'Carbohydrates'),
        ('Vegetables', 'Vegetables'),
        ('Fruits', 'Fruits'),
        ('Dairy', 'Dairy'),
        ('Fats', 'Fats & Oils'),
        ('Snacks', 'Snacks'),
        ('Beverages', 'Beverages'),
        ('Supplements', 'Supplements'),
    ]
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, blank=True)
    
    # Preparation Method
    preparation = models.CharField(max_length=100, blank=True, help_text="e.g., Grilled, Boiled, Raw")
    
    # Order in meal
    order = models.IntegerField(default=1)
    
    def __str__(self):
        return f"{self.quantity}{self.unit} {self.name}"
    
    class Meta:
        ordering = ['order']


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
    category = models.CharField(max_length=50)
    
    # Nutritional info per 100g
    calories_per_100g = models.IntegerField()
    protein_per_100g = models.FloatField()
    carbs_per_100g = models.FloatField()
    fats_per_100g = models.FloatField()
    fiber_per_100g = models.FloatField(default=0.0)
    
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
