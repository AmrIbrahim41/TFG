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
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
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
    trainer_name = serializers.ReadOnlyField(source='trainer.first_name')
    client_name = serializers.ReadOnlyField(source='client.name')

    class Meta:
        model = ClientSubscription
        fields = '__all__'

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

    class Meta:
        model = TrainingPlan
        fields = ['id', 'subscription', 'cycle_length', 'created_at', 'splits']


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
    exercises = SessionExerciseSerializer(many=True, read_only=True)
    trainer_name = serializers.ReadOnlyField(source='completed_by.first_name')
    completed_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = TrainingSession
        fields = [
            'id', 'subscription', 'session_number', 'name', 'is_completed',
            'date_completed', 'exercises', 'trainer_name', 'completed_by',
        ]


# ---------------------------------------------------------------------------
# NUTRITION – FOOD ITEM
# ---------------------------------------------------------------------------

class FoodItemSerializer(serializers.ModelSerializer):
    # Expose `id` as an optional writable field so the NutritionPlan update
    # serializer can distinguish "update this existing item" from "create new".
    id = serializers.IntegerField(required=False)

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
            FoodItem.objects.create(meal_plan=meal_plan, **food_data)
        return meal_plan


# ---------------------------------------------------------------------------
# NUTRITION – NUTRITION PLAN (read)
# ---------------------------------------------------------------------------

class NutritionPlanSerializer(serializers.ModelSerializer):
    meal_plans = MealPlanSerializer(many=True, read_only=True)
    client_name = serializers.ReadOnlyField(source='subscription.client.name')

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
            'meal_plans', 'client_name', 'created_at', 'updated_at',
        ]


# ---------------------------------------------------------------------------
# NUTRITION – NUTRITION PLAN (create / update)
# ---------------------------------------------------------------------------

class NutritionPlanCreateSerializer(serializers.ModelSerializer):
    meal_plans = MealPlanCreateSerializer(many=True, required=False)

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
                food_items_to_create.append(FoodItem(meal_plan=meal_plan, **food_data))

        if food_items_to_create:
            FoodItem.objects.bulk_create(food_items_to_create)

        return nutrition_plan

    def update(self, instance, validated_data):
        meal_plans_data = validated_data.pop('meal_plans', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if meal_plans_data is None:
            return instance

        with transaction.atomic():
            existing_meal_ids = set(instance.meal_plans.values_list('id', flat=True))
            incoming_meal_ids = {item['id'] for item in meal_plans_data if item.get('id')}

            ids_to_delete = existing_meal_ids - incoming_meal_ids
            if ids_to_delete:
                MealPlan.objects.filter(id__in=ids_to_delete).delete()

            for meal_data in meal_plans_data:
                meal_id    = meal_data.get('id')
                foods_data = meal_data.pop('foods', [])

                if meal_id and meal_id in existing_meal_ids:
                    meal_obj = MealPlan.objects.get(id=meal_id)
                    for k, v in meal_data.items():
                        if k != 'id':
                            setattr(meal_obj, k, v)
                    meal_obj.save()
                else:
                    meal_data.pop('id', None)
                    meal_obj = MealPlan.objects.create(nutrition_plan=instance, **meal_data)

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

    class Meta:
        model = CoachSchedule
        fields = ['id', 'coach', 'client', 'client_id', 'client_name', 'client_photo', 'day', 'session_time']

    def get_client_photo(self, obj):
        request = self.context.get('request')
        return _build_photo_url(request, obj.client.photo if obj.client else None)


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

        if subscription.plan and subscription.plan.units and subscription.plan.units > 0:
            remaining_sessions = subscription.plan.units - subscription.sessions_used
            if count > remaining_sessions:
                raise serializers.ValidationError({
                    'sessions_count': (
                        f'Client only has {remaining_sessions} sessions remaining. '
                        f'You cannot transfer {count}.'
                    )
                })

        if count <= 0:
            raise serializers.ValidationError(
                {'sessions_count': 'You must transfer at least 1 session.'}
            )

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

        # For non-admin trainers, resolve trainer from the authenticated request
        # user when not explicitly provided in the payload.
        if not trainer and request and hasattr(request, 'user') and not request.user.is_superuser:
            trainer = request.user

        client = data.get('client') or getattr(self.instance, 'client', None)

        if trainer and client:
            has_active = ClientSubscription.objects.filter(
                client=client,
                trainer=trainer,
                is_active=True,
            ).exists()
            if not has_active:
                raise serializers.ValidationError({
                    'client': (
                        'This client does not have an active subscription with this trainer. '
                        'Only clients with active subscriptions can be added to the schedule.'
                    )
                })

        return data