from rest_framework import serializers

from ..models import SessionTransferRequest, ManualNutritionSave, ManualWorkoutSave
from .utils import _build_photo_url


class SessionTransferRequestSerializer(serializers.ModelSerializer):
    from_trainer_name = serializers.ReadOnlyField(source='from_trainer.first_name')
    to_trainer_name = serializers.ReadOnlyField(source='to_trainer.first_name')
    client_name = serializers.ReadOnlyField(source='subscription.client.name')
    plan_name = serializers.ReadOnlyField(source='subscription.plan.name')
    client_photo = serializers.SerializerMethodField()

    class Meta:
        model = SessionTransferRequest
        fields = [
            'id', 'from_trainer', 'to_trainer', 'subscription',
            'from_trainer_name', 'to_trainer_name', 'client_name', 'plan_name', 'client_photo',
            'sessions_count', 'schedule_notes', 'status', 'created_at',
        ]
        read_only_fields = ['from_trainer', 'status', 'created_at']

    def get_client_photo(self, obj):
        request = self.context.get('request')
        try:
            photo = obj.subscription.client.photo
        except Exception:
            photo = None
        return _build_photo_url(request, photo)

    def validate(self, data):
        user = self.context['request'].user
        target_trainer = data.get('to_trainer')
        subscription = data.get('subscription')
        count = data.get('sessions_count')

        if target_trainer == user:
            raise serializers.ValidationError(
                {'to_trainer': 'You cannot transfer sessions to yourself.'}
            )

        if subscription.trainer is None or subscription.trainer != user:
            raise serializers.ValidationError(
                {'subscription': 'You do not own this client subscription.'}
            )

        if not subscription.is_active:
            raise serializers.ValidationError(
                {'subscription': 'Cannot transfer sessions from an inactive or expired subscription.'}
            )

        if count <= 0:
            raise serializers.ValidationError(
                {'sessions_count': 'You must transfer at least 1 session.'}
            )

        if subscription.plan and subscription.plan.units and subscription.plan.units > 0:
            remaining_sessions = subscription.plan.units - subscription.sessions_used
            if count > remaining_sessions:
                raise serializers.ValidationError({
                    'sessions_count': (
                        f'Client only has {remaining_sessions} sessions remaining. '
                        f'You cannot transfer {count}.'
                    )
                })

        return data


class ManualNutritionSaveSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualNutritionSave
        fields = ['id', 'client_name', 'phone', 'plan_name', 'data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ManualWorkoutSaveSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualWorkoutSave
        fields = ['id', 'client_name', 'phone', 'session_name', 'data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
