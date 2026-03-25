from rest_framework import serializers
from django.db import transaction
from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password as django_validate_password

from .models import (
    Client, Country, Subscription, ClientSubscription,
    TrainingPlan, TrainingDaySplit, TrainingExercise, TrainingSet,
    SessionLog, TrainingSession, SessionExercise, SessionSet,
    FoodItem, MealPlan, NutritionPlan, NutritionProgress, FoodDatabase,
    CoachSchedule, GroupSessionLog, GroupSessionParticipant,
    GroupWorkoutTemplate, SessionTransferRequest,
    ManualNutritionSave, ManualWorkoutSave,
    TrainerShift, TrainerSchedule,
)


# ---------------------------------------------------------------------------
# HELPER: Build absolute URI for image fields safely
# ---------------------------------------------------------------------------

def _build_photo_url(request, photo_field):
    """
    Returns an absolute URI for the given ImageField value.
    Uses request.build_absolute_uri() so the React frontend always receives
    a fully-qualified URL regardless of subdomain or reverse-proxy setup.
    Falls back gracefully to None so the frontend never breaks on render.
    """
    if not photo_field:
        return None
    try:
        if request is not None:
            return request.build_absolute_uri(photo_field.url)
        return photo_field.url
    except Exception:
        return None


# ---------------------------------------------------------------------------
# TRAINER  (moved here from views.py — belongs in serializers.py)
# ---------------------------------------------------------------------------

class TrainerSerializer(serializers.ModelSerializer):
    """
    Full trainer serializer — admin use only (create / update / detail).
    Exposes sensitive fields (email, date_joined) so restrict to IsAdminUser.
    Password field runs Django's built-in validators on create/update.
    """
    role = serializers.ChoiceField(
        choices=[('trainer', 'Trainer'), ('rec', 'Receptionist')],
        write_only=True,
        default='trainer',
    )

    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'email', 'password', 'date_joined', 'role')
        extra_kwargs = {'password': {'write_only': True, 'required': False}}

    # ------------------------------------------------------------------
    # FIX #17: Password strength validation
    # ------------------------------------------------------------------
    def validate_password(self, value):
        """
        Run Django's built-in password validators.
        By default this enforces minimum length (8 chars), rejects common
        passwords, and rejects purely numeric passwords.
        Configure via AUTH_PASSWORD_VALIDATORS in settings.py.
        """
        if value:
            # Pass the user instance (or None on create) so the
            # UserAttributeSimilarityValidator can compare against username/email.
            user = self.instance
            django_validate_password(value, user=user)
        return value

    def create(self, validated_data):
        role = validated_data.pop('role', 'trainer')

        # FIX #4: الحقل password معرَّف كـ required=False في Meta، مما يعني أن
        # validated_data.get('password') قد يُعيد None بدلاً من رمي KeyError.
        # استخدام validated_data['password'] مباشرةً كان سيرمي KeyError صامتاً
        # (500 Internal Server Error) لو أُرسل الطلب بدون password.
        # الآن نتحقق صراحةً ونُعيد رسالة خطأ واضحة للعميل.
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError(
                {'password': 'Password is required when creating a new trainer.'}
            )

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=password,
            first_name=validated_data.get('first_name', ''),
        )
        user.is_staff = False
        user.save()

        if role == 'rec':
            group, _ = Group.objects.get_or_create(name='REC')
            user.groups.add(group)

        return user

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        if role:
            rec_group = Group.objects.filter(name='REC').first()
            if rec_group:
                instance.groups.remove(rec_group)
            if role == 'rec':
                group, _ = Group.objects.get_or_create(name='REC')
                instance.groups.add(group)

        return instance


class TrainerPublicSerializer(serializers.ModelSerializer):
    """
    FIX #15: Limited trainer info for non-admin, authenticated users.
    Used for the transfer-target picker and similar lists.
    Does NOT expose email, date_joined, or any sensitive field.
    """
    class Meta:
        model = User
        fields = ('id', 'first_name', 'username')


# ---------------------------------------------------------------------------
# CLIENT
# ---------------------------------------------------------------------------

class ClientSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    age = serializers.ReadOnlyField()
    is_subscribed = serializers.SerializerMethodField()
    active_trainer_name = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id', 'name', 'manual_id', 'phone', 'photo', 'photo_url',
            'created_at', 'nature_of_work', 'birth_date', 'age', 'address',
            'status', 'smoking', 'sleep_hours', 'notes', 'is_subscribed',
            'is_child', 'parent_phone', 'country', 'trained_gym_before',
            'trained_coach_before', 'injuries',
            'active_trainer_name',
        ]

    def get_photo_url(self, obj):
        request = self.context.get('request')
        return _build_photo_url(request, obj.photo)

    def get_active_trainer_name(self, obj):
        active_sub = next((sub for sub in obj.subscriptions.all() if sub.is_active), None)
        if active_sub and active_sub.trainer:
            return active_sub.trainer.first_name or active_sub.trainer.username
        return None

    def get_is_subscribed(self, obj):
        # FIX B3: .filter().exists() creates a new DB query, bypassing the
        # prefetch_related('subscriptions__trainer') cache in ClientViewSet.
        # Python-level iteration reuses the prefetched data, keeping it 0 extra queries.
        return any(sub.is_active for sub in obj.subscriptions.all())

    def validate(self, data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            is_admin = user.is_superuser
            is_rec = user.groups.filter(name='REC').exists()

            if not is_admin and not is_rec and self.instance:
                if 'name' in data and data['name'] != self.instance.name:
                    raise serializers.ValidationError(
                        {'name': 'Only Admins or Reception can edit the Name.'}
                    )
                if 'manual_id' in data and data['manual_id'] != self.instance.manual_id:
                    raise serializers.ValidationError(
                        {'manual_id': 'Only Admins or Reception can edit the ID.'}
                    )
        return data


# ---------------------------------------------------------------------------
# SUBSCRIPTION PACKAGE
# ---------------------------------------------------------------------------

class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = '__all__'


# ---------------------------------------------------------------------------
# COUNTRY
# ---------------------------------------------------------------------------

class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'


# ---------------------------------------------------------------------------
# CLIENT SUBSCRIPTION
# ---------------------------------------------------------------------------

class ClientSubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.ReadOnlyField(source='plan.name')
    plan_total_sessions = serializers.ReadOnlyField(source='plan.units')
    # BUG #4 FIX: كان trainer_name = ReadOnlyField(source='trainer.first_name')
    # مما يُرجع None أو string فارغ لو first_name مش موجود.
    # الفرونت (ChildMembershipTab.jsx) يخفي قسم المدرب كلياً لو trainer_name falsy
    # (if sub.trainer_name && ...). SerializerMethodField يضمن fallback لـ username.
    trainer_name = serializers.SerializerMethodField()
    client_name = serializers.ReadOnlyField(source='client.name')

    class Meta:
        model = ClientSubscription
        fields = '__all__'
        read_only_fields = ['created_at']

    def get_trainer_name(self, obj):
        if not obj.trainer:
            return None
        return obj.trainer.first_name or obj.trainer.username

    def validate(self, data):
        if self.instance:
            effective_is_active = data.get('is_active', self.instance.is_active)
        else:
            effective_is_active = data.get('is_active', True)

        if effective_is_active:
            client = data.get('client') or (self.instance.client if self.instance else None)
            if client is None:
                return data

            active_subs = ClientSubscription.objects.filter(client=client, is_active=True)
            if self.instance:
                active_subs = active_subs.exclude(id=self.instance.id)

            if active_subs.exists():
                raise serializers.ValidationError(
                    {
                        'is_active': (
                            'This client already has an active subscription. '
                            'Deactivate the old one first.'
                        )
                    }
                )
        return data


# ---------------------------------------------------------------------------
# TRAINING PLAN (template level)
# ---------------------------------------------------------------------------

class TrainingSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingSet
        fields = '__all__'


class TrainingExerciseSerializer(serializers.ModelSerializer):
    sets = TrainingSetSerializer(many=True, read_only=True)

    class Meta:
        model = TrainingExercise
        fields = ['id', 'split', 'order', 'name', 'note', 'sets']


class TrainingDaySplitSerializer(serializers.ModelSerializer):
    exercises = TrainingExerciseSerializer(many=True, read_only=True)

    class Meta:
        model = TrainingDaySplit
        fields = ['id', 'order', 'name', 'exercises']


class TrainingPlanSerializer(serializers.ModelSerializer):
    splits = TrainingDaySplitSerializer(many=True, read_only=True)

    # BUG-1 FIX: This write-only field accepts the array of day-name strings
    # that the React wizard sends (e.g. ["Push", "Pull", "Legs"]).
    # It is stripped before saving the model and used instead to create the
    # related TrainingDaySplit records in create() below.
    # Without this field the payload key was silently discarded by DRF because
    # TrainingPlan has no `day_names` column — resulting in a plan that always
    # had zero splits and a session grid that could never show day names.
    day_names = serializers.ListField(
        child=serializers.CharField(max_length=100, allow_blank=True),
        write_only=True,
        required=False,
        help_text="One name per split day, in order. Length should equal cycle_length.",
    )

    class Meta:
        model = TrainingPlan
        fields = ['id', 'subscription', 'cycle_length', 'created_at', 'splits', 'day_names']

    def validate(self, data):
        """
        BUG-1 FIX (cont.): Reject duplicate plan creation at the serializer level
        so the frontend receives a clear 400 JSON error instead of an opaque
        500 caused by the OneToOneField unique constraint violation.
        """
        subscription = data.get('subscription')
        if subscription and not self.instance:
            if TrainingPlan.objects.filter(subscription=subscription).exists():
                raise serializers.ValidationError({
                    'subscription': (
                        'A training plan already exists for this subscription. '
                        'Delete (reset) the existing plan before creating a new one.'
                    )
                })
        return data

    def create(self, validated_data):
        """
        BUG-1 FIX (cont.): Pop the write-only `day_names` list before creating
        the TrainingPlan row (it has no column for it), then bulk-create one
        TrainingDaySplit per entry.  Falls back gracefully to "Day N" labels
        when day_names is shorter than cycle_length or omitted entirely.
        """
        day_names = validated_data.pop('day_names', [])

        with transaction.atomic():
            plan = TrainingPlan.objects.create(**validated_data)

            splits_to_create = []
            for i in range(plan.cycle_length):
                # Use provided name or fall back to "Day N"
                name = day_names[i].strip() if i < len(day_names) else ''
                if not name:
                    name = f'Day {i + 1}'
                splits_to_create.append(
                    TrainingDaySplit(plan=plan, order=i + 1, name=name)
                )

            TrainingDaySplit.objects.bulk_create(splits_to_create)

        return plan


# ---------------------------------------------------------------------------
# SESSION LOG (legacy)
# ---------------------------------------------------------------------------

class SessionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionLog
        fields = '__all__'


# ---------------------------------------------------------------------------
# TRAINING SESSION (authoritative)
# ---------------------------------------------------------------------------

class SessionSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionSet
        fields = '__all__'


class SessionExerciseSerializer(serializers.ModelSerializer):
    sets = SessionSetSerializer(many=True, read_only=True)

    class Meta:
        model = SessionExercise
        fields = ['id', 'order', 'name', 'note', 'sets']


class TrainingSessionSerializer(serializers.ModelSerializer):
    """
    Full serializer — used for detail/retrieve/save-data/get-data.
    Includes the nested exercises → sets tree.
    """
    exercises = SessionExerciseSerializer(many=True, read_only=True)
    trainer_name = serializers.ReadOnlyField(source='completed_by.first_name')
    completed_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = TrainingSession
        fields = [
            'id', 'subscription', 'session_number', 'name', 'is_completed',
            'date_completed', 'exercises', 'trainer_name', 'completed_by',
        ]


class TrainingSessionListSerializer(serializers.ModelSerializer):
    """
    BUG-5 FIX: Slim serializer for the list action used by ClientTrainingTab
    to render the session grid checkmarks.

    The full TrainingSessionSerializer nests exercises → sets for every row,
    which multiplies payload size by 10-50x for clients with many sessions.
    This list serializer returns only the fields the grid actually needs:
      • session_number   — to match against the slot index
      • is_completed     — to colour the card green
      • date_completed   — shown in the completed card footer
      • trainer_name     — shown in the completed card footer
      • name             — displayed as session title in the card

    The full exercises tree is intentionally excluded.  The WorkoutEditor
    fetches it separately via /training-sessions/get-data/ when a card is
    clicked, so there is no data loss.
    """
    trainer_name = serializers.ReadOnlyField(source='completed_by.first_name')

    class Meta:
        model = TrainingSession
        fields = [
            'id', 'subscription', 'session_number', 'name',
            'is_completed', 'date_completed', 'trainer_name',
        ]


# ---------------------------------------------------------------------------
# NUTRITION – FOOD ITEM
# ---------------------------------------------------------------------------

class FoodItemSerializer(serializers.ModelSerializer):
    # Expose `id` as an optional writable field so the NutritionPlan update
    # serializer can distinguish "update this existing item" from "create new".
    id = serializers.IntegerField(required=False)

    # BUG #1 FIX: DRF's auto-generated field makes meal_plan required and
    # writable because FoodItem has a FK to MealPlan.  When FoodItems arrive
    # nested inside a NutritionPlan payload, the MealPlan row does not exist
    # yet at serialization time, so the frontend has no ID to supply — causing
    # a 400 Validation Error on every save that includes food items.
    # Declaring it read_only here suppresses the validation requirement.
    # The NutritionPlanCreateSerializer.create() / update() methods already
    # set meal_plan programmatically (FoodItem(meal_plan=meal_obj, ...)) before
    # calling bulk_create(), so no data is lost.
    meal_plan = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FoodItem
        fields = '__all__'


# ---------------------------------------------------------------------------
# NUTRITION – MEAL PLAN
# ---------------------------------------------------------------------------

class MealPlanSerializer(serializers.ModelSerializer):
    foods = FoodItemSerializer(many=True, read_only=True)
    meal_type_display = serializers.CharField(source='get_meal_type_display', read_only=True)

    class Meta:
        model = MealPlan
        fields = [
            'id', 'nutrition_plan', 'day', 'meal_type', 'meal_type_display',
            'meal_name', 'meal_time', 'total_calories', 'total_protein',
            'total_carbs', 'total_fats', 'notes', 'is_completed',
            'completed_at', 'photo', 'foods', 'created_at', 'updated_at',
        ]


class MealPlanCreateSerializer(serializers.ModelSerializer):
    foods = FoodItemSerializer(many=True, required=False)

    class Meta:
        model = MealPlan
        fields = [
            'id', 'day', 'meal_type', 'meal_name', 'meal_time',
            'total_calories', 'total_protein', 'total_carbs', 'total_fats',
            'notes', 'foods',
        ]

    def create(self, validated_data):
        foods_data = validated_data.pop('foods', [])
        meal_plan = MealPlan.objects.create(**validated_data)
        for food_data in foods_data:
            # BUG #3 FIX: إزالة الـ id من food_data قبل الإنشاء.
            # FoodItemSerializer يُعرّض id كـ IntegerField(required=False)،
            # وإذا أرسل الـ frontend id قديم فإن create() ستحاول إنشاء FoodItem
            # بـ primary key موجود → IntegrityError (duplicate PK).
            food_data.pop('id', None)
            FoodItem.objects.create(meal_plan=meal_plan, **food_data)
        return meal_plan


# ---------------------------------------------------------------------------
# NUTRITION – NUTRITION PLAN (read)
# ---------------------------------------------------------------------------

class NutritionPlanSerializer(serializers.ModelSerializer):
    meal_plans = MealPlanSerializer(many=True, read_only=True)
    client_name = serializers.ReadOnlyField(source='subscription.client.name')
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = NutritionPlan
        fields = [
            'id', 'subscription', 'name', 'duration_weeks',
            'calc_gender', 'calc_age', 'calc_height', 'calc_weight', 'calc_activity_level',
            'calc_tdee', 'calc_defer_cal', 'calc_fat_percent',
            'calc_protein_multiplier', 'calc_protein_advance', 'calc_meals', 'calc_snacks',
            'calc_carb_adjustment', 'pdf_brand_text',
            'target_calories', 'target_protein', 'target_carbs', 'target_fats',
            'notes',          # ← FIX: exposed to frontend
            'meal_plans', 'client_name', 'created_by_name', 'created_at', 'updated_at',
        ]

    def get_created_by_name(self, obj):
        """
        Returns the trainer display name to render inside PDFs.
        Prefer `first_name`, then fall back to `username`.
        """
        user = getattr(obj, 'created_by', None)
        if not user:
            return None
        return user.first_name or user.username


# ---------------------------------------------------------------------------
# NUTRITION – NUTRITION PLAN (create / update)
# ---------------------------------------------------------------------------

class NutritionPlanCreateSerializer(serializers.ModelSerializer):
    meal_plans = MealPlanCreateSerializer(many=True, required=False)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = NutritionPlan
        fields = [
            'id', 'subscription', 'name', 'duration_weeks',
            'calc_gender', 'calc_age', 'calc_height', 'calc_weight', 'calc_activity_level',
            'calc_tdee', 'calc_defer_cal', 'calc_fat_percent',
            'calc_protein_multiplier', 'calc_protein_advance', 'calc_meals', 'calc_snacks',
            'calc_carb_adjustment', 'pdf_brand_text',
            'target_calories', 'target_protein', 'target_carbs', 'target_fats',
            'notes',          # ← FIX: saveable from frontend
            'meal_plans',
            'created_by_name',
        ]

    def create(self, validated_data):
        meal_plans_data = validated_data.pop('meal_plans', [])
        validated_data.setdefault('target_calories', 2000)
        validated_data.setdefault('target_protein', 150)
        validated_data.setdefault('target_carbs', 200)
        validated_data.setdefault('target_fats', 60)

        nutrition_plan = NutritionPlan.objects.create(**validated_data)

        food_items_to_create = []
        for meal_data in meal_plans_data:
            foods_data = meal_data.pop('foods', [])
            meal_plan = MealPlan.objects.create(nutrition_plan=nutrition_plan, **meal_data)
            for food_data in foods_data:
                # BUG #3 FIX: إزالة الـ id من food_data قبل bulk_create.
                food_data.pop('id', None)
                food_items_to_create.append(FoodItem(meal_plan=meal_plan, **food_data))

        if food_items_to_create:
            FoodItem.objects.bulk_create(food_items_to_create)

        return nutrition_plan

    def get_created_by_name(self, obj):
        user = getattr(obj, 'created_by', None)
        if not user:
            return None
        return user.first_name or user.username

    def update(self, instance, validated_data):
        meal_plans_data = validated_data.pop('meal_plans', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # BUG #2 FIX: instance.save() was previously called BEFORE the
        # transaction.atomic() block.  If any subsequent meal-plan or
        # food-item write raised an exception the header changes were already
        # committed with no rollback possible, leaving the NutritionPlan in an
        # inconsistent state.  Moving save() inside the atomic block (or
        # saving early when there are no meal-plan changes) ensures the entire
        # update either commits or rolls back as a single unit.
        if meal_plans_data is None:
            # No meal-plan payload at all — just update the header fields.
            # There is nothing else to be inconsistent with, so a standalone
            # save() here is safe and avoids an unnecessary transaction.
            instance.save()
            return instance

        with transaction.atomic():
            # Header save is now inside the transaction so any failure in the
            # meal-plan/food-item writes below rolls back this save too.
            instance.save()
            # تحسين الأداء: استعلام واحد لجلب كل الوجبات الحالية وحفظها في قاموس (Dictionary)
            existing_meals = {m.id: m for m in instance.meal_plans.prefetch_related('foods').all()}
            existing_meal_ids = set(existing_meals.keys())
            incoming_meal_ids = {item['id'] for item in meal_plans_data if item.get('id')}

            ids_to_delete = existing_meal_ids - incoming_meal_ids
            if ids_to_delete:
                MealPlan.objects.filter(id__in=ids_to_delete).delete()

            for meal_data in meal_plans_data:
                meal_id    = meal_data.get('id')
                foods_data = meal_data.pop('foods', [])

                if meal_id and meal_id in existing_meal_ids:
                    # استخدام القاموس من الذاكرة بدلاً من عمل استعلام جديد من قاعدة البيانات
                    meal_obj = existing_meals[meal_id]
                    for k, v in meal_data.items():
                        if k != 'id':
                            setattr(meal_obj, k, v)
                    meal_obj.save()
                else:
                    meal_data.pop('id', None)
                    meal_obj = MealPlan.objects.create(nutrition_plan=instance, **meal_data)

                # منطق تحديث أصناف الطعام (Food items)
                existing_food_ids  = set(meal_obj.foods.values_list('id', flat=True))
                incoming_food_ids  = {f['id'] for f in foods_data if f.get('id')}
                food_ids_to_delete = existing_food_ids - incoming_food_ids
                if food_ids_to_delete:
                    FoodItem.objects.filter(id__in=food_ids_to_delete).delete()

                foods_to_create = []
                for food_data in foods_data:
                    food_id = food_data.pop('id', None)
                    if food_id and food_id in existing_food_ids:
                        FoodItem.objects.filter(id=food_id).update(**food_data)
                    else:
                        foods_to_create.append(FoodItem(meal_plan=meal_obj, **food_data))

                if foods_to_create:
                    FoodItem.objects.bulk_create(foods_to_create)

        return instance

# ---------------------------------------------------------------------------
# NUTRITION – PROGRESS
# ---------------------------------------------------------------------------

class NutritionProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionProgress
        fields = '__all__'


# ---------------------------------------------------------------------------
# FOOD DATABASE
# ---------------------------------------------------------------------------

class FoodDatabaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodDatabase
        fields = '__all__'


# ---------------------------------------------------------------------------
# COACH SCHEDULE & GROUP TRAINING
# ---------------------------------------------------------------------------

class CoachScheduleSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source='client.name')
    client_photo = serializers.SerializerMethodField()
    # BUG-6 FIX: Explicitly declare client_id as a read-only field sourced from
    # client.id.  Without this explicit declaration DRF falls back to resolving
    # the FK column directly (obj.client_id), which works but is undeclared and
    # therefore fragile if the field name ever changes.
    client_id = serializers.ReadOnlyField(source='client.id')

    class Meta:
        model = CoachSchedule
        fields = ['id', 'coach', 'client', 'client_id', 'client_name', 'client_photo', 'day', 'session_time']

    def get_client_photo(self, obj):
        request = self.context.get('request')
        return _build_photo_url(request, obj.client.photo if obj.client else None)

    def validate(self, data):
        """
        FIX BUG-2 (Coach Schedule): التحقق من وجود اشتراك نشط للطفل مع المدرب
        قبل إضافته للجدول عند الإنشاء (POST) فقط.

        TrainerScheduleSerializer كان يتحقق من ذلك، لكن CoachScheduleSerializer
        لم يكن يتحقق — مما يسمح لأي طلب API مباشر بإضافة طفل منتهي اشتراكه.
        الفرونت إند يُصفّي activeChildren.filter(c => c.is_subscribed) لكن
        هذا الفلتر على مستوى الـ UI فقط، وليس حماية كافية على مستوى الـ API.

        التحقق مطلوب عند الإنشاء فقط — PATCH لتعديل session_time لا يحتاجه.
        """
        if self.instance:
            # تعديل على slot موجود (مثل تغيير session_time) — لا نعيد التحقق
            return data

        coach = data.get('coach')
        client = data.get('client')

        # BUG-S2 FIX: الكود السابق كان يتحقق من trainer=coach (اشتراك مع المدرب ده
        # تحديداً). هذا يخالف قاعدة العمل: أي مدرب يقدر يمرن عملاء المدربين الآخرين.
        # الإصلاح: نتحقق فقط من أن الطفل عنده اشتراك نشط (مع أي مدرب).
        if client:
            has_active = ClientSubscription.objects.filter(
                client=client,
                is_active=True,
            ).exists()
            if not has_active:
                raise serializers.ValidationError({
                    'client': (
                        'This child does not have an active subscription. '
                        'Only children with active subscriptions can be added to the schedule.'
                    )
                })

        return data


class GroupSessionParticipantSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source='client.name')
    client_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = GroupSessionParticipant
        fields = ['client_name', 'client_photo_url', 'note', 'deducted']

    def get_client_photo_url(self, obj):
        request = self.context.get('request')
        if obj.client:
            return _build_photo_url(request, obj.client.photo)
        return None


class GroupSessionLogSerializer(serializers.ModelSerializer):
    coach_name = serializers.ReadOnlyField(source='coach.first_name')
    coach_id = serializers.ReadOnlyField(source='coach.id')
    participants = GroupSessionParticipantSerializer(many=True, read_only=True)

    class Meta:
        model = GroupSessionLog
        fields = ['id', 'coach_name', 'coach_id', 'date', 'day_name', 'exercises_summary', 'participants']


class GroupWorkoutTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.first_name')

    class Meta:
        model = GroupWorkoutTemplate
        fields = ['id', 'name', 'exercises', 'created_by', 'created_by_name', 'created_at']


# ---------------------------------------------------------------------------
# SESSION TRANSFER
# ---------------------------------------------------------------------------

class SessionTransferRequestSerializer(serializers.ModelSerializer):
    from_trainer_name = serializers.ReadOnlyField(source='from_trainer.first_name')
    to_trainer_name = serializers.ReadOnlyField(source='to_trainer.first_name')
    client_name = serializers.ReadOnlyField(source='subscription.client.name')
    plan_name = serializers.ReadOnlyField(source='subscription.plan.name')
    client_photo = serializers.SerializerMethodField()

    class Meta:
        model = SessionTransferRequest
        fields = [
            'id', 'from_trainer', 'to_trainer', 'subscription',
            'from_trainer_name', 'to_trainer_name', 'client_name', 'plan_name', 'client_photo',
            'sessions_count', 'schedule_notes', 'status', 'created_at',
        ]
        read_only_fields = ['from_trainer', 'status', 'created_at']

    def get_client_photo(self, obj):
        request = self.context.get('request')
        try:
            photo = obj.subscription.client.photo
        except Exception:
            photo = None
        return _build_photo_url(request, photo)

    def validate(self, data):
        user = self.context['request'].user
        target_trainer = data.get('to_trainer')
        subscription = data.get('subscription')
        count = data.get('sessions_count')

        if target_trainer == user:
            raise serializers.ValidationError(
                {'to_trainer': 'You cannot transfer sessions to yourself.'}
            )

        # FIX #10: trainer is nullable — guard against None before comparing.
        # Without this, a subscription with trainer=None satisfies `None != user`
        # and any trainer could falsely "own" an unassigned subscription.
        if subscription.trainer is None or subscription.trainer != user:
            raise serializers.ValidationError(
                {'subscription': 'You do not own this client subscription.'}
            )

        if not subscription.is_active:
            raise serializers.ValidationError(
                {'subscription': 'Cannot transfer sessions from an inactive or expired subscription.'}
            )

        # FIX: التحقق من count <= 0 يجب أن يأتي أولاً قبل فحص remaining_sessions.
        # الترتيب السابق كان يفحص remaining أولاً — لو count = 0 يمر الفحص الأول
        # (0 > remaining = False) ثم يقع في count <= 0، لكن رسالة الخطأ في بعض
        # الحالات الحافّة (remaining=0, count=0) كانت مُضللة.
        # الترتيب الصحيح: اتحقق من القيمة أولاً ثم من التوافر.
        if count <= 0:
            raise serializers.ValidationError(
                {'sessions_count': 'You must transfer at least 1 session.'}
            )

        if subscription.plan and subscription.plan.units and subscription.plan.units > 0:
            remaining_sessions = subscription.plan.units - subscription.sessions_used
            if count > remaining_sessions:
                raise serializers.ValidationError({
                    'sessions_count': (
                        f'Client only has {remaining_sessions} sessions remaining. '
                        f'You cannot transfer {count}.'
                    )
                })

        return data


# ---------------------------------------------------------------------------
# MANUAL SAVES
# ---------------------------------------------------------------------------

class ManualNutritionSaveSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualNutritionSave
        fields = ['id', 'client_name', 'phone', 'plan_name', 'data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ManualWorkoutSaveSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualWorkoutSave
        fields = ['id', 'client_name', 'phone', 'session_name', 'data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


# ---------------------------------------------------------------------------
# TRAINER SHIFT
# ---------------------------------------------------------------------------

class TrainerShiftSerializer(serializers.ModelSerializer):
    trainer = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    trainer_name = serializers.SerializerMethodField()
    # Tells the frontend whether this shift crosses midnight so it can generate
    # time-slot grids correctly (e.g. 22:00 → 02:00 wraps over to the next day).
    is_overnight = serializers.SerializerMethodField()

    class Meta:
        model = TrainerShift
        fields = [
            'id',
            'trainer',
            'trainer_name',
            'shift_start',
            'shift_end',
            'slot_duration',
            'is_overnight',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']

    def get_trainer_name(self, obj):
        return obj.trainer.first_name or obj.trainer.username

    def get_is_overnight(self, obj):
        """True when the shift crosses midnight (shift_end < shift_start)."""
        if obj.shift_start and obj.shift_end:
            return obj.shift_end < obj.shift_start
        return False

    def validate(self, data):
        start = data.get('shift_start', getattr(self.instance, 'shift_start', None))
        end   = data.get('shift_end',   getattr(self.instance, 'shift_end',   None))

        if start and end:
            if end == start:
                raise serializers.ValidationError(
                    {'shift_end': 'Shift end cannot be the same as shift start.'}
                )
            # end < start is an overnight shift (e.g. 22:00 → 06:00).
            # Explicitly allowed — `is_overnight` signals this to the frontend.

        duration = data.get('slot_duration', getattr(self.instance, 'slot_duration', 60))
        if duration and (duration < 15 or duration > 240):
            raise serializers.ValidationError(
                {'slot_duration': 'Slot duration must be between 15 and 240 minutes.'}
            )
        return data


# ---------------------------------------------------------------------------
# TRAINER SCHEDULE
# ---------------------------------------------------------------------------

class TrainerScheduleSerializer(serializers.ModelSerializer):
    # trainer is optional in the payload; non-admins have it injected by the view.
    trainer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        default=serializers.CurrentUserDefault()
    )

    client_name  = serializers.ReadOnlyField(source='client.name')
    client_photo = serializers.SerializerMethodField()
    client_id    = serializers.ReadOnlyField(source='client.id')
    day_name     = serializers.SerializerMethodField()
    

    class Meta:
        model = TrainerSchedule
        fields = [
            'id',
            'trainer',
            'client',
            'client_id',
            'client_name',
            'client_photo',
            'day_of_week',
            'day_name',
            'time_slot',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_client_photo(self, obj):
        request = self.context.get('request')
        return _build_photo_url(request, obj.client.photo if obj.client else None)

    def get_day_name(self, obj):
        return dict(TrainerSchedule.DAY_CHOICES).get(obj.day_of_week, '')

    def validate(self, data):
        request = self.context.get('request')
        trainer = data.get('trainer') or getattr(self.instance, 'trainer', None)

        # BUG #2 FIX (corrected): الـ `trainer` field عنده `default=CurrentUserDefault()`.
        # هذا يعني إذا لم يُرسل الأدمن `trainer` في الـ payload، يحصل على
        # قيمة افتراضية = request.user (أي الأدمن نفسه) من الـ DRF default
        # قبل أن تصل قيمة data إلى validate() — مما يجعل `data.get('trainer')`
        # دائمًا truthy (تُعيد User object الأدمن وليس None)، وبالتالي
        # `if not explicit_trainer` لا تُفعَّل أبدًا وتتجاوز الـ validation.
        #
        # الإصلاح الصحيح: نستخدم `self.initial_data` التي تحتوي على الـ payload
        # الخام قبل تطبيق أي defaults — وهي المصدر الوحيد الموثوق لمعرفة
        # إذا كان الأدمن أرسل trainer بشكل صريح أم لا.
        if request and hasattr(request, 'user') and request.user.is_superuser:
            explicit_trainer = self.initial_data.get('trainer')
            if not explicit_trainer:
                raise serializers.ValidationError(
                    {'trainer': 'Admin must explicitly specify the trainer field.'}
                )
        elif not trainer and request and hasattr(request, 'user'):
            # المدرب العادي: يحصل على trainer من request.user تلقائيًا
            trainer = request.user

        client = data.get('client') or getattr(self.instance, 'client', None)

        # BUG-S1 FIX: الكود السابق كان يتحقق من وجود اشتراك نشط بين العميل
        # والمدرب المحدد (trainer=trainer). هذا يخالف قاعدة العمل الأساسية:
        # "أي مدرب يقدر يمرن عملاء المدربين الآخرين عادي."
        # الإصلاح: نتحقق فقط من أن العميل عنده اشتراك نشط (مع أي مدرب)،
        # بدلاً من اشتراط أن يكون الاشتراك مع المدرب الحالي تحديداً.
        if client:
            has_active = ClientSubscription.objects.filter(
                client=client,
                is_active=True,
            ).exists()
            if not has_active:
                raise serializers.ValidationError({
                    'client': (
                        'This client does not have an active subscription. '
                        'Only clients with active subscriptions can be added to the schedule.'
                    )
                })

        return data