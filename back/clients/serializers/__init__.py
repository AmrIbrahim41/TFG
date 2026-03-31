"""
serializers/__init__.py — re-exports every serializer so that views can use
`from .serializers import SomeSerializer` without change.
"""

from .utils import _build_photo_url

from .auth import TrainerSerializer, TrainerPublicSerializer

from .client import (
    ClientSerializer,
    CountrySerializer,
    SubscriptionSerializer,
    ClientSubscriptionSerializer,
)

from .training import (
    TrainingSetSerializer,
    TrainingExerciseSerializer,
    TrainingDaySplitSerializer,
    TrainingPlanSerializer,
    SessionLogSerializer,
    SessionSetSerializer,
    SessionExerciseSerializer,
    TrainingSessionSerializer,
    TrainingSessionListSerializer,
)

from .nutrition import (
    FoodItemSerializer,
    MealPlanSerializer,
    MealPlanCreateSerializer,
    NutritionPlanSerializer,
    NutritionPlanCreateSerializer,
    NutritionProgressSerializer,
    FoodDatabaseSerializer,
)

from .group import (
    CoachScheduleSerializer,
    GroupSessionParticipantSerializer,
    GroupSessionLogSerializer,
    GroupWorkoutTemplateSerializer,
)

from .schedule import TrainerShiftSerializer, TrainerScheduleSerializer

from .misc import (
    SessionTransferRequestSerializer,
    ManualNutritionSaveSerializer,
    ManualWorkoutSaveSerializer,
)

__all__ = [
    '_build_photo_url',
    # auth
    'TrainerSerializer', 'TrainerPublicSerializer',
    # client
    'ClientSerializer', 'CountrySerializer',
    'SubscriptionSerializer', 'ClientSubscriptionSerializer',
    # training
    'TrainingSetSerializer', 'TrainingExerciseSerializer',
    'TrainingDaySplitSerializer', 'TrainingPlanSerializer',
    'SessionLogSerializer',
    'SessionSetSerializer', 'SessionExerciseSerializer',
    'TrainingSessionSerializer', 'TrainingSessionListSerializer',
    # nutrition
    'FoodItemSerializer', 'MealPlanSerializer', 'MealPlanCreateSerializer',
    'NutritionPlanSerializer', 'NutritionPlanCreateSerializer',
    'NutritionProgressSerializer', 'FoodDatabaseSerializer',
    # group
    'CoachScheduleSerializer', 'GroupSessionParticipantSerializer',
    'GroupSessionLogSerializer', 'GroupWorkoutTemplateSerializer',
    # schedule
    'TrainerShiftSerializer', 'TrainerScheduleSerializer',
    # misc
    'SessionTransferRequestSerializer',
    'ManualNutritionSaveSerializer', 'ManualWorkoutSaveSerializer',
]
