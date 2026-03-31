from django.contrib.auth.models import User
from rest_framework import serializers

from ..models import TrainerShift, TrainerSchedule, ClientSubscription


class TrainerShiftSerializer(serializers.ModelSerializer):
    trainer = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    trainer_name = serializers.SerializerMethodField()
    is_overnight = serializers.SerializerMethodField()

    class Meta:
        model = TrainerShift
        fields = [
            'id', 'trainer', 'trainer_name',
            'shift_start', 'shift_end', 'slot_duration',
            'is_overnight', 'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']

    def get_trainer_name(self, obj):
        return obj.trainer.first_name or obj.trainer.username

    def get_is_overnight(self, obj):
        """True when the shift crosses midnight (shift_end < shift_start)."""
        if obj.shift_start and obj.shift_end:
            return obj.shift_end < obj.shift_start
        return False

    def validate(self, data):
        start = data.get('shift_start', getattr(self.instance, 'shift_start', None))
        end   = data.get('shift_end',   getattr(self.instance, 'shift_end',   None))

        if start and end:
            if end == start:
                raise serializers.ValidationError(
                    {'shift_end': 'Shift end cannot be the same as shift start.'}
                )

        duration = data.get('slot_duration', getattr(self.instance, 'slot_duration', 60))
        if duration and (duration < 15 or duration > 240):
            raise serializers.ValidationError(
                {'slot_duration': 'Slot duration must be between 15 and 240 minutes.'}
            )
        return data


class TrainerScheduleSerializer(serializers.ModelSerializer):
    trainer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        default=serializers.CurrentUserDefault()
    )

    client_name  = serializers.ReadOnlyField(source='client.name')
    client_photo = serializers.SerializerMethodField()
    client_id    = serializers.ReadOnlyField(source='client.id')
    day_name     = serializers.SerializerMethodField()

    class Meta:
        model = TrainerSchedule
        fields = [
            'id', 'trainer', 'client', 'client_id', 'client_name',
            'client_photo', 'day_of_week', 'day_name', 'time_slot', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_client_photo(self, obj):
        from .utils import _build_photo_url
        request = self.context.get('request')
        return _build_photo_url(request, obj.client.photo if obj.client else None)

    def get_day_name(self, obj):
        return dict(TrainerSchedule.DAY_CHOICES).get(obj.day_of_week, '')

    def validate(self, data):
        request = self.context.get('request')
        trainer = data.get('trainer') or getattr(self.instance, 'trainer', None)

        if request and hasattr(request, 'user') and request.user.is_superuser:
            explicit_trainer = self.initial_data.get('trainer')
            if not explicit_trainer:
                raise serializers.ValidationError(
                    {'trainer': 'Admin must explicitly specify the trainer field.'}
                )
        elif not trainer and request and hasattr(request, 'user'):
            trainer = request.user

        client = data.get('client') or getattr(self.instance, 'client', None)

        if client:
            has_active = ClientSubscription.objects.filter(
                client=client,
                is_active=True,
            ).exists()
            if not has_active:
                raise serializers.ValidationError({
                    'client': (
                        'This client does not have an active subscription. '
                        'Only clients with active subscriptions can be added to the schedule.'
                    )
                })

        return data
