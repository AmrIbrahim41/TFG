from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import ClientSubscription, TrainingSession, GroupSessionLog
from .utils import _build_client_dict


class AdminTrainerOversightViewSet(viewsets.ViewSet):
    """
    Admin-only endpoints for the Trainer Oversight page.

    GET /admin-trainer-oversight/{id}/details/
    GET /admin-trainer-oversight/{id}/mini-dashboard/
    """
    permission_classes = [permissions.IsAdminUser]

    def _get_trainer_or_404(self, trainer_id):
        try:
            return User.objects.get(pk=trainer_id, is_superuser=False)
        except User.DoesNotExist:
            return None

    def _build_mini_dashboard_data(self, trainer, request):
        """
        Returns (session_activity: list, chart_data: list) for the last 7 days.
        chart_data: list of {'date': 'Mon 03', 'sessions': N}, oldest → newest.
        """
        cutoff = timezone.now().date() - timedelta(days=6)
        today = timezone.now().date()

        individual_sessions = (
            TrainingSession.objects.filter(
                subscription__trainer=trainer,
                is_completed=True,
                date_completed__gte=cutoff,
            )
            .select_related("subscription__client", "completed_by")
            .order_by("-date_completed")
        )

        group_sessions = (
            GroupSessionLog.objects.filter(coach=trainer, date__date__gte=cutoff)
            .prefetch_related("participants__client")
            .order_by("-date")
        )

        day_map: dict = {today - timedelta(days=i): 0 for i in range(6, -1, -1)}
        session_activity = []

        for sess in individual_sessions:
            d = sess.date_completed
            session_activity.append({
                "type": "individual",
                "date": d,
                "client_name": sess.subscription.client.name,
                "session_name": sess.name,
                "completed_by": (
                    sess.completed_by.first_name if sess.completed_by else "N/A"
                ),
            })
            if d in day_map:
                day_map[d] += 1

        for grp in group_sessions:
            d = grp.date.date()
            participant_names = [p.client.name for p in grp.participants.all() if p.client]
            session_activity.append({
                "type": "group",
                "date": d,
                "client_name": (", ".join(participant_names) if participant_names else "Group"),
                "session_name": grp.day_name,
                "completed_by": trainer.first_name or trainer.username,
            })
            if d in day_map:
                participant_count = len(participant_names) or 1
                day_map[d] += participant_count

        chart_data = [
            {"date": d.strftime("%a %d"), "sessions": count}
            for d, count in day_map.items()
        ]

        return session_activity, chart_data

    @action(detail=True, methods=["get"], url_path="details", url_name="details")
    def details(self, request, pk=None):
        """Full overview: trainer info + active clients + last 7 days activity."""
        trainer = self._get_trainer_or_404(pk)
        if not trainer:
            return Response({"error": "Trainer not found."}, status=status.HTTP_404_NOT_FOUND)

        active_subs = ClientSubscription.objects.filter(
            trainer=trainer, is_active=True
        ).select_related("client", "plan")

        clients_data = []
        for sub in active_subs:
            base_data = _build_client_dict(sub, request)
            total = base_data["total_sessions"]
            used = base_data["sessions_used"]
            clients_data.append({
                "client_id": base_data["id"],
                "client_name": base_data["name"],
                "client_photo": base_data["photo"],
                "plan_name": base_data["plan"],
                "sessions_used": used,
                "total_sessions": total,
                "remaining": max(total - used, 0) if total else None,
                "progress_pct": sub.progress_percentage,
                "end_date": base_data["end_date"],
                "subscription_id": base_data["subscription_id"],
            })

        session_activity, chart_data = self._build_mini_dashboard_data(trainer, request)

        return Response({
            "trainer": {
                "id": trainer.id,
                "name": trainer.first_name or trainer.username,
                "username": trainer.username,
                "email": trainer.email,
                "date_joined": trainer.date_joined,
            },
            "clients": clients_data,
            "session_activity": session_activity,
            "chart_data": chart_data,
        })

    @action(
        detail=True,
        methods=["get"],
        url_path="mini-dashboard",
        url_name="mini-dashboard",
    )
    def mini_dashboard(self, request, pk=None):
        """Lightweight tab: only last 7 days activity + chart data."""
        trainer = self._get_trainer_or_404(pk)
        if not trainer:
            return Response({"error": "Trainer not found."}, status=status.HTTP_404_NOT_FOUND)

        session_activity, chart_data = self._build_mini_dashboard_data(trainer, request)

        return Response({
            "chart_data": chart_data,
            "session_activity": session_activity,
        })
