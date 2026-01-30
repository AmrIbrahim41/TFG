from rest_framework import serializers
from .models import *



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
        ]

    def get_photo_url(self, obj):
        if obj.photo:
            return obj.photo.url
        return None

    def get_is_subscribed(self, obj):
        # Returns True if there is at least one active subscription
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


from .models import TrainingSession, SessionExercise, SessionSet # Import

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
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
# Add these serializers to your serializers.py file


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
    created_by_name = serializers.ReadOnlyField(source='created_by.first_name') 
    client_name = serializers.ReadOnlyField(source='subscription.client.name')

    class Meta:
        model = NutritionPlan
        fields = [
            'id', 'subscription', 'client_name', 'name', 'duration_weeks',
            'calc_weight', 'calc_tdee', 'calc_defer_cal', 'calc_fat_percent',
            'calc_protein_multiplier', 'calc_protein_advance', 'calc_meals', 'calc_snacks',
            'target_calories', 'target_protein', 'target_carbs', 'target_fats',
            'notes', 'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]


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
            'day', 'meal_type', 'meal_name', 'meal_time', 
            'total_calories', 'total_protein', 'total_carbs', 'total_fats',
            'notes', 'foods'
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
            'calc_weight', 'calc_tdee', 'calc_defer_cal', 'calc_fat_percent',
            'calc_protein_multiplier', 'calc_protein_advance', 'calc_meals', 'calc_snacks',
            'target_calories', 'target_protein', 'target_carbs', 'target_fats',
            'meal_plans' # <--- Ensure this is included
        ]
    
    def create(self, validated_data):
        meal_plans_data = validated_data.pop('meal_plans', [])
        nutrition_plan = NutritionPlan.objects.create(**validated_data)
        
        for meal_data in meal_plans_data:
            foods_data = meal_data.pop('foods', [])
            meal_plan = MealPlan.objects.create(nutrition_plan=nutrition_plan, **meal_data)
            for food_data in foods_data:
                FoodItem.objects.create(meal_plan=meal_plan, **food_data)
        
        return nutrition_plan

    # --- NEW: ADD THIS UPDATE METHOD ---
    def update(self, instance, validated_data):
        # 1. Update standard fields
        instance.name = validated_data.get('name', instance.name)
        instance.duration_weeks = validated_data.get('duration_weeks', instance.duration_weeks)
        
        # Update Calculator Targets
        instance.target_calories = validated_data.get('target_calories', instance.target_calories)
        instance.target_protein = validated_data.get('target_protein', instance.target_protein)
        instance.target_carbs = validated_data.get('target_carbs', instance.target_carbs)
        instance.target_fats = validated_data.get('target_fats', instance.target_fats)
        
        # Update Calculator State
        instance.calc_weight = validated_data.get('calc_weight', instance.calc_weight)
        instance.calc_tdee = validated_data.get('calc_tdee', instance.calc_tdee)
        instance.calc_defer_cal = validated_data.get('calc_defer_cal', instance.calc_defer_cal)
        instance.calc_fat_percent = validated_data.get('calc_fat_percent', instance.calc_fat_percent)
        instance.calc_protein_multiplier = validated_data.get('calc_protein_multiplier', instance.calc_protein_multiplier)
        instance.calc_protein_advance = validated_data.get('calc_protein_advance', instance.calc_protein_advance)
        instance.calc_meals = validated_data.get('calc_meals', instance.calc_meals)
        instance.calc_snacks = validated_data.get('calc_snacks', instance.calc_snacks)
        
        instance.save()

        # 2. Handle Nested Meal Plans (The "Save Meals" Logic)
        if 'meal_plans' in validated_data:
            meal_plans_data = validated_data.pop('meal_plans')
            
            # Wipe existing meals for this plan to avoid duplicates
            instance.meal_plans.all().delete()
            
            # Re-create meals from the new data
            for meal_data in meal_plans_data:
                foods_data = meal_data.pop('foods', [])
                meal_plan = MealPlan.objects.create(nutrition_plan=instance, **meal_data)
                
                for food_data in foods_data:
                    FoodItem.objects.create(meal_plan=meal_plan, **food_data)
                    
        return instance
