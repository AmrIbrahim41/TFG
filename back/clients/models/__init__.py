"""
models/__init__.py — re-exports every model so that the rest of the app
can continue to use `from clients.models import SomeModel` without change.
"""

from .client import Client, Country
from .subscription import Subscription, ClientSubscription
from .training import (
    TrainingPlan,
    TrainingDaySplit,
    SessionLog,
    TrainingExercise,
    TrainingSet,
    TrainingSession,
    SessionExercise,
    SessionSet,
)
from .nutrition import (
    FoodDatabase,
    NutritionPlan,
    MealPlan,
    FoodItem,
    NutritionProgress,
)
from .group import (
    EXERCISE_CATEGORY_WEIGHT,
    EXERCISE_CATEGORY_REPS,
    EXERCISE_CATEGORY_TIME,
    EXERCISE_CATEGORY_CHOICES,
    CoachSchedule,
    GroupSessionLog,
    GroupSessionParticipant,
    GroupWorkoutTemplate,
)
from .schedule import TrainerShift, TrainerSchedule
from .manual import SessionTransferRequest, ManualNutritionSave, ManualWorkoutSave

__all__ = [
    # client
    'Client', 'Country',
    # subscription
    'Subscription', 'ClientSubscription',
    # training
    'TrainingPlan', 'TrainingDaySplit', 'SessionLog',
    'TrainingExercise', 'TrainingSet',
    'TrainingSession', 'SessionExercise', 'SessionSet',
    # nutrition
    'FoodDatabase', 'NutritionPlan', 'MealPlan', 'FoodItem', 'NutritionProgress',
    # group
    'EXERCISE_CATEGORY_WEIGHT', 'EXERCISE_CATEGORY_REPS', 'EXERCISE_CATEGORY_TIME',
    'EXERCISE_CATEGORY_CHOICES',
    'CoachSchedule', 'GroupSessionLog', 'GroupSessionParticipant', 'GroupWorkoutTemplate',
    # schedule
    'TrainerShift', 'TrainerSchedule',
    # manual / transfers
    'SessionTransferRequest', 'ManualNutritionSave', 'ManualWorkoutSave',
]
