from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    # Auth
    MyTokenObtainPairView,
    CurrentUserView,
    # Clients & Trainers
    ClientViewSet,
    ManageTrainersViewSet,
    # Subscriptions
    ClientSubscriptionViewSet,
    SubscriptionViewSet,
    CountryViewSet,
    # Training
    TrainingPlanViewSet,
    TrainingExerciseViewSet,
    SessionLogViewSet,
    TrainingSessionViewSet,
    # Nutrition
    NutritionPlanViewSet,
    MealPlanViewSet,
    FoodItemViewSet,
    NutritionProgressViewSet,
    FoodDatabaseViewSet,
    # Dashboard
    DashboardAnalyticsViewSet,
    # Group & Schedule
    CoachScheduleViewSet,
    GroupTrainingViewSet,
    GroupWorkoutTemplateViewSet,
    TrainerShiftViewSet,
    TrainerScheduleViewSet,
    # Transfers
    SessionTransferRequestViewSet,
    # Manual saves
    ManualNutritionSaveViewSet,
    ManualWorkoutSaveViewSet,
    # Admin
    AdminTrainerOversightViewSet,
)

router = DefaultRouter()

# ── Core ────────────────────────────────────────────────────────────────────
router.register(r'clients', ClientViewSet, basename='clients')
router.register(r'manage-trainers', ManageTrainersViewSet, basename='manage-trainers')
router.register(r'client-subscriptions', ClientSubscriptionViewSet, basename='client-subscriptions')
router.register(r'subscriptions', SubscriptionViewSet, basename='subscription')
router.register(r'countries', CountryViewSet, basename='countries')

# ── Training ─────────────────────────────────────────────────────────────────
router.register(r'training-plans', TrainingPlanViewSet, basename='training-plans')
router.register(r'exercises', TrainingExerciseViewSet, basename='exercises')
router.register(r'session-logs', SessionLogViewSet, basename='session-logs')
router.register(r'training-sessions', TrainingSessionViewSet, basename='training-sessions')

# ── Nutrition ────────────────────────────────────────────────────────────────
router.register(r'nutrition-plans', NutritionPlanViewSet, basename='nutrition-plans')
router.register(r'meal-plans', MealPlanViewSet, basename='meal-plans')
router.register(r'food-items', FoodItemViewSet, basename='food-items')
router.register(r'nutrition-progress', NutritionProgressViewSet, basename='nutrition-progress')
router.register(r'food-database', FoodDatabaseViewSet, basename='food-database')

# ── Dashboard ────────────────────────────────────────────────────────────────
router.register(r'dashboard', DashboardAnalyticsViewSet, basename='dashboard')

# ── Group & Schedule ─────────────────────────────────────────────────────────
router.register(r'coach-schedules', CoachScheduleViewSet, basename='coach-schedules')
router.register(r'group-training', GroupTrainingViewSet, basename='group-training')
router.register(r'group-templates', GroupWorkoutTemplateViewSet, basename='group-templates')

# ── Transfers ────────────────────────────────────────────────────────────────
router.register(r'transfers', SessionTransferRequestViewSet, basename='transfers')

# ── Manual offline saves ─────────────────────────────────────────────────────
router.register(r'manual-nutrition', ManualNutritionSaveViewSet, basename='manual-nutrition')
router.register(r'manual-workouts', ManualWorkoutSaveViewSet, basename='manual-workouts')

# ── Trainer Shift & Weekly Schedule ─────────────────────────────────────────
router.register(r'trainer-shift', TrainerShiftViewSet, basename='trainer-shift')
router.register(r'trainer-schedule', TrainerScheduleViewSet, basename='trainer-schedule')

# ── Admin Trainer Oversight ──────────────────────────────────────────────────
router.register(r'admin-trainer-oversight', AdminTrainerOversightViewSet, basename='admin-trainer-oversight')

urlpatterns = [
    path('', include(router.urls)),
    # Auth
    path('auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/users/me/', CurrentUserView.as_view(), name='current_user'),
]
