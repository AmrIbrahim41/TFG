from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Subscription, ClientSubscription, Country
from ..serializers import (
    SubscriptionSerializer,
    ClientSubscriptionSerializer,
    CountrySerializer,
)
from .utils import StandardResultsSetPagination


class SubscriptionViewSet(viewsets.ModelViewSet):
    """
    Subscription plan packages.
    pagination_class = None ensures the frontend always receives a flat list.
    """
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    serializer_class = SubscriptionSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = Subscription.objects.all().order_by("is_child_plan", "price")
        target = self.request.query_params.get("target")
        if target == "child":
            queryset = queryset.filter(is_child_plan=True)
        elif target == "adult":
            queryset = queryset.filter(is_child_plan=False)
        return queryset


class ClientSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        queryset = (
            ClientSubscription.objects.all()
            .select_related("client", "plan", "trainer")
            .order_by("-start_date")
        )

        client_id = self.request.query_params.get("client_id")
        if client_id:
            queryset = queryset.filter(client=client_id)
        else:
            if not user.is_superuser and not user.groups.filter(name="REC").exists():
                queryset = queryset.filter(trainer=user)

        return queryset

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Returns all active subscriptions for the requesting trainer."""
        user = request.user
        qs = ClientSubscription.objects.filter(
            trainer=user, is_active=True
        ).select_related("client", "plan")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        """
        Auto-assigns the requesting trainer when a non-admin trainer creates a
        subscription without explicitly providing a trainer in the payload.
        Admins and receptionists can freely set any trainer (or leave it null).
        """
        user = self.request.user
        is_admin = user.is_superuser
        is_rec = user.groups.filter(name='REC').exists()

        if not is_admin and not is_rec:
            if not serializer.validated_data.get('trainer'):
                serializer.save(trainer=user)
                return

        serializer.save()


class CountryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Country.objects.all().order_by("name")
    serializer_class = CountrySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
