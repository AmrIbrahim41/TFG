import django_filters
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from ..models import (
    TrainingPlan, TrainingExercise, SessionLog,
    TrainingSession, SessionExercise, SessionSet, ClientSubscription,
)
from ..serializers import (
    TrainingPlanSerializer,
    TrainingExerciseSerializer,
    SessionLogSerializer,
    TrainingSessionSerializer,
    TrainingSessionListSerializer,
)


class TrainingSessionFilter(django_filters.FilterSet):
    class Meta:
        model = TrainingSession
        fields = {
            "subscription_id": ["exact"],
            "is_completed": ["exact"],
        }


class TrainingPlanViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        base_qs = TrainingPlan.objects.prefetch_related('splits__exercises__sets')
        subscription_id = self.request.query_params.get("subscription_id")
        if subscription_id:
            return base_qs.filter(subscription_id=subscription_id)
        return base_qs


class TrainingExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingExerciseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        split_id = self.request.query_params.get("split_id")
        if split_id:
            return TrainingExercise.objects.filter(split_id=split_id)
        return TrainingExercise.objects.all()


class SessionLogViewSet(viewsets.ModelViewSet):
    serializer_class = SessionLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        subscription_id = self.request.query_params.get("subscription_id")
        if subscription_id:
            return SessionLog.objects.filter(subscription_id=subscription_id)
        return SessionLog.objects.all()


class TrainingSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = TrainingSessionFilter
    pagination_class = None  # Always scoped to a single subscription; flat list is safe.

    def get_serializer_class(self):
        if self.action == 'list':
            return TrainingSessionListSerializer
        return TrainingSessionSerializer

    def get_queryset(self):
        if self.action in ('list',):
            qs = TrainingSession.objects.all()
        else:
            qs = (
                TrainingSession.objects
                .select_related('completed_by', 'subscription__plan', 'subscription__client')
                .prefetch_related("exercises__sets")
            )

        is_list_action = self.action == 'list'
        has_sub_id = self.request.query_params.get('subscription_id')

        if not self.request.user.is_superuser:
            if is_list_action:
                if has_sub_id:
                    qs = qs.filter(subscription_id=has_sub_id)
                else:
                    raise ValidationError({"subscription_id": "رقم الاشتراك مطلوب لعرض الجلسات."})
        else:
            if is_list_action:
                if has_sub_id:
                    qs = qs.filter(subscription_id=has_sub_id)
                else:
                    raise ValidationError({"subscription_id": "subscription_id مطلوب لعرض الجلسات."})

        return qs

    def perform_create(self, serializer):
        if self.request.user.groups.filter(name="REC").exists():
            raise PermissionDenied("Receptionists cannot create training sessions.")
        serializer.save()

    def perform_update(self, serializer):
        if self.request.user.groups.filter(name="REC").exists():
            raise PermissionDenied("Receptionists cannot modify training sessions.")

        with transaction.atomic():
            locked_session = TrainingSession.objects.select_for_update().get(
                pk=serializer.instance.pk
            )

            if locked_session.is_completed and not self.request.user.is_superuser:
                if locked_session.completed_by != self.request.user:
                    raise PermissionDenied(
                        "لا يمكنك تعديل جلسة تم إنهاؤها بالفعل بواسطة مدرب آخر."
                    )

            if locked_session.is_completed and serializer.validated_data.get('is_completed'):
                return  # Idempotent — no double deduction

            was_completed = locked_session.is_completed
            updated = serializer.save()

            if not was_completed and updated.is_completed:
                ClientSubscription.objects.filter(pk=updated.subscription_id).update(
                    sessions_used=F("sessions_used") + 1
                )
                sub = ClientSubscription.objects.select_related('plan').get(
                    pk=updated.subscription_id
                )
                if sub.plan and sub.sessions_used >= sub.plan.units:
                    sub.is_active = False
                    sub.save(update_fields=["is_active"])

                updated.completed_by = self.request.user
                updated.save(update_fields=["completed_by"])

    @action(detail=False, methods=["get"], url_path="get-data")
    def get_data(self, request):
        sub_id = request.query_params.get("subscription")
        session_num = request.query_params.get("session_number")

        session = (
            TrainingSession.objects.filter(
                subscription_id=sub_id,
                session_number=session_num,
            )
            .prefetch_related("exercises__sets")
            .first()
        )

        if not session:
            return Response({"name": f"Session {session_num}", "exercises": []})

        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="save-data")
    def save_data(self, request):
        data = request.data
        sub_id = data.get("subscription")
        session_num = data.get("session_number")

        if not sub_id or not session_num:
            raise ValidationError({"detail": "subscription and session_number are required."})
        try:
            sub_id = int(sub_id)
            session_num = int(session_num)
        except (ValueError, TypeError):
            raise ValidationError({"detail": "subscription and session_number must be integers."})

        mark_complete = data.get("mark_complete", False)

        with transaction.atomic():
            session, created = TrainingSession.objects.select_for_update().get_or_create(
                subscription_id=sub_id,
                session_number=session_num,
                defaults={"name": data.get("name", f"Session {session_num}")},
            )

            if not created and session.is_completed:
                if not request.user.is_superuser and session.completed_by != request.user:
                    return Response(
                        {"error": "لا يمكنك تعديل بيانات جلسة تم إكمالها بالفعل بواسطة مدرب آخر."},
                        status=status.HTTP_403_FORBIDDEN,
                    )

            session.name = data.get("name", session.name)

            if mark_complete and not session.is_completed:
                session.is_completed = True
                session.date_completed = timezone.now().date()
                session.completed_by = request.user

                ClientSubscription.objects.filter(pk=sub_id).update(
                    sessions_used=F("sessions_used") + 1
                )
                sub = ClientSubscription.objects.select_related('plan').get(pk=sub_id)
                if sub.plan and sub.sessions_used >= sub.plan.units:
                    sub.is_active = False
                    sub.save(update_fields=["is_active"])

            session.save()

            session.exercises.all().delete()
            exercises_data = data.get("exercises", [])

            exercises_to_create = [
                SessionExercise(
                    training_session=session,
                    order=ex_idx + 1,
                    name=ex_data.get("name", ""),
                    note=ex_data.get("note", ""),
                )
                for ex_idx, ex_data in enumerate(exercises_data)
            ]
            created_exercises = SessionExercise.objects.bulk_create(exercises_to_create)

            sets_to_create = []
            for ex_obj, ex_data in zip(created_exercises, exercises_data):
                for set_idx, set_data in enumerate(ex_data.get("sets", [])):
                    sets_to_create.append(SessionSet(
                        exercise=ex_obj,
                        order=set_idx + 1,
                        reps=set_data.get("reps", ""),
                        weight=set_data.get("weight", ""),
                        technique=set_data.get("technique", "Regular"),
                        equipment=set_data.get("equipment", ""),
                    ))
            if sets_to_create:
                SessionSet.objects.bulk_create(sets_to_create)

        return Response({"status": "success", "session_id": session.id})

    @action(detail=False, methods=["get"])
    def history(self, request):
        sub_id = request.query_params.get("subscription")
        sessions = TrainingSession.objects.filter(
            subscription_id=sub_id,
            is_completed=True,
        ).prefetch_related("exercises__sets").order_by("-date_completed")[:10]

        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)
