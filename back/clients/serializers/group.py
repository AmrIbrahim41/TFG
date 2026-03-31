from rest_framework import serializers

from ..models import (
    CoachSchedule, GroupSessionLog, GroupSessionParticipant,
    GroupWorkoutTemplate, ClientSubscription,
)
from .utils import _build_photo_url


class CoachScheduleSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source='client.name')
    client_photo = serializers.SerializerMethodField()
    client_id = serializers.ReadOnlyField(source='client.id')

    class Meta:
        model = CoachSchedule
        fields = ['id', 'coach', 'client', 'client_id', 'client_name', 'client_photo', 'day', 'session_time']

    def get_client_photo(self, obj):
        request = self.context.get('request')
        return _build_photo_url(request, obj.client.photo if obj.client else None)

    def validate(self, data):
        """
        Validates that the child has an active subscription before being added
        to the schedule. Only checked on creation (POST), not on updates (PATCH).
        """
        if self.instance:
            return data

        client = data.get('client')

        if client:
            has_active = ClientSubscription.objects.filter(
                client=client,
                is_active=True,
            ).exists()
            if not has_active:
                raise serializers.ValidationError({
                    'client': (
                        'This child does not have an active subscription. '
                        'Only children with active subscriptions can be added to the schedule.'
                    )
                })

        return data


class GroupSessionParticipantSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source='client.name')
    client_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = GroupSessionParticipant
        fields = ['client_name', 'client_photo_url', 'note', 'deducted']

    def get_client_photo_url(self, obj):
        request = self.context.get('request')
        if obj.client:
            return _build_photo_url(request, obj.client.photo)
        return None


class GroupSessionLogSerializer(serializers.ModelSerializer):
    coach_name = serializers.ReadOnlyField(source='coach.first_name')
    coach_id = serializers.ReadOnlyField(source='coach.id')
    participants = GroupSessionParticipantSerializer(many=True, read_only=True)

    class Meta:
        model = GroupSessionLog
        fields = ['id', 'coach_name', 'coach_id', 'date', 'day_name', 'exercises_summary', 'participants']


class GroupWorkoutTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.first_name')

    class Meta:
        model = GroupWorkoutTemplate
        fields = ['id', 'name', 'exercises', 'created_by', 'created_by_name', 'created_at']
