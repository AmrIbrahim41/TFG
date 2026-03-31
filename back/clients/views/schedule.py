from django.db.models import Exists, OuterRef

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import TrainerShift, TrainerSchedule, ClientSubscription
from ..serializers import TrainerShiftSerializer, TrainerScheduleSerializer
from .utils import _build_client_dict


class TrainerShiftViewSet(viewsets.ModelViewSet):
    """
    Manages the shift (working hours) for trainers.

    Trainer endpoints:
      GET/PUT/PATCH /trainer-shift/mine/  → read or update own shift
    Admin endpoints:
      GET  /trainer-shift/?trainer_id=5   → shift for trainer #5
    """
    serializer_class = TrainerShiftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            trainer_id = self.request.query_params.get("trainer_id")
            if trainer_id:
                return TrainerShift.objects.filter(trainer_id=trainer_id)
            return TrainerShift.objects.all().select_related("trainer")
        return TrainerShift.objects.filter(trainer=user).select_related("trainer")

    def list(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            shift, _ = TrainerShift.objects.get_or_create(
                trainer=request.user,
                defaults={"shift_start": "08:00", "shift_end": "20:00", "slot_duration": 60},
            )
            return Response(self.get_serializer(shift).data)

        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        if not self.request.user.is_superuser:
            serializer.save(trainer=self.request.user)
        else:
            serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=False, methods=["get", "put", "patch"], url_path="mine", url_name="mine")
    def mine(self, request):
        """GET/PUT/PATCH /trainer-shift/mine/ — trainer reads or updates own shift."""
        shift, _ = TrainerShift.objects.get_or_create(
            trainer=request.user,
            defaults={"shift_start": "08:00", "shift_end": "20:00", "slot_duration": 60},
        )
        if request.method == "GET":
            return Response(self.get_serializer(shift).data)

        partial = request.method == "PATCH"
        serializer = self.get_serializer(shift, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save(trainer=request.user)
        return Response(serializer.data)


class TrainerScheduleViewSet(viewsets.ModelViewSet):
    """
    Manages individual weekly schedule slots.
    Inactive-subscription filtering: the queryset always filters to slots
    where the linked ClientSubscription is still active.
    """
    serializer_class = TrainerScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Full flat list — a trainer's schedule is small and bounded.

    def get_queryset(self):
        user = self.request.user

        active_sub_exists = ClientSubscription.objects.filter(
            client=OuterRef('client'),
            is_active=True,
        )
        base_qs = (
            TrainerSchedule.objects.select_related("client", "trainer")
            .filter(Exists(active_sub_exists))
            .order_by("day_of_week", "time_slot")
        )

        if user.is_superuser:
            trainer_id = self.request.query_params.get("trainer_id")
            if trainer_id:
                return base_qs.filter(trainer_id=trainer_id)
            return base_qs

        trainer_id = self.request.query_params.get("trainer_id")
        if trainer_id:
            return base_qs.filter(trainer_id=trainer_id)

        return base_qs.filter(trainer=user)

    def perform_create(self, serializer):
        if not self.request.user.is_superuser:
            serializer.save(trainer=self.request.user)
        else:
            serializer.save()

    @action(
        detail=False,
        methods=["get"],
        url_path="active-clients",
        url_name="active-clients",
    )
    def active_clients(self, request):
        """
        Clients eligible to be scheduled (have an active subscription with ANY trainer).
        Per business rules: any trainer can train any client — show all active clients.
        """
        user = request.user

        if user.is_superuser:
            trainer_id = request.query_params.get("trainer_id")
            if not trainer_id:
                return Response(
                    {"error": "trainer_id query param is required for admin access."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = ClientSubscription.objects.filter(is_active=True).select_related("client", "plan")
        else:
            qs = ClientSubscription.objects.filter(is_active=True).select_related("client", "plan")

        seen_client_ids = set()
        clients = []
        for sub in qs.order_by("-start_date"):
            if sub.client_id not in seen_client_ids:
                seen_client_ids.add(sub.client_id)
                clients.append(_build_client_dict(sub, request))

        return Response(clients)
