from django.db import transaction
from rest_framework import serializers

from ..models import (
    TrainingPlan, TrainingDaySplit, TrainingExercise, TrainingSet,
    SessionLog, TrainingSession, SessionExercise, SessionSet,
)


# ---------------------------------------------------------------------------
# TRAINING PLAN (template level)
# ---------------------------------------------------------------------------

class TrainingSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingSet
        fields = '__all__'


class TrainingExerciseSerializer(serializers.ModelSerializer):
    sets = TrainingSetSerializer(many=True, read_only=True)

    class Meta:
        model = TrainingExercise
        fields = ['id', 'split', 'order', 'name', 'note', 'sets']


class TrainingDaySplitSerializer(serializers.ModelSerializer):
    exercises = TrainingExerciseSerializer(many=True, read_only=True)

    class Meta:
        model = TrainingDaySplit
        fields = ['id', 'order', 'name', 'exercises']


class TrainingPlanSerializer(serializers.ModelSerializer):
    splits = TrainingDaySplitSerializer(many=True, read_only=True)

    day_names = serializers.ListField(
        child=serializers.CharField(max_length=100, allow_blank=True),
        write_only=True,
        required=False,
        help_text="One name per split day, in order. Length should equal cycle_length.",
    )

    class Meta:
        model = TrainingPlan
        fields = ['id', 'subscription', 'cycle_length', 'created_at', 'splits', 'day_names']

    def validate(self, data):
        subscription = data.get('subscription')
        if subscription and not self.instance:
            if TrainingPlan.objects.filter(subscription=subscription).exists():
                raise serializers.ValidationError({
                    'subscription': (
                        'A training plan already exists for this subscription. '
                        'Delete (reset) the existing plan before creating a new one.'
                    )
                })
        return data

    def create(self, validated_data):
        day_names = validated_data.pop('day_names', [])

        with transaction.atomic():
            plan = TrainingPlan.objects.create(**validated_data)

            splits_to_create = []
            for i in range(plan.cycle_length):
                name = day_names[i].strip() if i < len(day_names) else ''
                if not name:
                    name = f'Day {i + 1}'
                splits_to_create.append(
                    TrainingDaySplit(plan=plan, order=i + 1, name=name)
                )

            TrainingDaySplit.objects.bulk_create(splits_to_create)

        return plan


# ---------------------------------------------------------------------------
# SESSION LOG (legacy)
# ---------------------------------------------------------------------------

class SessionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionLog
        fields = '__all__'


# ---------------------------------------------------------------------------
# TRAINING SESSION (authoritative)
# ---------------------------------------------------------------------------

class SessionSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionSet
        fields = '__all__'


class SessionExerciseSerializer(serializers.ModelSerializer):
    sets = SessionSetSerializer(many=True, read_only=True)

    class Meta:
        model = SessionExercise
        fields = ['id', 'order', 'name', 'note', 'sets']


class TrainingSessionSerializer(serializers.ModelSerializer):
    """Full serializer — used for detail/retrieve/save-data/get-data."""
    exercises = SessionExerciseSerializer(many=True, read_only=True)
    trainer_name = serializers.ReadOnlyField(source='completed_by.first_name')
    completed_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = TrainingSession
        fields = [
            'id', 'subscription', 'session_number', 'name', 'is_completed',
            'date_completed', 'exercises', 'trainer_name', 'completed_by',
        ]


class TrainingSessionListSerializer(serializers.ModelSerializer):
    """
    Slim serializer for the list action used by ClientTrainingTab.
    Returns only the fields the session grid actually needs — the full
    exercises tree is excluded and fetched separately via get-data/.
    """
    trainer_name = serializers.ReadOnlyField(source='completed_by.first_name')

    class Meta:
        model = TrainingSession
        fields = [
            'id', 'subscription', 'session_number', 'name',
            'is_completed', 'date_completed', 'trainer_name',
        ]
