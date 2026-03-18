from django.db import models, transaction
from django.conf import settings
from datetime import date, timedelta
from django.utils import timezone
from django.contrib.auth.models import User


# ---------------------------------------------------------------------------
# 1. CLIENT
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# 2. COUNTRY
# ---------------------------------------------------------------------------

class Country(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=5, unique=True)
    dial_code = models.CharField(max_length=10)

    def __str__(self):
        return f"{self.name} ({self.dial_code})"


# ---------------------------------------------------------------------------
# 3. SUBSCRIPTION PACKAGE
# ---------------------------------------------------------------------------

class Subscription(models.Model):
    name = models.CharField(max_length=100, blank=True, default="")
    units = models.IntegerField(help_text="Number of sessions/visits")
    duration_days = models.IntegerField(help_text="Duration in days (e.g. 30 for 1 month)")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_child_plan = models.BooleanField(default=False, help_text="Is this package for children?")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.units} units)"


# ---------------------------------------------------------------------------
# 4. CLIENT SUBSCRIPTION
# ---------------------------------------------------------------------------

class ClientSubscription(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(Subscription, on_delete=models.SET_NULL, null=True)
    trainer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                db_index=True)  # ← ADDED
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField(blank=True, null=True, db_index=True)  # ← ADDED
    is_active = models.BooleanField(default=True, db_index=True)  # ← ADDED
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
            # Composite index covers the most common query pattern:
            # filter(trainer=X, is_active=True)
            models.Index(fields=['trainer', 'is_active'], name='idx_sub_trainer_active'),
        ]
        constraints = [
            # FIX #11: إضافة قيد على مستوى قاعدة البيانات يمنع وجود أكثر من
            # اشتراك نشط واحد لنفس العميل في نفس الوقت.
            # التحقق في الـ serializer وحده لا يكفي لأنه يمكن تجاوزه عبر
            # Django shell أو admin أو أي API client مباشر.
            # تذكر تشغيل: python manage.py makemigrations && python manage.py migrate
            models.UniqueConstraint(
                fields=['client'],
                condition=models.Q(is_active=True),
                name='unique_active_subscription_per_client',
            )
        ]

    def save(self, *args, **kwargs):
        # 1. تحويل start_date إلى تاريخ فقط إذا كان يحتوي على وقت
        if hasattr(self.start_date, 'date'):
            self.start_date = self.start_date.date()

        # 2. حساب تاريخ الانتهاء تلقائياً لو مش موجود
        if not self.end_date and self.plan:
            self.end_date = self.start_date + timedelta(days=self.plan.duration_days)

        # 3. تحويل end_date إلى تاريخ فقط لتجنب أخطاء المقارنة
        if hasattr(self.end_date, 'date'):
            self.end_date = self.end_date.date()

        # 4. إلغاء التفعيل تلقائياً لو الاشتراك انتهى
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


# ---------------------------------------------------------------------------
# 5. TRAINING PLAN & STRUCTURE
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
# 6. SESSION LOG (legacy)
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
# 7. TRAINING EXERCISE TEMPLATE (plan-level)
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
# 8. TRAINING SESSION (authoritative session-completion record)
# ---------------------------------------------------------------------------

class TrainingSession(models.Model):
    subscription = models.ForeignKey(
        ClientSubscription, on_delete=models.CASCADE, related_name='sessions'
    )
    session_number = models.IntegerField()
    name = models.CharField(max_length=100, blank=True, default="")
    date_completed = models.DateField(blank=True, null=True, db_index=True)  # ← ADDED
    is_completed = models.BooleanField(default=False, db_index=True)  # ← ADDED
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


# ---------------------------------------------------------------------------
# 9. NUTRITION
# ---------------------------------------------------------------------------

class FoodItem(models.Model):
    meal_plan = models.ForeignKey('MealPlan', on_delete=models.CASCADE, related_name='foods')
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


class MealPlan(models.Model):
    nutrition_plan = models.ForeignKey(
        'NutritionPlan', on_delete=models.CASCADE, related_name='meal_plans'
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

    # FIX #1: ترتيب زمني صريح لكل نوع وجبة.
    # الترتيب الأبجدي السابق كان يُنتج: breakfast → dinner → lunch → snack_1 → ...
    # وهو خاطئ لأن dinner تسبق lunch.  الآن نحفظ الترتيب الصحيح في حقل order
    # ونُرتّب على أساسه بدلاً من ترتيب النص.
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

    # حقل الترتيب الزمني — يُحدَّث تلقائياً في save() من MEAL_TYPE_ORDER.
    # يتيح ORDER BY صحيح على مستوى قاعدة البيانات بدون حسابات إضافية.
    # تذكر تشغيل: python manage.py makemigrations && python manage.py migrate
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
        # تحديث order تلقائياً من MEAL_TYPE_ORDER قبل الحفظ.
        # القيمة 99 تضمن أن أي meal_type غير معروف يظهر في النهاية.
        self.order = self.MEAL_TYPE_ORDER.get(self.meal_type, 99)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Day {self.day} - {self.get_meal_type_display()}"

    class Meta:
        # FIX #1: ترتيب بـ order (زمني) بدلاً من meal_type (أبجدي خاطئ)
        ordering = ['day', 'order']


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

    # FIX-BUG-9: Coach notes field — was missing, causing silent data loss
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


# ---------------------------------------------------------------------------
# 10. FOOD DATABASE
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
# 11. COACH SCHEDULE & GROUP TRAINING
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
# EXERCISE CATEGORY CHOICES
# ---------------------------------------------------------------------------

EXERCISE_CATEGORY_WEIGHT = 'weight'
EXERCISE_CATEGORY_REPS   = 'reps'
EXERCISE_CATEGORY_TIME   = 'time'

EXERCISE_CATEGORY_CHOICES = [
    (EXERCISE_CATEGORY_WEIGHT, 'Weight / وزن'),
    (EXERCISE_CATEGORY_REPS,   'Reps / عدات'),
    (EXERCISE_CATEGORY_TIME,   'Time / وقت'),
]


class GroupSessionLog(models.Model):
    coach = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    date = models.DateTimeField(default=timezone.now, db_index=True)  # ← ADDED
    day_name = models.CharField(max_length=20)
    exercises_summary = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.day_name} - {self.date.date()}"


class GroupSessionParticipant(models.Model):
    session = models.ForeignKey(GroupSessionLog, on_delete=models.CASCADE, related_name='participants')
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True)
    note = models.CharField(max_length=255, blank=True)
    deducted = models.BooleanField(default=False, db_index=True)  # ← ADDED

    def save(self, *args, **kwargs):
        # Determine if `deducted` is transitioning from False → True so we only
        # deduct once, even if the record is saved multiple times afterward.
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

        # Only touch the subscription when deducted is being flipped to True.
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

            # Atomic increment using the ORM to avoid race conditions.
            ClientSubscription.objects.filter(pk=active_sub.pk).update(
                sessions_used=models.F('sessions_used') + 1
            )
            active_sub.refresh_from_db(fields=['sessions_used'])

            # Auto-deactivate if the plan's session limit has been reached.
            if active_sub.plan and active_sub.sessions_used >= active_sub.plan.units:
                active_sub.is_active = False
                active_sub.save(update_fields=['is_active'])

    def __str__(self):
        return f"{self.client.name if self.client else 'Unknown'} in {self.session}"


class GroupWorkoutTemplate(models.Model):
    name = models.CharField(max_length=200)
    exercises = models.JSONField(default=list)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# 12. SESSION TRANSFER
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
# 13. MANUAL SAVES (offline calculator outputs)
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


# ---------------------------------------------------------------------------
# 14. TRAINER SHIFT & WEEKLY SCHEDULE  ← NEW
# ---------------------------------------------------------------------------

class TrainerShift(models.Model):
    """
    Stores the working hours (shift) for a single trainer.
    One-to-one with User so each trainer has exactly one shift record.
    The slot_duration field controls how many minutes each schedule cell spans
    (default 60 min = 1 hour).
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
      • The linked client must have an is_active=True subscription with ANY trainer
        (not necessarily the trainer who owns this slot — any trainer can train
        any client per gym business rules).
      • If the subscription expires/is deactivated the slot is excluded at the
        queryset level in the ViewSet (no stale entries returned to the UI).

    Uniqueness constraint prevents double-booking the same slot for the same trainer.
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
        # A trainer cannot have two clients in the exact same slot.
        unique_together = ('trainer', 'day_of_week', 'time_slot')
        ordering = ['day_of_week', 'time_slot']
        constraints = [
            # BUG-3 FIX: الـ unique_together السابق كان يمنع فقط حجز مدرب واحد
            # لعميلين مختلفين في نفس الـ slot، لكن لم يكن يمنع حجز نفس العميل
            # عند مدربَين مختلفَين في نفس اليوم والوقت.
            # مثال: مدرب A يحجز "علي - الاثنين 10:00" ومدرب B يحجز "علي - الاثنين 10:00"
            # كان مسموحاً به قبل هذا الإصلاح.
            # الحل: قيد إضافي يمنع نفس العميل من الظهور مرتين في نفس الـ slot
            # بغض النظر عن المدرب.
            # ملاحظة: هذا القيد منطقي لأن العميل جسدياً لا يمكنه أن يكون في
            # مكانين في نفس الوقت.
            # تذكر تشغيل: python manage.py makemigrations && python manage.py migrate
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