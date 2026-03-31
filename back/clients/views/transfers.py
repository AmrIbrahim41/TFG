from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import ClientSubscription, SessionTransferRequest
from ..serializers import SessionTransferRequestSerializer


class SessionTransferRequestViewSet(viewsets.ModelViewSet):
    serializer_class = SessionTransferRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Transfer lists are scoped to one trainer; flat list is safe.

    def get_queryset(self):
        user = self.request.user
        return SessionTransferRequest.objects.filter(
            Q(from_trainer=user) | Q(to_trainer=user)
        ).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(from_trainer=self.request.user)

    @action(detail=True, methods=["post"])
    def respond(self, request, pk=None):
        transfer = self.get_object()
        new_status = request.data.get("status")

        if transfer.to_trainer != request.user:
            return Response({"error": "Not authorized to respond to this request."}, status=403)

        if transfer.status != "pending":
            return Response({"error": "This transfer request has already been resolved."}, status=400)

        if new_status not in ("accepted", "rejected"):
            return Response({"error": "Invalid status."}, status=400)

        if new_status == "rejected":
            transfer.status = "rejected"
            transfer.save()
            return Response({"status": "success", "new_status": "rejected"})

        with transaction.atomic():
            source_sub = (
                ClientSubscription.objects.select_for_update()
                .select_related("plan", "client")
                .get(pk=transfer.subscription_id)
            )

            if not source_sub.is_active:
                return Response(
                    {"error": "The source subscription is no longer active."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            sessions_count = transfer.sessions_count
            plan = source_sub.plan
            remaining = (plan.units - source_sub.sessions_used) if plan and plan.units else 0
            if sessions_count > remaining:
                return Response(
                    {
                        "error": (
                            f"Only {remaining} session(s) remain on the source subscription. "
                            f"Cannot transfer {sessions_count}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            ClientSubscription.objects.filter(pk=source_sub.pk).update(
                sessions_used=F("sessions_used") + sessions_count
            )
            source_sub.refresh_from_db(fields=["sessions_used"])

            # Always deactivate source_sub before creating the target to satisfy
            # the unique_active_subscription_per_client DB constraint.
            source_sub.is_active = False
            source_sub.save(update_fields=["is_active"])

            target_sub = (
                ClientSubscription.objects.select_for_update()
                .filter(
                    client=source_sub.client,
                    trainer=transfer.to_trainer,
                    is_active=True,
                )
                .first()
            )

            if target_sub:
                new_used = max(target_sub.sessions_used - sessions_count, 0)
                target_sub.sessions_used = new_used
                target_sub.save(update_fields=["sessions_used"])
            else:
                today = timezone.now().date()
                new_sessions_used = max(plan.units - sessions_count, 0) if plan else 0
                ClientSubscription.objects.create(
                    client=source_sub.client,
                    plan=plan,
                    trainer=transfer.to_trainer,
                    start_date=today,
                    end_date=source_sub.end_date,
                    is_active=True,
                    sessions_used=new_sessions_used,
                )

            transfer.status = "accepted"
            transfer.save()

        return Response({"status": "success", "new_status": "accepted"})
