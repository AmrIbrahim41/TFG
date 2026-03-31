from django.db import transaction
from rest_framework import serializers

from ..models import FoodItem, MealPlan, NutritionPlan, NutritionProgress, FoodDatabase


class FoodItemSerializer(serializers.ModelSerializer):
    # Expose `id` as optional writable to distinguish update vs. create in nested writes.
    id = serializers.IntegerField(required=False)
    # read_only suppresses the FK validation requirement for nested creation.
    meal_plan = serializers.PrimaryKeyRelatedField(read_only=True)

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
            food_data.pop('id', None)
            FoodItem.objects.create(meal_plan=meal_plan, **food_data)
        return meal_plan


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
            'notes',
            'meal_plans', 'client_name', 'created_by_name', 'created_at', 'updated_at',
        ]

    def get_created_by_name(self, obj):
        user = getattr(obj, 'created_by', None)
        if not user:
            return None
        return user.first_name or user.username


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
            'notes',
            'meal_plans',
            'created_by_name',
        ]

    def get_created_by_name(self, obj):
        user = getattr(obj, 'created_by', None)
        if not user:
            return None
        return user.first_name or user.username

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
                food_data.pop('id', None)
                food_items_to_create.append(FoodItem(meal_plan=meal_plan, **food_data))

        if food_items_to_create:
            FoodItem.objects.bulk_create(food_items_to_create)

        return nutrition_plan

    def update(self, instance, validated_data):
        meal_plans_data = validated_data.pop('meal_plans', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if meal_plans_data is None:
            instance.save()
            return instance

        with transaction.atomic():
            instance.save()
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
                    meal_obj = existing_meals[meal_id]
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


class NutritionProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionProgress
        fields = '__all__'


class FoodDatabaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodDatabase
        fields = '__all__'
