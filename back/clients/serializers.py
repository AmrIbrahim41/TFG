from rest_framework import serializers
from .models import *
from django.db.models import Sum, Count
from .models import *
import datetime
from django.db.models.functions import TruncDay
from django.db import transaction


class ClientSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    age = serializers.ReadOnlyField()
    is_subscribed = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            "id",
            "name",
            "manual_id",
            "phone",
            "photo",
            "photo_url",
            "created_at",
            "nature_of_work",
            "birth_date",
            "age",
            "address",
            "status",
            "smoking",
            "sleep_hours",
            "notes",
            "is_subscribed",
            "is_child",
            "parent_phone",
            "country",
            "trained_gym_before",
            "trained_coach_before",
            "injuries",
        ]

    def get_photo_url(self, obj):
        if obj.photo:
            return obj.photo.url
        return None

    def get_is_subscribed(self, obj):
     return obj.subscriptions.filter(is_active=True).exists()

    # --- NEW SECURITY RULE ---
    def validate(self, data):
        # Get the user making the request
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            user = request.user

            # If the user is NOT an admin (superuser)
            if not user.is_superuser and self.instance:
                # Check if they are trying to change the Name
                if "name" in data and data["name"] != self.instance.name:
                    raise serializers.ValidationError(
                        {"name": "Only Admins can edit the Name."}
                    )

                # Check if they are trying to change the ID
                if "manual_id" in data and data["manual_id"] != self.instance.manual_id:
                    raise serializers.ValidationError(
                        {"manual_id": "Only Admins can edit the ID."}
                    )

        return data


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = "__all__"



class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'



class ClientSubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.ReadOnlyField(source="plan.name")
    plan_total_sessions = serializers.ReadOnlyField(
        source="plan.units"
    )  # To show "Used / Total"
    trainer_name = serializers.ReadOnlyField(
        source="trainer.username"
    )  # To display trainer name

    # NEW: Expose client name for easier frontend access
    client_name = serializers.ReadOnlyField(source="client.name")

    class Meta:
        model = ClientSubscription
        fields = "__all__"

    # STRICT VALIDATION: Only one active sub allowed
    def validate(self, data):
        # If we are creating a NEW active sub or updating one to be active
        if data.get("is_active", True):
            client = data.get("client") or self.instance.client

            # Check for ANY active subscription for this client
            active_subs = ClientSubscription.objects.filter(
                client=client, is_active=True
            )

            # If updating, exclude the current one from the check
            if self.instance:
                active_subs = active_subs.exclude(id=self.instance.id)

            if active_subs.exists():
                raise serializers.ValidationError(
                    {
                        "is_active": "This client already has an active subscription. Deactivate the old one first."
                    }
                )

        return data


class TrainingSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingSet
        fields = '__all__'

class TrainingExerciseSerializer(serializers.ModelSerializer):
    sets = TrainingSetSerializer(many=True, read_only=True) # Nested Sets

    class Meta:
        model = TrainingExercise
        fields = ['id', 'split', 'order', 'name', 'note', 'sets']

class SessionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionLog
        fields = '__all__'


class TrainingDaySplitSerializer(serializers.ModelSerializer):
    exercises = TrainingExerciseSerializer(many=True, read_only=True)  # Nested list

    class Meta:
        model = TrainingDaySplit
        fields = ["id", "order", "name", "exercises"]


class TrainingPlanSerializer(serializers.ModelSerializer):
    splits = TrainingDaySplitSerializer(many=True, read_only=True)

    class Meta:
        model = TrainingPlan
        fields = ["id", "subscription", "cycle_length", "created_at", "splits"]


class SessionSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionSet
        fields = '__all__'

class SessionExerciseSerializer(serializers.ModelSerializer):
    sets = SessionSetSerializer(many=True, read_only=True)
    class Meta:
        model = SessionExercise
        fields = ['id', 'order', 'name', 'sets']

class TrainingSessionSerializer(serializers.ModelSerializer):
    exercises = SessionExerciseSerializer(many=True, read_only=True)
    # NEW: Fetch the trainer name from the completed_by field
    trainer_name = serializers.ReadOnlyField(source='completed_by.first_name') 

    class Meta:
        model = TrainingSession
        fields = ['id', 'subscription', 'session_number', 'name', 'is_completed', 'date_completed', 'exercises', 'trainer_name']


class FoodItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodItem
        fields = '__all__'


class MealPlanSerializer(serializers.ModelSerializer):
    foods = FoodItemSerializer(many=True, read_only=True)
    meal_type_display = serializers.CharField(source='get_meal_type_display', read_only=True)
    
    class Meta:
        model = MealPlan
        fields = [
            'id', 'nutrition_plan', 'day', 'meal_type', 'meal_type_display',
            'meal_name', 'meal_time', 'total_calories', 'total_protein',
            'total_carbs', 'total_fats', 'notes', 'is_completed',
            'completed_at', 'photo', 'foods', 'created_at', 'updated_at'
        ]


class NutritionPlanSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()  # username of card creator
    client_name = serializers.ReadOnlyField(source='subscription.client.name')
    client_age = serializers.SerializerMethodField()

    class Meta:
        model = NutritionPlan
        fields = [
            'id', 'subscription', 'client_name', 'client_age', 'name', 'duration_weeks',
            'calc_gender', 'calc_age', 'calc_height', 'calc_weight', 'calc_activity_level',
            'calc_tdee', 'calc_defer_cal', 'calc_fat_percent',
            'calc_protein_multiplier', 'calc_protein_advance', 'calc_meals', 'calc_snacks',
            # NEW FIELDS ADDED HERE
            'calc_carb_adjustment', 'pdf_brand_text',
            'target_calories', 'target_protein', 'target_carbs', 'target_fats',
            'notes', 'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.username if obj.created_by else None

    def get_client_age(self, obj):
        client = getattr(obj.subscription, 'client', None)
        return client.age if client else None


class NutritionProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionProgress
        fields = '__all__'


class FoodDatabaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodDatabase
        fields = '__all__'


# Nested Serializer for Creating Meal Plans with Foods
class FoodItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodItem
        fields = ['name', 'quantity', 'unit', 'calories', 'protein', 'carbs', 'fats', 'fiber', 'category', 'preparation', 'order']


class MealPlanCreateSerializer(serializers.ModelSerializer):
    foods = FoodItemCreateSerializer(many=True, required=False)

    class Meta:
        model = MealPlan
        fields = [
            'nutrition_plan', 'day', 'meal_type', 'meal_name', 'meal_time',
            'total_calories', 'total_protein', 'total_carbs', 'total_fats',
            'notes', 'foods',
        ]

    def create(self, validated_data):
        foods_data = validated_data.pop('foods', [])
        meal_plan = MealPlan.objects.create(**validated_data)
        
        # Create associated food items
        for food_data in foods_data:
            FoodItem.objects.create(meal_plan=meal_plan, **food_data)
        
        return meal_plan





class NutritionPlanCreateSerializer(serializers.ModelSerializer):
    meal_plans = MealPlanCreateSerializer(many=True, required=False)
    
    class Meta:
        model = NutritionPlan
        fields = [
            'subscription', 'name', 'duration_weeks',
            'calc_gender', 'calc_age', 'calc_height', 'calc_weight', 'calc_activity_level',
            'calc_tdee', 'calc_defer_cal', 'calc_fat_percent',
            'calc_protein_multiplier', 'calc_protein_advance', 'calc_meals', 'calc_snacks',
            'calc_carb_adjustment', 'pdf_brand_text',
            'target_calories', 'target_protein', 'target_carbs', 'target_fats',
            'meal_plans'
        ]
    
    def create(self, validated_data):
        meal_plans_data = validated_data.pop('meal_plans', [])
        # Set defaults if missing
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
        # Update standard fields
        for attr, value in validated_data.items():
            if attr != 'meal_plans':
                setattr(instance, attr, value)
        instance.save()

        # FIX: Smart Update for Nested Meal Plans
        if 'meal_plans' in validated_data:
            meal_plans_data = validated_data.pop('meal_plans')
            
            with transaction.atomic():
                # 1. Get existing IDs
                existing_ids = [m.id for m in instance.meal_plans.all()]
                incoming_ids = [item.get('id') for item in meal_plans_data if item.get('id')]
                
                # 2. Delete removed meals
                for existing_id in existing_ids:
                    if existing_id not in incoming_ids:
                        MealPlan.objects.filter(id=existing_id).delete()
                
                # 3. Update or Create
                for meal_data in meal_plans_data:
                    meal_id = meal_data.get('id')
                    foods_data = meal_data.pop('foods', [])
                    
                    if meal_id and meal_id in existing_ids:
                        # Update Existing Meal
                        meal_obj = MealPlan.objects.get(id=meal_id)
                        for k, v in meal_data.items():
                            setattr(meal_obj, k, v)
                        meal_obj.save()
                        
                        # Handle Foods for this meal (Simple Replace Strategy for foods is usually safer unless fine-grained needed)
                        meal_obj.foods.all().delete()
                        FoodItem.objects.bulk_create([FoodItem(meal_plan=meal_obj, **f) for f in foods_data])
                        
                    else:
                        # Create New Meal
                        meal_obj = MealPlan.objects.create(nutrition_plan=instance, **meal_data)
                        FoodItem.objects.bulk_create([FoodItem(meal_plan=meal_obj, **f) for f in foods_data])
                    
        return instance
    
    


class CoachScheduleSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source='client.name')
    client_photo = serializers.SerializerMethodField()
    
    class Meta:
        model = CoachSchedule
        fields = ['id', 'coach', 'client', 'client_id', 'client_name', 'client_photo', 'day']

    def get_client_photo(self, obj):
        return obj.client.photo.url if obj.client.photo else None

class GroupSessionParticipantSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source='client.name')
    class Meta:
        model = GroupSessionParticipant
        fields = ['client_name', 'note', 'deducted']

class GroupSessionLogSerializer(serializers.ModelSerializer):
    coach_name = serializers.ReadOnlyField(source='coach.first_name')
    # Nested serializer to show participants details inside the log
    participants = GroupSessionParticipantSerializer(many=True, read_only=True)
    
    class Meta:
        model = GroupSessionLog
        fields = [
            'id', 
            'coach_name', 
            'date', 
            'day_name', 
            'exercises_summary', 
            'participants'
        ]
        
        
        
# ... existing code ...

class GroupWorkoutTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.first_name')

    class Meta:
        model = GroupWorkoutTemplate
        fields = ['id', 'name', 'exercises', 'created_by', 'created_by_name', 'created_at']
        
        
        
        
        
        
        
# In serializers.py

# In serializers.py

# --- serializers.py ---

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
            'sessions_count', 'schedule_notes', 'status', 'created_at'
        ]
        # CRITICAL FIX: These fields are managed by the backend, so Frontend doesn't need to send them.
        read_only_fields = ['from_trainer', 'status', 'created_at']

    def get_client_photo(self, obj):
        if obj.subscription.client.photo:
            return obj.subscription.client.photo.url
        return None

    # --- STRICT VALIDATIONS ---
    def validate(self, data):
        user = self.context['request'].user
        target_trainer = data.get('to_trainer')
        subscription = data.get('subscription')
        count = data.get('sessions_count')

        # 1. Prevent Self-Transfer
        if target_trainer == user:
            raise serializers.ValidationError({"to_trainer": "You cannot transfer sessions to yourself."})

        # 2. Verify Ownership (Security)
        if subscription.trainer != user:
            raise serializers.ValidationError({"subscription": "You do not own this client subscription."})

        # 3. Verify Active Status
        if not subscription.is_active:
            raise serializers.ValidationError({"subscription": "Cannot transfer sessions from an inactive or expired subscription."})

        # 4. Check Session Balance (Math Check)
        if subscription.plan:
            remaining_sessions = subscription.plan.units - subscription.sessions_used
            if count > remaining_sessions:
                raise serializers.ValidationError({
                    "sessions_count": f"Client only has {remaining_sessions} sessions remaining. You cannot transfer {count}."
                })
        
        # 5. Sanity Check
        if count <= 0:
            raise serializers.ValidationError({"sessions_count": "You must transfer at least 1 session."})

        return data
    
    
    
    
# serializers.py

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