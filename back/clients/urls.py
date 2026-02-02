from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    
)

router = DefaultRouter()
router.register(r'clients', ClientViewSet)
router.register(r'manage-trainers', ManageTrainersViewSet, basename='manage-trainers') 
router.register(r'client-subscriptions', ClientSubscriptionViewSet, basename='client-subscriptions')
router.register(r'training-plans', TrainingPlanViewSet, basename='training-plans')
router.register(r'exercises', TrainingExerciseViewSet, basename='exercises')
router.register(r'session-logs', SessionLogViewSet, basename='session-logs')
router.register(r'training-sessions', TrainingSessionViewSet, basename='training-sessions')
# Nutrition related routes
router.register(r'nutrition-plans', NutritionPlanViewSet, basename='nutrition-plans')
router.register(r'meal-plans', MealPlanViewSet, basename='meal-plans')
router.register(r'food-items', FoodItemViewSet, basename='food-items')
router.register(r'nutrition-progress', NutritionProgressViewSet, basename='nutrition-progress')
router.register(r'food-database', FoodDatabaseViewSet, basename='food-database')
router.register(r'dashboard', DashboardAnalyticsViewSet, basename='dashboard')
router.register(r'subscriptions', SubscriptionViewSet, basename='subscription')
router.register(r'countries', CountryViewSet, basename='countries')

router.register(r'coach-schedules', CoachScheduleViewSet, basename='coach-schedules')
router.register(r'group-training', GroupTrainingViewSet, basename='group-training')
router.register(r'group-templates', GroupWorkoutTemplateViewSet, basename='group-templates')
router.register(r'transfers', SessionTransferRequestViewSet, basename='transfers')



urlpatterns = [
    path('', include(router.urls)),
    # Auth Routes
    path('auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
]