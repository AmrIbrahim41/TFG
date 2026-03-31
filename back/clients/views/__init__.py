"""
views/__init__.py — re-exports every ViewSet and view so that urls.py
can import from `clients.views` directly.
"""

from .utils import StandardResultsSetPagination, HistoryPagination

from .auth import LoginRateThrottle, MyTokenObtainPairSerializer, MyTokenObtainPairView, CurrentUserView

from .clients import ClientViewSet, ManageTrainersViewSet

from .subscriptions import SubscriptionViewSet, ClientSubscriptionViewSet, CountryViewSet

from .dashboard import DashboardAnalyticsViewSet

from .training import (
    TrainingSessionFilter,
    TrainingPlanViewSet,
    TrainingExerciseViewSet,
    SessionLogViewSet,
    TrainingSessionViewSet,
)

from .nutrition import (
    NutritionPlanViewSet,
    MealPlanViewSet,
    FoodItemViewSet,
    NutritionProgressViewSet,
    FoodDatabaseViewSet,
)

from .group import CoachScheduleViewSet, GroupTrainingViewSet, GroupWorkoutTemplateViewSet

from .schedule import TrainerShiftViewSet, TrainerScheduleViewSet

from .transfers import SessionTransferRequestViewSet

from .manual_saves import ManualNutritionSaveViewSet, ManualWorkoutSaveViewSet

from .admin_oversight import AdminTrainerOversightViewSet

__all__ = [
    'StandardResultsSetPagination', 'HistoryPagination',
    'LoginRateThrottle', 'MyTokenObtainPairSerializer',
    'MyTokenObtainPairView', 'CurrentUserView',
    'ClientViewSet', 'ManageTrainersViewSet',
    'SubscriptionViewSet', 'ClientSubscriptionViewSet', 'CountryViewSet',
    'DashboardAnalyticsViewSet',
    'TrainingSessionFilter', 'TrainingPlanViewSet', 'TrainingExerciseViewSet',
    'SessionLogViewSet', 'TrainingSessionViewSet',
    'NutritionPlanViewSet', 'MealPlanViewSet', 'FoodItemViewSet',
    'NutritionProgressViewSet', 'FoodDatabaseViewSet',
    'CoachScheduleViewSet', 'GroupTrainingViewSet', 'GroupWorkoutTemplateViewSet',
    'TrainerShiftViewSet', 'TrainerScheduleViewSet',
    'SessionTransferRequestViewSet',
    'ManualNutritionSaveViewSet', 'ManualWorkoutSaveViewSet',
    'AdminTrainerOversightViewSet',
]
