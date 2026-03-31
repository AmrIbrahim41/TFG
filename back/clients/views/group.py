import json

from django.db import transaction

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import (
    CoachSchedule, GroupSessionLog, GroupSessionParticipant,
    GroupWorkoutTemplate,
)
from ..serializers import (
    CoachScheduleSerializer,
    GroupSessionLogSerializer,
    GroupWorkoutTemplateSerializer,
)
from .utils import HistoryPagination, _legacy_type_to_category


class CoachScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = CoachScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        trainer_id = self.request.query_params.get("trainer_id")
        if trainer_id:
            return CoachSchedule.objects.filter(coach_id=trainer_id).select_related("client")
        user = self.request.user
        if user.is_superuser:
            return CoachSchedule.objects.all().select_related("client")
        return CoachSchedule.objects.filter(coach=user).select_related("client")

    def perform_create(self, serializer):
        if serializer.validated_data.get('coach'):
            serializer.save()
        else:
            serializer.save(coach=self.request.user)


class GroupTrainingViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSessionLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = HistoryPagination

    def get_queryset(self):
        return (
            GroupSessionLog.objects.all()
            .prefetch_related("participants__client")
            .select_related("coach")
            .order_by("-date")
        )

    def perform_create(self, serializer):
        serializer.save(coach=self.request.user)

    @action(
        detail=False,
        methods=["get"],
        url_path="child_history",
        url_name="child-history",
    )
    def child_history(self, request):
        """Returns group session history for a specific child client."""
        client_id = request.query_params.get("client_id")
        if not client_id:
            return Response({"error": "client_id is required"}, status=400)

        paginator = HistoryPagination()

        participations = (
            GroupSessionParticipant.objects.filter(client_id=client_id)
            .select_related("session__coach", "client")
            .prefetch_related("session__participants__client")
            .order_by("-session__date")
        )

        page = paginator.paginate_queryset(participations, request)
        history_data = []
        items = page if page is not None else participations

        for p in items:
            session = p.session
            client_name = p.client.name if p.client else ""
            client_id_str = str(client_id)
            child_performance = []

            exercises_data = session.exercises_summary
            if isinstance(exercises_data, str):
                try:
                    exercises_data = json.loads(exercises_data)
                except Exception:
                    exercises_data = []

            for ex in exercises_data if isinstance(exercises_data, list) else []:
                results = ex.get("results", [])
                user_res = next(
                    (
                        r for r in results
                        if r.get("client") == client_name
                        or str(r.get("client_id")) == client_id_str
                    ),
                    None,
                )
                if user_res:
                    child_performance.append({
                        "exercise": ex.get("name", "Unknown"),
                        "category": ex.get("category") or _legacy_type_to_category(ex.get("type", "")),
                        "sets_count": ex.get("sets_count", 0),
                        "val1": user_res.get("val1", "-"),
                        "val2": user_res.get("val2", "-"),
                        "val3": user_res.get("val3", "-"),
                        "note": user_res.get("note", ""),
                    })

            history_data.append({
                "id": session.id,
                "date": session.date,
                "day_name": session.day_name,
                "coach": session.coach.first_name if session.coach else "Unknown",
                "session_note": p.note,
                "performance": child_performance,
            })

        if page is not None:
            return paginator.get_paginated_response(history_data)
        return Response(history_data)

    @action(
        detail=False,
        methods=["post"],
        url_path="bulk_exercise_history",
        url_name="bulk-exercise-history",
    )
    def bulk_exercise_history(self, request):
        day_name = str(request.data.get("day_name", "") or "").strip()
        exercise_names = request.data.get("exercise_names", [])
        client_ids = request.data.get("client_ids", [])

        if not (
            day_name
            and isinstance(exercise_names, list)
            and exercise_names
            and isinstance(client_ids, list)
            and client_ids
        ):
            return Response({})

        requested_names_map = {str(n).strip().lower(): str(n).strip() for n in exercise_names}
        ex_name_set = set(requested_names_map.keys())

        participations = (
            GroupSessionParticipant.objects.filter(
                client_id__in=client_ids, session__day_name=day_name
            )
            .select_related("session", "client")
            .order_by("-session__date")
        )

        result = {
            str(cid): {ename: None for ename in exercise_names} for cid in client_ids
        }
        resolved = {str(cid): set() for cid in client_ids}

        for p in participations:
            client_id_str = str(p.client_id)
            client_name = p.client.name if p.client else ""

            if len(resolved.get(client_id_str, set())) == len(exercise_names):
                continue

            exercises_data = p.session.exercises_summary
            if isinstance(exercises_data, str):
                try:
                    exercises_data = json.loads(exercises_data)
                except Exception:
                    exercises_data = []

            for ex in exercises_data if isinstance(exercises_data, list) else []:
                ex_name_db = str(ex.get("name", "")).strip()
                ex_name_lower = ex_name_db.lower()

                if ex_name_lower not in ex_name_set:
                    continue

                original_requested_name = requested_names_map[ex_name_lower]

                if original_requested_name in resolved.get(client_id_str, set()):
                    continue

                results = (
                    ex.get("results", []) if isinstance(ex.get("results"), list) else []
                )
                user_res = next(
                    (
                        r for r in results
                        if r.get("client") == client_name
                        or str(r.get("client_id")) == client_id_str
                    ),
                    None,
                )
                if user_res:
                    result[client_id_str][original_requested_name] = {
                        "found": True,
                        "category": ex.get("category") or _legacy_type_to_category(ex.get("type", "")),
                        "sets_count": int(ex.get("sets_count") or 0),
                        "val1": str(user_res.get("val1", "")),
                        "val2": str(user_res.get("val2", "")),
                        "val3": str(user_res.get("val3", "")),
                        "note": str(user_res.get("note", "")),
                    }
                    resolved.setdefault(client_id_str, set()).add(original_requested_name)

        for cid_str in result:
            for ename in result[cid_str]:
                if result[cid_str][ename] is None:
                    result[cid_str][ename] = {"found": False}

        return Response(result)

    @action(
        detail=False,
        methods=["post"],
        url_path="complete_session",
        url_name="complete-session",
    )
    def complete_session(self, request):
        """
        Atomically creates a GroupSessionLog and all associated
        GroupSessionParticipant records in a single transaction.
        Setting deducted=True on each participant triggers the model's save()
        hook which atomically increments sessions_used on the client's active
        subscription and auto-deactivates if the plan limit is reached.
        """
        day_name = request.data.get("day_name", "")
        exercises_summary = request.data.get("exercises_summary", [])
        participants_data = request.data.get("participants", [])

        if not day_name:
            return Response(
                {"error": "day_name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            session = GroupSessionLog.objects.create(
                coach=request.user,
                day_name=day_name,
                exercises_summary=exercises_summary,
            )
            for p in participants_data:
                client_id = p.get("client_id")
                if not client_id:
                    continue
                GroupSessionParticipant.objects.create(
                    session=session,
                    client_id=client_id,
                    note=p.get("note", "Completed"),
                    deducted=True,
                )

        return Response(
            {"status": "success", "session_id": session.id},
            status=status.HTTP_201_CREATED,
        )


class GroupWorkoutTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = GroupWorkoutTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = GroupWorkoutTemplate.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
