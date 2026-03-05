import calendar
import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User, Group
from django.db import transaction
from django.db.models import Sum, Count, Q, F, Case, When, DecimalField
from django.db.models.functions import TruncMonth
from django.utils import timezone

from rest_framework import (
    viewsets, parsers, generics, permissions, serializers,
    filters, status, mixins,
)
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    Client, Country, Subscription, ClientSubscription,
    TrainingPlan, TrainingDaySplit, TrainingExercise, TrainingSet,
    SessionLog, TrainingSession, SessionExercise, SessionSet,
    FoodItem, MealPlan, NutritionPlan, NutritionProgress, FoodDatabase,
    CoachSchedule, GroupSessionLog, GroupSessionParticipant,
    GroupWorkoutTemplate, SessionTransferRequest,
    ManualNutritionSave, ManualWorkoutSave,
)
from .serializers import (
    ClientSerializer, CountrySerializer, SubscriptionSerializer,
    ClientSubscriptionSerializer, TrainingPlanSerializer,
    TrainingExerciseSerializer, SessionLogSerializer,
    TrainingSessionSerializer, FoodItemSerializer,
    MealPlanSerializer, MealPlanCreateSerializer,
    NutritionPlanSerializer, NutritionPlanCreateSerializer,
    NutritionProgressSerializer, FoodDatabaseSerializer,
    CoachScheduleSerializer, GroupSessionLogSerializer,
    GroupSessionParticipantSerializer, GroupWorkoutTemplateSerializer,
    SessionTransferRequestSerializer,
    ManualNutritionSaveSerializer, ManualWorkoutSaveSerializer,
)


# ---------------------------------------------------------------------------
# PAGINATION
# ---------------------------------------------------------------------------

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 1000


class HistoryPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


# ---------------------------------------------------------------------------
# AUTH – JWT with custom claims
# ---------------------------------------------------------------------------

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["first_name"] = user.first_name
        token["is_superuser"] = user.is_superuser
        token["is_receptionist"] = user.groups.filter(name='REC').exists()
        return token


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


# ---------------------------------------------------------------------------
# TRAINERS
# ---------------------------------------------------------------------------

class TrainerSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(
        choices=[('trainer', 'Trainer'), ('rec', 'Receptionist')],
        write_only=True, default='trainer',
    )

    class Meta:
        model = User
        fields = ("id", "username", "first_name", "email", "password", "date_joined", "role")
        extra_kwargs = {"password": {"write_only": True, "required": False}}

    def create(self, validated_data):
        role = validated_data.pop('role', 'trainer')
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
        )
        user.is_staff = False
        user.save()

        if role == 'rec':
            group, _ = Group.objects.get_or_create(name='REC')
            user.groups.add(group)

        return user

    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        password = validated_data.pop("password", None)

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


class ManageTrainersViewSet(viewsets.ModelViewSet):
    serializer_class = TrainerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return User.objects.filter(is_superuser=False).order_by("-date_joined")

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]


# ---------------------------------------------------------------------------
# CLIENTS
# ---------------------------------------------------------------------------

class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "phone", "manual_id"]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = Client.objects.all().order_by("-created_at")
        is_child = self.request.query_params.get('is_child')
        if is_child == 'true':
            queryset = queryset.filter(is_child=True)
        elif is_child == 'false':
            queryset = queryset.filter(is_child=False)
        return queryset


# ---------------------------------------------------------------------------
# SUBSCRIPTIONS
# ---------------------------------------------------------------------------

class SubscriptionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        queryset = Subscription.objects.all().order_by('is_child_plan', 'price')
        target = self.request.query_params.get('target')
        if target == 'child':
            queryset = queryset.filter(is_child_plan=True)
        elif target == 'adult':
            queryset = queryset.filter(is_child_plan=False)
        return queryset


# ---------------------------------------------------------------------------
# DASHBOARD ANALYTICS
# ---------------------------------------------------------------------------

class DashboardAnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        user = request.user
        now = timezone.now()

        is_rec = user.groups.filter(name='REC').exists()

        try:
            month = int(request.query_params.get('month', now.month))
            year = int(request.query_params.get('year', now.year))
        except (ValueError, TypeError):
            month, year = now.month, now.year

        # -------------------------------------------------------------------
        # HELPER: Group Session Revenue Adjustments
        # -------------------------------------------------------------------
        # FIX (N+1 Elimination): The original code executed a fresh DB query
        # for each participant inside a nested loop, resulting in O(p) queries
        # where p = total participants across all group logs for the month.
        # With thousands of clients this crashed production servers.
        #
        # NEW APPROACH:
        #   1. Fetch all group logs + participants in two queries using
        #      select_related / prefetch_related.
        #   2. Collect every client_id that was actually deducted.
        #   3. Fetch ALL relevant ClientSubscription rows in ONE bulk query
        #      using client_id__in.
        #   4. Build a Python dict keyed by client_id (O(1) lookup).
        #   5. Do all revenue math purely in memory – zero extra DB hits.
        # -------------------------------------------------------------------
        def get_group_adjustments():
            group_adjustments = {}  # { trainer_id: Decimal(amount) }

            group_logs = (
                GroupSessionLog.objects
                .filter(date__month=month, date__year=year)
                .select_related('coach')
                .prefetch_related('participants__client')
            )

            # Pass 1: collect all client IDs that need a subscription lookup
            deducted_client_ids = set()
            for log in group_logs:
                for participant in log.participants.all():
                    if participant.deducted and participant.client_id:
                        deducted_client_ids.add(participant.client_id)

            if not deducted_client_ids:
                return group_adjustments

            # Bulk-fetch active subscriptions (one query)
            active_subs = (
                ClientSubscription.objects
                .filter(client_id__in=deducted_client_ids, is_active=True)
                .select_related('plan', 'trainer')
            )
            sub_map = {sub.client_id: sub for sub in active_subs}

            # Bulk-fetch fallback subs for clients with no active subscription (one query)
            missing_ids = deducted_client_ids - set(sub_map.keys())
            if missing_ids:
                fallback_subs = (
                    ClientSubscription.objects
                    .filter(client_id__in=missing_ids)
                    .select_related('plan', 'trainer')
                    .order_by('client_id', '-created_at')
                )
                seen_fallback = set()
                for sub in fallback_subs:
                    if sub.client_id not in seen_fallback:
                        sub_map[sub.client_id] = sub
                        seen_fallback.add(sub.client_id)

            # Pass 2: revenue math – all lookups are now O(1) dict hits
            for log in group_logs:
                coach = log.coach
                if not coach:
                    continue

                for participant in log.participants.all():
                    if not participant.deducted or not participant.client_id:
                        continue

                    client_sub = sub_map.get(participant.client_id)
                    if not client_sub:
                        continue

                    plan = client_sub.plan
                    # FIX: Guard clause replaces bare try/except around division
                    if not plan or not plan.units or plan.units <= 0:
                        continue

                    owner = client_sub.trainer
                    # FIX: plan.price is already a Decimal; no string conversion needed
                    session_value = (plan.price or Decimal(0)) / plan.units

                    if owner and owner.id != coach.id:
                        group_adjustments[owner.id] = (
                            group_adjustments.get(owner.id, Decimal(0)) - session_value
                        )
                        group_adjustments[coach.id] = (
                            group_adjustments.get(coach.id, Decimal(0)) + session_value
                        )

            return group_adjustments

        # -------------------------------------------------------------------
        # VIEW 1: TRAINER
        # -------------------------------------------------------------------
        if not user.is_superuser and not is_rec:
            base_revenue = (
                ClientSubscription.objects
                .filter(trainer=user, created_at__month=month, created_at__year=year)
                .aggregate(total=Sum('plan__price'))['total'] or Decimal(0)
            )

            # Sessions owned by this trainer but completed by someone else
            lost_sessions = (
                TrainingSession.objects
                .filter(
                    subscription__trainer=user,
                    is_completed=True,
                    date_completed__month=month,
                    date_completed__year=year,
                )
                .exclude(completed_by=user)
                .select_related('subscription__plan')
            )

            deduction_amount = Decimal(0)
            for sess in lost_sessions:
                plan = sess.subscription.plan
                if plan and plan.units and plan.units > 0:
                    deduction_amount += (plan.price or Decimal(0)) / plan.units

            # Sessions completed by this trainer on other trainers' clients
            gained_sessions = (
                TrainingSession.objects
                .filter(
                    completed_by=user,
                    is_completed=True,
                    date_completed__month=month,
                    date_completed__year=year,
                )
                .exclude(subscription__trainer=user)
                .select_related('subscription__plan')
            )

            addition_amount = Decimal(0)
            for sess in gained_sessions:
                plan = sess.subscription.plan
                if plan and plan.units and plan.units > 0:
                    addition_amount += (plan.price or Decimal(0)) / plan.units

            # Group session adjustments
            group_adj = get_group_adjustments()
            my_group_adj = group_adj.get(user.id, Decimal(0))
            if my_group_adj > 0:
                addition_amount += my_group_adj
            else:
                deduction_amount += abs(my_group_adj)

            net_revenue = base_revenue - deduction_amount + addition_amount

            subs = (
                ClientSubscription.objects
                .filter(trainer=user, is_active=True)
                .select_related('client', 'plan')
            )

            client_list = []
            for sub in subs:
                photo_full_url = None
                if sub.client.photo:
                    try:
                        photo_full_url = request.build_absolute_uri(sub.client.photo.url)
                    except Exception:
                        photo_full_url = None

                client_list.append({
                    'id': sub.client.id,
                    'subscription_id': sub.id,
                    'name': sub.client.name,
                    'plan': sub.plan.name if sub.plan else "No Plan",
                    # FIX: sessions_used and total_sessions were missing entirely.
                    # The frontend's computeProgress() and SessionsDisplay both depend
                    # on these two fields. Without them, client.sessions_used and
                    # client.total_sessions are both `undefined` in JS, causing
                    # NaN arithmetic and a permanently invisible progress bar.
                    #
                    # total_sessions mirrors plan.units. When plan.units == 0 the
                    # plan is "unlimited"; the frontend treats null/0 as ∞.
                    'sessions_used': sub.sessions_used,
                    'total_sessions': sub.plan.units if sub.plan else None,
                    # Keep the server-side percentage as a cross-check fallback.
                    'progress': sub.progress_percentage,
                    'photo': photo_full_url,
                    'manual_id': sub.client.manual_id,
                    # end_date lets the frontend flag expiring subscriptions
                    # without a separate API call.
                    'end_date': sub.end_date,
                })

            return Response({
                'role': 'trainer',
                'summary': {
                    'active_clients': subs.count(),
                    'base_revenue': round(base_revenue, 2),
                    'deductions': round(deduction_amount, 2),
                    'additions': round(addition_amount, 2),
                    'net_revenue': round(net_revenue, 2),
                },
                'clients': client_list,
            })

        # -------------------------------------------------------------------
        # VIEW 2: RECEPTIONIST
        # -------------------------------------------------------------------
        elif is_rec:
            active_members_count = ClientSubscription.objects.filter(is_active=True).count()
            current_month_qs = ClientSubscription.objects.filter(
                created_at__month=month, created_at__year=year
            )
            new_sales_count = current_month_qs.count()

            today = timezone.now().date()
            checkins_today = TrainingSession.objects.filter(
                is_completed=True, date_completed=today
            ).count()
            group_checkins_today = GroupSessionParticipant.objects.filter(
                session__date__date=today
            ).count()

            recent_subs = (
                current_month_qs
                .select_related('client', 'plan', 'trainer')
                .order_by('-created_at')[:10]
            )
            recent_list = [
                {
                    'id': sub.id,
                    'client_name': sub.client.name,
                    'plan_name': sub.plan.name if sub.plan else "-",
                    'trainer_name': sub.trainer.first_name if sub.trainer else "Unassigned",
                    'date': sub.created_at.date(),
                }
                for sub in recent_subs
            ]

            return Response({
                'role': 'rec',
                'summary': {
                    'active_members': active_members_count,
                    'new_sales_this_month': new_sales_count,
                    'visits_today': checkins_today + group_checkins_today,
                },
                'recent_sales': recent_list,
            })

        # -------------------------------------------------------------------
        # VIEW 3: ADMIN
        # -------------------------------------------------------------------
        else:
            trainers = User.objects.filter(
                is_superuser=False
            ).exclude(groups__name='REC').annotate(
                active_packages=Count(
                    'clientsubscription',
                    filter=Q(clientsubscription__is_active=True)
                ),
                inactive_packages=Count(
                    'clientsubscription',
                    filter=Q(clientsubscription__is_active=False)
                ),
                total_assigned=Count('clientsubscription'),
                base_monthly_revenue=Sum(
                    Case(
                        When(
                            clientsubscription__created_at__month=month,
                            clientsubscription__created_at__year=year,
                            then=F('clientsubscription__plan__price'),
                        ),
                        default=0,
                        output_field=DecimalField(),
                    )
                ),
            )

            cross_sessions = (
                TrainingSession.objects
                .filter(
                    date_completed__month=month,
                    date_completed__year=year,
                    is_completed=True,
                )
                .exclude(completed_by=F('subscription__trainer'))
                .select_related('subscription__plan', 'subscription__trainer', 'completed_by')
            )

            adjustments = {}  # { trainer_id: Decimal }

            for session in cross_sessions:
                plan = session.subscription.plan
                if not plan or not plan.units or plan.units <= 0:
                    continue
                # FIX: Direct Decimal math; plan.price is already a DecimalField value
                session_value = (plan.price or Decimal(0)) / plan.units

                owner = session.subscription.trainer
                if owner:
                    adjustments[owner.id] = adjustments.get(owner.id, Decimal(0)) - session_value

                completer = session.completed_by
                if completer:
                    adjustments[completer.id] = adjustments.get(completer.id, Decimal(0)) + session_value

            group_adj = get_group_adjustments()
            for trainer_id, amount in group_adj.items():
                adjustments[trainer_id] = adjustments.get(trainer_id, Decimal(0)) + amount

            trainers_stats = []
            for trainer in trainers:
                base = trainer.base_monthly_revenue or Decimal(0)
                adjustment = adjustments.get(trainer.id, Decimal(0))
                net = base + adjustment

                trainers_stats.append({
                    'id': trainer.id,
                    'name': trainer.first_name or trainer.username,
                    'active_packages': trainer.active_packages,
                    'inactive_packages': trainer.inactive_packages,
                    'total_assigned': trainer.total_assigned,
                    'base_revenue': round(base, 2),
                    'adjustments': round(adjustment, 2),
                    'net_revenue': round(net, 2),
                })

            current_month_qs = ClientSubscription.objects.filter(
                created_at__month=month, created_at__year=year
            )
            total_sales = current_month_qs.count()
            total_revenue_sales = (
                current_month_qs.aggregate(total=Sum('plan__price'))['total'] or 0
            )

            chart_data = (
                ClientSubscription.objects
                .filter(created_at__year=year)
                .annotate(month=TruncMonth('created_at'))
                .values('month')
                .annotate(revenue=Sum('plan__price'))
                .order_by('month')
            )

            revenue_map = {item['month'].month: item['revenue'] for item in chart_data}
            formatted_chart = [
                {'name': calendar.month_name[i][:3], 'revenue': revenue_map.get(i, 0)}
                for i in range(1, 13)
            ]

            return Response({
                'role': 'admin',
                'trainers_overview': trainers_stats,
                'financials': {
                    'month': month,
                    'year': year,
                    'total_sales': total_sales,
                    'total_revenue': total_revenue_sales,
                    'chart_data': formatted_chart,
                },
            })


# ---------------------------------------------------------------------------
# CLIENT SUBSCRIPTION
# ---------------------------------------------------------------------------

class ClientSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = (
            ClientSubscription.objects.all()
            .select_related('client', 'plan', 'trainer')
            .order_by("-start_date")
        )
        client_id = self.request.query_params.get("client_id")
        if client_id:
            queryset = queryset.filter(client=client_id)
        return queryset

    @action(detail=False, methods=['get'])
    def profile_clients(self, request):
        user = request.user
        queryset = (
            ClientSubscription.objects
            .filter(
                Q(trainer=user) |
                Q(transfer_requests__to_trainer=user, transfer_requests__status='accepted')
            )
            .filter(is_active=True)
            .distinct()
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        with transaction.atomic():
            user = self.request.user
            if user.is_superuser or user.groups.filter(name='REC').exists():
                serializer.save()
            else:
                serializer.save(trainer=user)


# ---------------------------------------------------------------------------
# COUNTRY
# ---------------------------------------------------------------------------

class CountryViewSet(viewsets.ModelViewSet):
    queryset = Country.objects.all().order_by('name')
    serializer_class = CountrySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


# ---------------------------------------------------------------------------
# TRAINING PLAN
# ---------------------------------------------------------------------------

class TrainingPlanViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = TrainingPlan.objects.all()
        sub_id = self.request.query_params.get("subscription_id")
        if sub_id:
            queryset = queryset.filter(subscription_id=sub_id)
        client_id = self.request.query_params.get("client_id")
        if client_id:
            queryset = queryset.filter(subscription__client_id=client_id)
        return queryset.order_by("-created_at")

    def create(self, request, *args, **kwargs):
        data = request.data
        sub_id = data.get("subscription")
        cycle_length = int(data.get("cycle_length"))
        day_names = data.get("day_names", [])

        with transaction.atomic():
            plan = TrainingPlan.objects.create(
                subscription_id=sub_id, cycle_length=cycle_length
            )
            TrainingDaySplit.objects.bulk_create([
                TrainingDaySplit(plan=plan, order=index + 1, name=name)
                for index, name in enumerate(day_names)
            ])

        serializer = self.get_serializer(plan)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# TRAINING EXERCISE (template bulk-update)
# ---------------------------------------------------------------------------

class TrainingExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingExerciseSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = TrainingExercise.objects.all()

    @action(detail=False, methods=["post"], url_path="bulk-update")
    def bulk_update(self, request):
        """
        Replaces all exercises in a given split.

        Note: This endpoint intentionally wipes and recreates exercises because
        its semantic is "apply this exact template" (the plan template, not a
        live session log).  The delete+recreate pattern is acceptable for
        infrequently edited plan templates.
        For live session data, see TrainingSessionViewSet.save_session_data
        which uses a smart-update approach.
        """
        split_id = request.data.get("split_id")
        exercises_data = request.data.get("exercises", [])

        with transaction.atomic():
            TrainingExercise.objects.filter(split_id=split_id).delete()

            for ex_idx, ex_data in enumerate(exercises_data):
                exercise = TrainingExercise.objects.create(
                    split_id=split_id,
                    order=ex_idx + 1,
                    name=ex_data.get("name", "Exercise"),
                    note=ex_data.get("note", ""),
                )
                sets_data = ex_data.get("sets", [])
                TrainingSet.objects.bulk_create([
                    TrainingSet(
                        exercise=exercise,
                        order=set_idx + 1,
                        reps=set_data.get("reps", ""),
                        weight=set_data.get("weight", ""),
                        technique=set_data.get("technique", "Regular"),
                        equipment=set_data.get("equipment") or None,
                    )
                    for set_idx, set_data in enumerate(sets_data)
                ])

        return Response({"status": "success"})


# ---------------------------------------------------------------------------
# SESSION LOG (legacy)
# ---------------------------------------------------------------------------

class SessionLogViewSet(viewsets.ModelViewSet):
    serializer_class = SessionLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = SessionLog.objects.all()
        sub_id = self.request.query_params.get("subscription")
        sess_num = self.request.query_params.get("session_number")
        if sub_id:
            queryset = queryset.filter(subscription_id=sub_id)
        if sess_num:
            queryset = queryset.filter(session_number=sess_num)
        return queryset

    def create(self, request, *args, **kwargs):
        """
        FIX (Single Source of Truth): The old code always deducted sessions,
        which caused double-deduction when a subscription was also managed via
        TrainingSession (the new authoritative system).

        Guard: if any TrainingSession record exists for this subscription we
        skip the deduction here and let TrainingSession be the sole source of
        truth for sessions_used / is_active state.
        """
        sub_id = request.data.get("subscription")
        try:
            sub = ClientSubscription.objects.get(id=sub_id)
        except ClientSubscription.DoesNotExist:
            return Response({"error": "Subscription not found"}, status=404)

        log = super().create(request, *args, **kwargs)

        uses_training_session = TrainingSession.objects.filter(subscription=sub).exists()
        if not uses_training_session:
            sub.sessions_used = SessionLog.objects.filter(subscription=sub).count()
            # FIX: The original condition `sub.plan and sub.sessions_used >= sub.plan.units`
            # was True for unlimited plans (units == 0) because 0 >= 0 → True.
            # This caused every session log on an unlimited plan to immediately
            # deactivate the subscription. Guard with `plan.units > 0`.
            is_expired_sessions = (
                sub.plan
                and sub.plan.units > 0
                and sub.sessions_used >= sub.plan.units
            )
            is_expired_date = sub.end_date and timezone.now().date() > sub.end_date
            if is_expired_sessions or is_expired_date:
                sub.is_active = False
            sub.save()

        return log


# ---------------------------------------------------------------------------
# TRAINING SESSION (authoritative)
# ---------------------------------------------------------------------------

class TrainingSessionViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = TrainingSession.objects.all()
        sub_id = self.request.query_params.get("subscription")
        if sub_id:
            queryset = queryset.filter(subscription_id=sub_id)
        is_completed = self.request.query_params.get("is_completed")
        if is_completed == "true":
            queryset = queryset.filter(is_completed=True)
        elif is_completed == "false":
            queryset = queryset.filter(is_completed=False)
        return queryset

    @action(detail=False, methods=["get"], url_path="get-data")
    def get_session_data(self, request):
        sub_id = request.query_params.get("subscription")
        session_number_param = request.query_params.get("session_number")

        if not sub_id or session_number_param is None:
            return Response(
                {"error": "subscription and session_number are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            session_num = int(session_number_param)
        except (TypeError, ValueError):
            return Response(
                {"error": "session_number must be a valid integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            sub = ClientSubscription.objects.get(id=sub_id)
        except ClientSubscription.DoesNotExist:
            return Response({"error": "Subscription not found"}, status=status.HTTP_404_NOT_FOUND)

        # --- Case 1: session already saved ---
        try:
            session = TrainingSession.objects.get(
                subscription_id=sub_id, session_number=session_num
            )
            response_data = self.get_serializer(session).data

            if session.completed_by:
                response_data["trainer_name"] = (
                    session.completed_by.first_name or session.completed_by.username
                )
            else:
                response_data["trainer_name"] = (
                    sub.trainer.first_name if sub.trainer else "TFG Trainer"
                )

            return Response(response_data)

        except TrainingSession.DoesNotExist:
            pass

        # --- Case 2: simulate from training plan template ---
        plan = getattr(sub, "training_plan", None)
        trainer_name = sub.trainer.first_name if sub.trainer else "TFG Trainer"

        if not plan:
            return Response({
                "name": f"Session {session_num}",
                "exercises": [],
                "trainer_name": trainer_name,
            })

        split_index = (session_num - 1) % plan.cycle_length
        splits = list(plan.splits.prefetch_related('exercises__sets').order_by("order"))

        if not splits:
            return Response({
                "name": f"Session {session_num}",
                "exercises": [],
                "trainer_name": trainer_name,
            })

        target_split = splits[split_index] if split_index < len(splits) else splits[0]

        simulated_data = {
            "id": None,
            "session_number": session_num,
            "name": target_split.name,
            "is_completed": False,
            "trainer_name": trainer_name,
            "exercises": [
                {
                    "name": ex.name,
                    "note": ex.note,
                    "sets": [
                        {
                            "reps": s.reps,
                            "weight": s.weight,
                            "technique": s.technique,
                            "equipment": s.equipment,
                        }
                        for s in ex.sets.all()
                    ],
                }
                for ex in target_split.exercises.all()
            ],
        }

        return Response(simulated_data)

    @action(detail=False, methods=["post"], url_path="save-data")
    def save_session_data(self, request):
        """
        FIX (DB ID Churn): The original code called session.exercises.all().delete()
        then re-inserted every exercise and set on EVERY save, including auto-saves.
        This:
          - Burned through primary-key sequences rapidly.
          - Destroyed any FK references to old exercise/set rows.
          - Created unnecessary write load on the DB.

        NEW APPROACH – Smart Update:
          - Match incoming exercises to existing ones by their list index (order).
          - UPDATE rows that already exist.
          - CREATE only genuinely new rows.
          - DELETE only rows that were removed from the payload.
        Same pattern is applied to sets within each exercise.
        """
        data = request.data
        sub_id = data.get("subscription")
        session_number = data.get("session_number")
        exercises = data.get("exercises", [])
        complete_it = data.get("mark_complete", False)

        try:
            sub = ClientSubscription.objects.get(id=sub_id)
        except ClientSubscription.DoesNotExist:
            return Response({"error": "Subscription not found"}, status=404)

        with transaction.atomic():
            session, created = TrainingSession.objects.get_or_create(
                subscription=sub,
                session_number=session_number,
                defaults={"name": data.get("name", "Workout")},
            )

            # Security: completed sessions are locked to the person who completed them
            if session.is_completed and not request.user.is_superuser:
                if session.completed_by and session.completed_by != request.user:
                    return Response(
                        {
                            "error": (
                                f"Locked! This session was completed by "
                                f"{session.completed_by.first_name}. Only they can edit it."
                            )
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

            session.name = data.get("name", session.name)

            if complete_it:
                session.is_completed = True
                session.date_completed = timezone.now().date()
                session.completed_by = request.user

            session.save()

            # ------------------------------------------------------------------
            # Smart Update: exercises
            # ------------------------------------------------------------------
            existing_exercises = list(
                session.exercises.prefetch_related('sets').order_by('order')
            )
            existing_count = len(existing_exercises)
            incoming_count = len(exercises)

            for i, ex_data in enumerate(exercises):
                if i < existing_count:
                    # Update existing exercise row (no new PK consumed)
                    ex_obj = existing_exercises[i]
                    ex_obj.name = ex_data.get('name', ex_obj.name)
                    ex_obj.note = ex_data.get('note', '')
                    ex_obj.order = i + 1
                    ex_obj.save()
                else:
                    # Create genuinely new exercise
                    ex_obj = SessionExercise.objects.create(
                        training_session=session,
                        order=i + 1,
                        name=ex_data.get('name', 'Exercise'),
                        note=ex_data.get('note', ''),
                    )

                # Smart Update: sets within this exercise
                incoming_sets = ex_data.get('sets', [])
                existing_sets = list(ex_obj.sets.order_by('order'))
                existing_sets_count = len(existing_sets)

                for j, set_data in enumerate(incoming_sets):
                    if j < existing_sets_count:
                        s_obj = existing_sets[j]
                        s_obj.reps = set_data.get('reps', '')
                        s_obj.weight = set_data.get('weight', '')
                        s_obj.technique = set_data.get('technique', 'Regular')
                        s_obj.equipment = set_data.get('equipment') or None
                        s_obj.order = j + 1
                        s_obj.save()
                    else:
                        SessionSet.objects.create(
                            exercise=ex_obj,
                            order=j + 1,
                            reps=set_data.get('reps', ''),
                            weight=set_data.get('weight', ''),
                            technique=set_data.get('technique', 'Regular'),
                            equipment=set_data.get('equipment') or None,
                        )

                # Delete sets that were removed from the payload
                if len(incoming_sets) < existing_sets_count:
                    for s_obj in existing_sets[len(incoming_sets):]:
                        s_obj.delete()

            # Delete exercises that were removed from the payload
            if incoming_count < existing_count:
                for ex_obj in existing_exercises[incoming_count:]:
                    ex_obj.delete()

            # ------------------------------------------------------------------
            # Subscription deduction (only when marking complete)
            # ------------------------------------------------------------------
            if complete_it:
                sub.sessions_used = TrainingSession.objects.filter(
                    subscription=sub, is_completed=True
                ).count()

                is_finished_sessions = (
                    sub.plan and sub.plan.units and sub.plan.units > 0
                    and sub.sessions_used >= sub.plan.units
                )
                is_expired_date = (
                    sub.end_date and timezone.now().date() > sub.end_date
                )

                if is_finished_sessions or is_expired_date:
                    sub.is_active = False
                sub.save()

        return Response({"status": "saved"})

    @action(detail=False, methods=["get"], url_path="history")
    def get_history(self, request):
        sub_id = request.query_params.get("subscription")

        try:
            sub = ClientSubscription.objects.get(id=sub_id)
        except ClientSubscription.DoesNotExist:
            return Response([])

        plan = getattr(sub, "training_plan", None)
        if not plan:
            return Response([])

        cycle_len = plan.cycle_length

        # FIX: prefetch_related eliminates N+1 from session.exercises.exists() in the loop
        history = (
            TrainingSession.objects
            .filter(subscription=sub)
            .prefetch_related('exercises__sets')
            .order_by("-date_completed", "-created_at", "-session_number")
        )

        latest_days = {}

        for session in history:
            # With prefetch_related, all() uses the cache; no extra query
            if not session.exercises.all():
                continue

            day_index = (session.session_number - 1) % cycle_len

            if day_index not in latest_days:
                latest_days[day_index] = {
                    "id": session.id,
                    "name": session.name,
                    "session_number": session.session_number,
                    "date": session.date_completed or session.created_at.date(),
                    "exercises": TrainingSessionSerializer(session).data["exercises"],
                }

            if len(latest_days) >= cycle_len:
                break

        result = [latest_days[k] for k in sorted(latest_days.keys())]
        return Response(result)


# ---------------------------------------------------------------------------
# NUTRITION PLAN
# ---------------------------------------------------------------------------

class NutritionPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return NutritionPlanCreateSerializer
        return NutritionPlanSerializer

    def get_queryset(self):
        queryset = NutritionPlan.objects.all()
        subscription_id = self.request.query_params.get("subscription_id")
        if subscription_id:
            queryset = queryset.filter(subscription_id=subscription_id)
        client_id = self.request.query_params.get("client_id")
        if client_id:
            queryset = queryset.filter(subscription__client_id=client_id)
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def weekly_overview(self, request, pk=None):
        nutrition_plan = self.get_object()
        meal_plans = nutrition_plan.meal_plans.all()

        # FIX: MealPlan.day is an IntegerField (1–7 or 1–14).
        # The original code filtered with string day names ("Monday" …)
        # against an IntegerField — Django silently returned empty querysets,
        # so every day always showed 0 calories/meals.
        # Now we iterate over integer day numbers 1–7 and return numeric keys.
        # If callers expected string keys, update the frontend to use 1–7.
        DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        weekly_data = {}
        for day_num in range(1, 8):
            day_meals = meal_plans.filter(day=day_num)
            weekly_data[DAY_NAMES[day_num - 1]] = {
                "day": day_num,
                "total_calories": sum(m.total_calories for m in day_meals),
                "total_protein": sum(m.total_protein for m in day_meals),
                "total_carbs": sum(m.total_carbs for m in day_meals),
                "total_fats": sum(m.total_fats for m in day_meals),
                "meals_count": day_meals.count(),
                "completed_meals": day_meals.filter(is_completed=True).count(),
            }
        return Response(weekly_data)

    @action(detail=True, methods=["post"])
    def duplicate_week(self, request, pk=None):
        nutrition_plan = self.get_object()
        original_meals = list(nutrition_plan.meal_plans.all().prefetch_related("foods"))

        if not original_meals:
            return Response(
                {"error": "No meals to duplicate"}, status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # FIX: Removed reference to nutrition_plan.notes (field does not exist).
            # FIX: Added calc_carb_adjustment which was missing from the copy.
            plan_fields = {
                "subscription_id": nutrition_plan.subscription_id,
                "name": f"{nutrition_plan.name} (Copy)",
                "duration_weeks": nutrition_plan.duration_weeks,
                "calc_gender": nutrition_plan.calc_gender,
                "calc_age": nutrition_plan.calc_age,
                "calc_height": nutrition_plan.calc_height,
                "calc_weight": nutrition_plan.calc_weight,
                "calc_activity_level": nutrition_plan.calc_activity_level,
                "calc_tdee": nutrition_plan.calc_tdee,
                "calc_defer_cal": nutrition_plan.calc_defer_cal,
                "calc_fat_percent": nutrition_plan.calc_fat_percent,
                "calc_protein_multiplier": nutrition_plan.calc_protein_multiplier,
                "calc_protein_advance": nutrition_plan.calc_protein_advance,
                "calc_meals": nutrition_plan.calc_meals,
                "calc_snacks": nutrition_plan.calc_snacks,
                "calc_carb_adjustment": nutrition_plan.calc_carb_adjustment,
                "target_calories": nutrition_plan.target_calories,
                "target_protein": nutrition_plan.target_protein,
                "target_carbs": nutrition_plan.target_carbs,
                "target_fats": nutrition_plan.target_fats,
                "created_by": request.user,
            }
            new_plan = NutritionPlan.objects.create(**plan_fields)

            food_items_to_create = []
            for meal in original_meals:
                new_meal = MealPlan.objects.create(
                    nutrition_plan=new_plan,
                    day=meal.day,
                    meal_type=meal.meal_type,
                    meal_name=meal.meal_name,
                    meal_time=meal.meal_time,
                    total_calories=meal.total_calories,
                    total_protein=meal.total_protein,
                    total_carbs=meal.total_carbs,
                    total_fats=meal.total_fats,
                    notes=meal.notes,
                )
                for food in meal.foods.all():
                    # FIX: Use correct FoodItem field names.
                    # Original code referenced food.quantity (→ food.amount),
                    # food.fiber, food.category, food.preparation — none of which
                    # exist on the FoodItem model.
                    food_items_to_create.append(FoodItem(
                        meal_plan=new_meal,
                        name=food.name,
                        amount=food.amount,
                        unit=food.unit,
                        calories=food.calories,
                        protein=food.protein,
                        carbs=food.carbs,
                        fats=food.fats,
                        order=food.order,
                    ))

            if food_items_to_create:
                FoodItem.objects.bulk_create(food_items_to_create)

        return Response({"status": "Week duplicated successfully", "new_plan_id": new_plan.id})


# ---------------------------------------------------------------------------
# MEAL PLAN
# ---------------------------------------------------------------------------

class MealPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return MealPlanCreateSerializer
        return MealPlanSerializer

    def get_queryset(self):
        queryset = MealPlan.objects.all()
        nutrition_plan_id = self.request.query_params.get("nutrition_plan_id")
        if nutrition_plan_id:
            queryset = queryset.filter(nutrition_plan_id=nutrition_plan_id)
        day = self.request.query_params.get("day")
        if day:
            queryset = queryset.filter(day=day)
        meal_type = self.request.query_params.get("meal_type")
        if meal_type:
            queryset = queryset.filter(meal_type=meal_type)
        return queryset.select_related("nutrition_plan").prefetch_related("foods")

    @action(detail=True, methods=["post"])
    def mark_completed(self, request, pk=None):
        meal_plan = self.get_object()
        meal_plan.is_completed = True
        meal_plan.completed_at = timezone.now()
        meal_plan.save()
        return Response({"status": "Meal marked as completed"})

    @action(detail=True, methods=["post"])
    def add_photo(self, request, pk=None):
        meal_plan = self.get_object()
        photo = request.FILES.get("photo")
        if photo:
            meal_plan.photo = photo
            meal_plan.save()
            return Response({"status": "Photo uploaded successfully"})
        return Response({"error": "No photo provided"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def calculate_totals(self, request, pk=None):
        meal_plan = self.get_object()
        foods = meal_plan.foods.all()
        meal_plan.total_calories = sum(f.calories for f in foods)
        meal_plan.total_protein = sum(f.protein for f in foods)
        meal_plan.total_carbs = sum(f.carbs for f in foods)
        meal_plan.total_fats = sum(f.fats for f in foods)
        meal_plan.save()
        serializer = self.get_serializer(meal_plan)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# FOOD ITEM
# ---------------------------------------------------------------------------

class FoodItemViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]
    serializer_class = FoodItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = FoodItem.objects.all()
        meal_plan_id = self.request.query_params.get("meal_plan_id")
        if meal_plan_id:
            queryset = queryset.filter(meal_plan_id=meal_plan_id)
        return queryset.select_related("meal_plan")

    def _recalculate_meal_totals(self, meal_plan):
        foods = meal_plan.foods.all()
        meal_plan.total_calories = sum(f.calories for f in foods)
        meal_plan.total_protein = sum(f.protein for f in foods)
        meal_plan.total_carbs = sum(f.carbs for f in foods)
        meal_plan.total_fats = sum(f.fats for f in foods)
        meal_plan.save()

    def perform_create(self, serializer):
        food_item = serializer.save()
        self._recalculate_meal_totals(food_item.meal_plan)

    def perform_destroy(self, instance):
        meal_plan = instance.meal_plan
        instance.delete()
        self._recalculate_meal_totals(meal_plan)


# ---------------------------------------------------------------------------
# NUTRITION PROGRESS
# ---------------------------------------------------------------------------

class NutritionProgressViewSet(viewsets.ModelViewSet):
    serializer_class = NutritionProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = NutritionProgress.objects.all()
        nutrition_plan_id = self.request.query_params.get("nutrition_plan_id")
        if nutrition_plan_id:
            queryset = queryset.filter(nutrition_plan_id=nutrition_plan_id)
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        return queryset.select_related("nutrition_plan")

    @action(detail=False, methods=["get"])
    def weekly_progress(self, request):
        nutrition_plan_id = request.query_params.get("nutrition_plan_id")
        if not nutrition_plan_id:
            return Response(
                {"error": "nutrition_plan_id required"}, status=status.HTTP_400_BAD_REQUEST
            )
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        progress = NutritionProgress.objects.filter(
            nutrition_plan_id=nutrition_plan_id, date__range=[week_start, week_end]
        )
        serializer = self.get_serializer(progress, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# FOOD DATABASE
# ---------------------------------------------------------------------------

class FoodDatabaseViewSet(viewsets.ModelViewSet):
    serializer_class = FoodDatabaseSerializer
    permission_classes = [IsAuthenticated]
    queryset = FoodDatabase.objects.all()

    @action(detail=False, methods=["get"])
    def search(self, request):
        query = request.query_params.get("q", "")
        category = request.query_params.get("category", "")
        queryset = self.get_queryset()
        if query:
            queryset = queryset.filter(name__icontains=query)
        if category:
            queryset = queryset.filter(category=category)
        queryset = queryset[:20]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# COACH SCHEDULE & GROUP TRAINING
# ---------------------------------------------------------------------------

class CoachScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = CoachScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = CoachSchedule.objects.all()
        coach_id = self.request.query_params.get('coach_id')
        if coach_id:
            queryset = queryset.filter(coach_id=coach_id)
        return queryset

    @action(detail=False, methods=['get'])
    def get_trainers(self, request):
        trainers = User.objects.filter(is_superuser=False).values('id', 'first_name', 'username')
        return Response(list(trainers))



class GroupTrainingViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @action(detail=False, methods=['get'])
    def schedule(self, request):
        coach_id = request.query_params.get('coach_id')
        queryset = CoachSchedule.objects.filter(
            client__subscriptions__is_active=True
        ).select_related('client', 'coach')

        if coach_id:
            queryset = queryset.filter(coach_id=coach_id)

        queryset = queryset.distinct()
        serializer = CoachScheduleSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add_to_schedule(self, request):
        coach_id = request.data.get('coach')
        client_id = request.data.get('client')
        day = request.data.get('day')
        session_time = request.data.get('session_time')

        if not all([coach_id, client_id, day]):
            return Response({"error": "Missing fields"}, status=400)

        obj, created = CoachSchedule.objects.get_or_create(
            coach_id=coach_id,
            client_id=client_id,
            day=day,
            defaults={'session_time': session_time} if session_time else {},
        )

        if not created and session_time:
            obj.session_time = session_time
            obj.save()

        serializer = CoachScheduleSerializer(obj, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['delete'])
    def remove_from_schedule(self, request):
        pk = request.query_params.get('id')
        CoachSchedule.objects.filter(id=pk).delete()
        return Response({'status': 'deleted'})

    @action(detail=False, methods=['get'])
    def history(self, request):
        user = request.user

        if user.is_superuser:
            logs = GroupSessionLog.objects.all()
        else:
            logs = GroupSessionLog.objects.filter(coach=user)

        logs = logs.select_related('coach').prefetch_related('participants__client').order_by('-date')

        paginator = HistoryPagination()
        page = paginator.paginate_queryset(logs, request, view=self)

        if page is not None:
            serializer = GroupSessionLogSerializer(page, many=True, context={'request': request})
            return paginator.get_paginated_response(serializer.data)

        serializer = GroupSessionLogSerializer(logs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def retrieve_session(self, request, pk=None):
        """Return a single GroupSessionLog with full participant + exercise data."""
        try:
            log = (
                GroupSessionLog.objects
                .select_related('coach')
                .prefetch_related('participants__client')
                .get(pk=pk)
            )
        except GroupSessionLog.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        serializer = GroupSessionLogSerializer(log, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def complete_session(self, request):
        """
        Save a completed group session.

        Payload (no timer/duration fields):
        {
            "day_name": "Leg Day",
            "exercises": [
                {
                    "name":       "Barbell Squat",
                    "category":   "weight",        // "weight" | "reps" | "time"
                    "sets_count": 4,
                    "results": [
                        {
                            "client":    "Ahmed Ali",
                            "client_id": 12,
                            "val1":      "80",     // kg | reps | minutes
                            "val2":      "10",     // reps | "" | seconds
                            "note":      ""
                        }
                    ]
                }
            ],
            "participants": [
                {"client_id": 12, "note": "Good session"}
            ]
        }

        Returns: {"status": "Session Completed & Subscriptions Deducted", "id": <int>}
        """
        data              = request.data
        coach             = request.user
        day_name          = data.get('day_name', '')
        exercises         = data.get('exercises', [])
        participants_data = data.get('participants', [])

        if not day_name:
            return Response({"error": "day_name is required"}, status=400)

        # Normalise exercises: accept legacy 'type' field as fallback for 'category'
        normalised_exercises = []
        for ex in (exercises if isinstance(exercises, list) else []):
            normalised_exercises.append({
                'name':       str(ex.get('name', '')).strip(),
                'category':   ex.get('category') or _legacy_type_to_category(ex.get('type', '')),
                'sets_count': int(ex.get('sets_count') or 0),
                'results':    [
                    {
                        'client':    str(r.get('client', '')),
                        'client_id': r.get('client_id'),
                        'val1':      str(r.get('val1', '')),
                        'val2':      str(r.get('val2', '')),
                        'val3':      str(r.get('val3', '')),
                        'note':      str(r.get('note', '')),
                    }
                    for r in (ex.get('results', []) if isinstance(ex.get('results'), list) else [])
                ],
            })

        with transaction.atomic():
            log = GroupSessionLog.objects.create(
                coach=coach,
                day_name=day_name,
                exercises_summary=normalised_exercises,
            )

            client_ids = [
                p.get('client_id') for p in participants_data
                if p.get('client_id') is not None
            ]
            active_subs = (
                ClientSubscription.objects
                .filter(client_id__in=client_ids, is_active=True)
                .select_related('plan')
            )
            sub_map = {sub.client_id: sub for sub in active_subs}

            participants_to_create = []
            subs_to_save = []

            for p_data in participants_data:
                client_id = p_data.get('client_id')
                if client_id is None:
                    continue

                note      = str(p_data.get('note', '') or '')
                deducted  = False
                sub       = sub_map.get(client_id)

                if sub:
                    sub.sessions_used += 1
                    # FIX: Also check end_date expiry, mirroring the logic in
                    # TrainingSessionViewSet.save_session_data.  Previously,
                    # group sessions only triggered deactivation on session count
                    # exhaustion but never on date expiry — an inconsistency that
                    # left date-expired subscriptions permanently active.
                    is_finished_sessions = (
                        sub.plan
                        and sub.plan.units
                        and sub.sessions_used >= sub.plan.units
                    )
                    is_expired_date = (
                        sub.end_date and timezone.now().date() > sub.end_date
                    )
                    if is_finished_sessions or is_expired_date:
                        sub.is_active = False
                    subs_to_save.append(sub)
                    deducted = True

                participants_to_create.append(
                    GroupSessionParticipant(
                        session=log,
                        client_id=client_id,
                        note=note,
                        deducted=deducted,
                    )
                )

            for sub in subs_to_save:
                sub.save()

            GroupSessionParticipant.objects.bulk_create(participants_to_create)

        return Response({
            'status': 'Session Completed & Subscriptions Deducted',
            'id':     log.id,
        }, status=201)

    @action(detail=False, methods=['get'])
    def client_history(self, request):
        """Return paginated session history for a specific child."""
        client_id = request.query_params.get('client_id')
        user = request.user

        if not client_id:
            return Response({"error": "client_id is required"}, status=400)

        participations = (
            GroupSessionParticipant.objects
            .filter(client_id=client_id)
            .select_related('session__coach', 'client')
        )

        if not user.is_superuser:
            participations = participations.filter(session__coach=user)

        participations = participations.order_by('-session__date')

        paginator = HistoryPagination()
        page = paginator.paginate_queryset(participations, request, view=self)

        page_data = page if page is not None else participations
        history_data = []

        for p in page_data:
            session = p.session
            client_name = p.client.name if p.client else ""

            exercises_data = session.exercises_summary
            if isinstance(exercises_data, str):
                try:
                    exercises_data = json.loads(exercises_data)
                except (json.JSONDecodeError, TypeError):
                    exercises_data = []

            child_performance = []
            if isinstance(exercises_data, list):
                for ex in exercises_data:
                    results = ex.get('results', [])
                    user_res = next(
                        (r for r in results if r.get('client') == client_name or str(r.get('client_id')) == str(client_id)), None
                    )
                    if user_res:
                        child_performance.append({
                            'exercise':   ex.get('name', 'Unknown'),
                            'category':   ex.get('category') or _legacy_type_to_category(ex.get('type', '')),
                            'sets_count': ex.get('sets_count', 0),
                            'val1':       user_res.get('val1', '-'),
                            'val2':       user_res.get('val2', '-'),
                            'val3':       user_res.get('val3', '-'),
                            'note':       user_res.get('note', ''),
                        })

            history_data.append({
                'id':           session.id,
                'date':         session.date,
                'day_name':     session.day_name,
                'coach':        session.coach.first_name if session.coach else "Unknown",
                'session_note': p.note,
                'performance':  child_performance,
            })

        if page is not None:
            return paginator.get_paginated_response(history_data)

        return Response(history_data)

    @action(detail=False, methods=['post'])
    def bulk_exercise_history(self, request):
        """
        Efficiently fetch the last recorded performance for multiple clients
        across multiple exercises in a single request.

        Request:
        {
            "day_name":       "Leg Day",
            "exercise_names": ["Barbell Squat", "Leg Press"],
            "client_ids":     [12, 34, 56]
        }

        Response:
        {
            "12": {
                "Barbell Squat": {"found": true,  "category": "weight", "sets_count": 4, "val1": "80", "val2": "10"},
                "Leg Press":     {"found": false}
            },
            "34": { ... }
        }
        """
        day_name       = str(request.data.get('day_name', '') or '').strip()
        exercise_names = request.data.get('exercise_names', [])
        client_ids     = request.data.get('client_ids', [])
        user           = request.user

        if not (day_name and isinstance(exercise_names, list) and exercise_names and isinstance(client_ids, list) and client_ids):
            return Response({})

        ex_name_set = {str(n).strip().lower() for n in exercise_names}

        participations = (
            GroupSessionParticipant.objects
            .filter(client_id__in=client_ids, session__day_name=day_name)
            .select_related('session', 'client')
            .order_by('-session__date')
        )

        if not user.is_superuser:
            participations = participations.filter(session__coach=user)

        result   = {str(cid): {ename: None for ename in exercise_names} for cid in client_ids}
        resolved = {str(cid): set() for cid in client_ids}

        for p in participations:
            client_id_str = str(p.client_id)
            client_name   = p.client.name if p.client else ""

            if len(resolved.get(client_id_str, set())) == len(exercise_names):
                continue

            exercises_data = p.session.exercises_summary
            if isinstance(exercises_data, str):
                try:
                    exercises_data = json.loads(exercises_data)
                except Exception:
                    exercises_data = []

            for ex in (exercises_data if isinstance(exercises_data, list) else []):
                ex_name = str(ex.get('name', '')).strip()
                if ex_name.lower() not in ex_name_set:
                    continue
                if ex_name in resolved.get(client_id_str, set()):
                    continue

                results  = ex.get('results', []) if isinstance(ex.get('results'), list) else []
                user_res = next(
                    (r for r in results
                     if r.get('client') == client_name or str(r.get('client_id')) == client_id_str),
                    None,
                )
                if user_res:
                    result[client_id_str][ex_name] = {
                        'found':      True,
                        'category':   ex.get('category') or _legacy_type_to_category(ex.get('type', '')),
                        'sets_count': int(ex.get('sets_count') or 0),
                        'val1':       str(user_res.get('val1', '')),
                        'val2':       str(user_res.get('val2', '')),
                        'val3':       str(user_res.get('val3', '')),
                        'note':       str(user_res.get('note', '')),
                    }
                    resolved.setdefault(client_id_str, set()).add(ex_name)

        # Resolve unmatched entries to {"found": False}
        for cid_str in result:
            for ename in result[cid_str]:
                if result[cid_str][ename] is None:
                    result[cid_str][ename] = {'found': False}

        return Response(result)


def _legacy_type_to_category(type_str: str) -> str:
    """Convert the old 'type' field value to the new category system."""
    mapping = {
        'strength': 'weight',
        'cardio':   'time',
        'time':     'time',
        'weight':   'weight',
        'reps':     'reps',
    }
    return mapping.get((type_str or '').lower(), 'weight')


class GroupWorkoutTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = GroupWorkoutTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = GroupWorkoutTemplate.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# ---------------------------------------------------------------------------
# SESSION TRANSFER
# ---------------------------------------------------------------------------

class SessionTransferRequestViewSet(viewsets.ModelViewSet):
    serializer_class = SessionTransferRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return SessionTransferRequest.objects.filter(
            Q(from_trainer=user) | Q(to_trainer=user)
        ).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(from_trainer=self.request.user)

    @action(detail=True, methods=['post'])
    def respond(self, request, pk=None):
        transfer = self.get_object()
        new_status = request.data.get('status')

        if transfer.to_trainer != request.user:
            return Response({"error": "Not authorized to respond to this request"}, status=403)

        if new_status not in ['accepted', 'rejected']:
            return Response({"error": "Invalid status"}, status=400)

        transfer.status = new_status
        transfer.save()
        return Response({"status": "success", "new_status": new_status})


# ---------------------------------------------------------------------------
# MANUAL SAVES
# ---------------------------------------------------------------------------

class ManualNutritionSaveViewSet(viewsets.ModelViewSet):
    serializer_class = ManualNutritionSaveSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ManualNutritionSave.objects.filter(
            user=self.request.user
        ).order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ManualWorkoutSaveViewSet(viewsets.ModelViewSet):
    serializer_class = ManualWorkoutSaveSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ManualWorkoutSave.objects.filter(
            user=self.request.user
        ).order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
