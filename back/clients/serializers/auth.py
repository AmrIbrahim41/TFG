from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password as django_validate_password
from rest_framework import serializers


class TrainerSerializer(serializers.ModelSerializer):
    """
    Full trainer serializer — admin use only (create / update / detail).
    Exposes sensitive fields (email, date_joined) so restrict to IsAdminUser.
    Password field runs Django's built-in validators on create/update.
    """
    role = serializers.ChoiceField(
        choices=[('trainer', 'Trainer'), ('rec', 'Receptionist')],
        write_only=True,
        default='trainer',
    )

    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'email', 'password', 'date_joined', 'role')
        extra_kwargs = {'password': {'write_only': True, 'required': False}}

    def validate_password(self, value):
        if value:
            user = self.instance
            django_validate_password(value, user=user)
        return value

    def create(self, validated_data):
        role = validated_data.pop('role', 'trainer')
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError(
                {'password': 'Password is required when creating a new trainer.'}
            )

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=password,
            first_name=validated_data.get('first_name', ''),
        )
        user.is_staff = False
        user.save()

        if role == 'rec':
            group, _ = Group.objects.get_or_create(name='REC')
            user.groups.add(group)

        return user

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        if role:
            rec_group = Group.objects.filter(name='REC').first()
            if rec_group:
                instance.groups.remove(rec_group)
            if role == 'rec':
                group, _ = Group.objects.get_or_create(name='REC')
                instance.groups.add(group)

        return instance


class TrainerPublicSerializer(serializers.ModelSerializer):
    """
    Limited trainer info for non-admin, authenticated users.
    Used for transfer-target picker and similar lists.
    Does NOT expose email, date_joined, or any sensitive field.
    """
    class Meta:
        model = User
        fields = ('id', 'first_name', 'username')
