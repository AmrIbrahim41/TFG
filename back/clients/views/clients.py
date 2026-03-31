from rest_framework import viewsets, permissions, filters
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from ..models import Client
from ..serializers import ClientSerializer, TrainerSerializer, TrainerPublicSerializer
from .utils import StandardResultsSetPagination


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "phone", "manual_id"]
    pagination_class = StandardResultsSetPagination
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        queryset = Client.objects.prefetch_related("subscriptions__trainer").order_by(
            "-created_at"
        )

        is_child = self.request.query_params.get("is_child")
        if is_child == "true":
            queryset = queryset.filter(is_child=True)
        elif is_child == "false":
            queryset = queryset.filter(is_child=False)
        return queryset


class ManageTrainersViewSet(viewsets.ModelViewSet):
    """
    Trainer management endpoint.
    Admins: full TrainerSerializer (all fields, password write).
    Other authenticated users: TrainerPublicSerializer (id + name only).
    Mutating actions (create/update/destroy) are admin-only.
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Trainer roster is small; always return a flat list.

    def get_queryset(self):
        from django.contrib.auth.models import User
        return User.objects.filter(is_superuser=False).order_by("-date_joined")

    def get_serializer_class(self):
        if self.request.user.is_superuser:
            return TrainerSerializer
        return TrainerPublicSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]
