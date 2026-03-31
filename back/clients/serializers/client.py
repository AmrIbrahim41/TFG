from rest_framework import serializers

from ..models import Client, Country, Subscription, ClientSubscription
from .utils import _build_photo_url


class ClientSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    age = serializers.ReadOnlyField()
    is_subscribed = serializers.SerializerMethodField()
    active_trainer_name = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id', 'name', 'manual_id', 'phone', 'photo', 'photo_url',
            'created_at', 'nature_of_work', 'birth_date', 'age', 'address',
            'status', 'smoking', 'sleep_hours', 'notes', 'is_subscribed',
            'is_child', 'parent_phone', 'country', 'trained_gym_before',
            'trained_coach_before', 'injuries',
            'active_trainer_name',
        ]

    def get_photo_url(self, obj):
        request = self.context.get('request')
        return _build_photo_url(request, obj.photo)

    def get_active_trainer_name(self, obj):
        active_sub = next((sub for sub in obj.subscriptions.all() if sub.is_active), None)
        if active_sub and active_sub.trainer:
            return active_sub.trainer.first_name or active_sub.trainer.username
        return None

    def get_is_subscribed(self, obj):
        # Reuses the prefetch_related('subscriptions__trainer') cache — 0 extra queries.
        return any(sub.is_active for sub in obj.subscriptions.all())

    def validate(self, data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            is_admin = user.is_superuser
            is_rec = user.groups.filter(name='REC').exists()

            if not is_admin and not is_rec and self.instance:
                if 'name' in data and data['name'] != self.instance.name:
                    raise serializers.ValidationError(
                        {'name': 'Only Admins or Reception can edit the Name.'}
                    )
                if 'manual_id' in data and data['manual_id'] != self.instance.manual_id:
                    raise serializers.ValidationError(
                        {'manual_id': 'Only Admins or Reception can edit the ID.'}
                    )
        return data


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = '__all__'


class ClientSubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.ReadOnlyField(source='plan.name')
    plan_total_sessions = serializers.ReadOnlyField(source='plan.units')
    trainer_name = serializers.SerializerMethodField()
    client_name = serializers.ReadOnlyField(source='client.name')

    class Meta:
        model = ClientSubscription
        fields = '__all__'
        read_only_fields = ['created_at']

    def get_trainer_name(self, obj):
        if not obj.trainer:
            return None
        return obj.trainer.first_name or obj.trainer.username

    def validate(self, data):
        if self.instance:
            effective_is_active = data.get('is_active', self.instance.is_active)
        else:
            effective_is_active = data.get('is_active', True)

        if effective_is_active:
            client = data.get('client') or (self.instance.client if self.instance else None)
            if client is None:
                return data

            active_subs = ClientSubscription.objects.filter(client=client, is_active=True)
            if self.instance:
                active_subs = active_subs.exclude(id=self.instance.id)

            if active_subs.exists():
                raise serializers.ValidationError(
                    {
                        'is_active': (
                            'This client already has an active subscription. '
                            'Deactivate the old one first.'
                        )
                    }
                )
        return data
