from rest_framework import viewsets, permissions, filters
from rest_framework.pagination import PageNumberPagination

from ..models import NutritionPlan, MealPlan, FoodItem, NutritionProgress, FoodDatabase
from ..serializers import (
    NutritionPlanSerializer,
    NutritionPlanCreateSerializer,
    MealPlanSerializer,
    FoodItemSerializer,
    NutritionProgressSerializer,
    FoodDatabaseSerializer,
)


class FoodDatabasePagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 500


class NutritionPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return NutritionPlanCreateSerializer
        return NutritionPlanSerializer

    def get_queryset(self):
        qs = (
            NutritionPlan.objects
            .select_related('subscription__client', 'subscription__plan', 'created_by')
            .prefetch_related('meal_plans__foods')
        )

        client_id = self.request.query_params.get("client_id")
        if client_id:
            return qs.filter(subscription__client_id=client_id)

        subscription_id = self.request.query_params.get("subscription_id")
        if subscription_id:
            return qs.filter(subscription_id=subscription_id)

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MealPlanViewSet(viewsets.ModelViewSet):
    serializer_class = MealPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        nutrition_plan_id = self.request.query_params.get("nutrition_plan_id")
        if nutrition_plan_id:
            return MealPlan.objects.filter(
                nutrition_plan_id=nutrition_plan_id
            ).prefetch_related('foods')
        return MealPlan.objects.all().prefetch_related('foods')


class FoodItemViewSet(viewsets.ModelViewSet):
    serializer_class = FoodItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        meal_plan_id = self.request.query_params.get("meal_plan_id")
        if meal_plan_id:
            return FoodItem.objects.filter(meal_plan_id=meal_plan_id)
        return FoodItem.objects.all()


class NutritionProgressViewSet(viewsets.ModelViewSet):
    serializer_class = NutritionProgressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        nutrition_plan_id = self.request.query_params.get("nutrition_plan_id")
        if nutrition_plan_id:
            return NutritionProgress.objects.filter(nutrition_plan_id=nutrition_plan_id)
        return NutritionProgress.objects.all()


class FoodDatabaseViewSet(viewsets.ModelViewSet):
    serializer_class = FoodDatabaseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "arabic_name", "category"]
    pagination_class = FoodDatabasePagination

    def get_queryset(self):
        qs = FoodDatabase.objects.all().order_by("name")
        category = self.request.query_params.get("category")
        if category and category != "All":
            qs = qs.filter(category=category)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
