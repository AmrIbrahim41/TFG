from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import *

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

# ── NEW: Trainer Shift & Weekly Schedule ─────────────────────────────────────
# Trainer shift (working hours):
#   GET    /api/trainer-shift/mine/           → get own shift
#   PUT    /api/trainer-shift/mine/           → update own shift
#   GET    /api/trainer-shift/?trainer_id=5   → admin: get shift for trainer 5
router.register(r'trainer-shift', TrainerShiftViewSet, basename='trainer-shift')

# Trainer weekly schedule slots:
#   GET    /api/trainer-schedule/                      → own slots
#   GET    /api/trainer-schedule/?trainer_id=5         → admin: slots for trainer 5
#   GET    /api/trainer-schedule/active-clients/       → eligible clients
#   GET    /api/trainer-schedule/active-clients/?trainer_id=5 → admin: eligible clients
#   POST   /api/trainer-schedule/                      → create slot
#   DELETE /api/trainer-schedule/{id}/                 → remove slot
router.register(r'trainer-schedule', TrainerScheduleViewSet, basename='trainer-schedule')

# Admin Trainer Oversight:
#   GET /api/admin-trainer-oversight/{trainer_id}/details/       → full overview
#   GET /api/admin-trainer-oversight/{trainer_id}/mini-dashboard/ → chart only
router.register(r'admin-trainer-oversight', AdminTrainerOversightViewSet, basename='admin-trainer-oversight')

urlpatterns = [
    path('', include(router.urls)),
    # ── Auth ────────────────────────────────────────────────────────────────
    path('auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # BUG-2 FIX: WorkoutEditor.jsx calls GET /auth/users/me/ to get the logged-in
    # user's id for the isReadOnly guard. This endpoint was missing entirely,
    # causing a 404 that was swallowed silently, leaving currentUserId as null
    # and permanently disabling the read-only protection on completed sessions.
    path('auth/users/me/', CurrentUserView.as_view(), name='current_user'),
]