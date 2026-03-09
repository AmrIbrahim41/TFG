import calendar
import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import (
    Sum, Count, Q, F, Case, When, DecimalField, ExpressionWrapper,
)
from django.db.models.functions import TruncMonth
from django.utils import timezone

from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
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
    TrainerShift, TrainerSchedule,
)
from .serializers import (
    # FIX #22: TrainerSerializer now lives in serializers.py where it belongs.
    TrainerSerializer, TrainerPublicSerializer,
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
    TrainerShiftSerializer, TrainerScheduleSerializer,
)


# ---------------------------------------------------------------------------
# PAGINATION
# FIX #20: max_page_size reduced from 1000 to 100 to prevent large accidental
# dumps. Callers that genuinely need bulk export should use a dedicated endpoint.
# ---------------------------------------------------------------------------

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 100  # was 1000 — see review finding #20


class HistoryPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ---------------------------------------------------------------------------
# AUTH – JWT with custom claims + login-rate throttle
# FIX #16: LoginRateThrottle limits unauthenticated login attempts to 10/min
# per IP address.  Add the matching rate to your DRF settings:
#
#   REST_FRAMEWORK = {
#       'DEFAULT_THROTTLE_RATES': {
#           'login_anon': '10/min',
#       },
#   }
# ---------------------------------------------------------------------------

class LoginRateThrottle(AnonRateThrottle):
    """
    Brute-force mitigation for POST /auth/login/.
    Keyed on the remote IP address via DRF's AnonRateThrottle mechanism.
    """
    scope = 'login_anon'


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['first_name'] = user.first_name
        token['is_superuser'] = user.is_superuser
        token['is_receptionist'] = user.groups.filter(name='REC').exists()
        return token


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
    # FIX #16: Apply login rate throttle to this view only.
    throttle_classes = [LoginRateThrottle]


# ---------------------------------------------------------------------------
# TRAINERS
# FIX #15: Non-admin users now receive TrainerPublicSerializer (id + name only).
#           Sensitive fields (email, date_joined) are hidden from other trainers.
#           Mutating actions (create/update/destroy) remain admin-only.
# FIX #22: TrainerSerializer moved to serializers.py (no longer defined here).
# ---------------------------------------------------------------------------

class ManageTrainersViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return User.objects.filter(is_superuser=False).order_by('-date_joined')

    def get_serializer_class(self):
        """
        Admins: full TrainerSerializer (all fields, password write).
        Other authenticated users: TrainerPublicSerializer (id + name only).
        """
        if self.request.user.is_superuser:
            return TrainerSerializer
        return TrainerPublicSerializer

    def get_permissions(self):
        """
        list / retrieve: any authenticated user may read (with limited fields).
        create / update / partial_update / destroy: admin only.
        """
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]


# ---------------------------------------------------------------------------
# CLIENTS
# ---------------------------------------------------------------------------

class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'phone', 'manual_id']
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = Client.objects.prefetch_related('subscriptions__trainer').order_by('-created_at')

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

def _compute_group_adjustments(month: int, year: int) -> dict:
    """
    FIX #18: Replaces the original nested Python loops + two-phase subscription
    lookup with a single annotated queryset.

    Returns { trainer_id: Decimal } representing net revenue adjustments for
    cross-trainer group-session completions in the given month/year.
    A positive value means the trainer *gained* revenue (completed someone else's
    client sessions); a negative value means they *lost* it.

    Design decisions:
    • We only consider participants where the client has an ACTIVE subscription.
      The original code had a fallback to the most-recent inactive sub for edge
      cases of just-expired subscriptions.  That path is intentionally removed
      here because: (a) the management command deactivates subscriptions nightly
      so the window is very small, and (b) the model's save() also deactivates on
      expiry — so by the time a group log is saved, the sub should already be
      correct.  If your business requires the fallback, add a Coalesce subquery.
    • Using .values().distinct() returns one flat dict per (coach, owner, price,
      units) combination rather than full ORM instances — minimal memory use.
    """
    qs = (
        GroupSessionParticipant.objects
        .filter(
            deducted=True,
            client__isnull=False,
            session__date__month=month,
            session__date__year=year,
            session__coach__isnull=False,
            # Only where the client has an active subscription with a valid plan
            client__subscriptions__is_active=True,
            client__subscriptions__plan__units__gt=0,
            client__subscriptions__trainer__isnull=False,
        )
        .annotate(
            coach_id_ann=F('session__coach_id'),
            owner_id_ann=F('client__subscriptions__trainer_id'),
            price_ann=F('client__subscriptions__plan__price'),
            units_ann=F('client__subscriptions__plan__units'),
        )
        # Only adjust when the session coach ≠ the subscription owner
        .exclude(coach_id_ann=F('owner_id_ann'))
        .values('coach_id_ann', 'owner_id_ann', 'price_ann', 'units_ann')
        .distinct()
    )

    adjustments: dict = {}
    for row in qs:
        # Both price and units are guaranteed non-None/non-zero by the filters above
        session_value = Decimal(str(row['price_ann'])) / Decimal(str(row['units_ann']))
        owner = row['owner_id_ann']
        coach = row['coach_id_ann']
        adjustments[owner] = adjustments.get(owner, Decimal(0)) - session_value
        adjustments[coach] = adjustments.get(coach, Decimal(0)) + session_value

    return adjustments


class DashboardAnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        user = request.user
        now = timezone.now()

        is_rec = user.groups.filter(name='REC').exists()

        try:
            month = int(request.query_params.get('month', now.month))
            year  = int(request.query_params.get('year', now.year))
        except (ValueError, TypeError):
            month, year = now.month, now.year

        # ── VIEW 1: TRAINER ───────────────────────────────────────────────
        if not user.is_superuser and not is_rec:
            base_revenue = (
                ClientSubscription.objects
                .filter(trainer=user, created_at__month=month, created_at__year=year)
                .aggregate(total=Sum('plan__price'))['total'] or Decimal(0)
            )

            _session_value_expr = ExpressionWrapper(
                F('subscription__plan__price') / F('subscription__plan__units'),
                output_field=DecimalField(max_digits=12, decimal_places=4),
            )

            deduction_amount = (
                TrainingSession.objects
                .filter(
                    subscription__trainer=user,
                    is_completed=True,
                    date_completed__month=month,
                    date_completed__year=year,
                    subscription__plan__units__gt=0,
                )
                .exclude(completed_by=user)
                .exclude(completed_by=None)
                .annotate(session_value=_session_value_expr)
                .aggregate(total=Sum('session_value'))['total'] or Decimal(0)
            )

            addition_amount = (
                TrainingSession.objects
                .filter(
                    completed_by=user,
                    is_completed=True,
                    date_completed__month=month,
                    date_completed__year=year,
                    subscription__plan__units__gt=0,
                )
                .exclude(subscription__trainer=user)
                .annotate(session_value=_session_value_expr)
                .aggregate(total=Sum('session_value'))['total'] or Decimal(0)
            )

            group_adj = _compute_group_adjustments(month, year)
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
                    'id':              sub.client.id,
                    'subscription_id': sub.id,
                    'name':            sub.client.name,
                    'plan':            sub.plan.name if sub.plan else 'No Plan',
                    'sessions_used':   sub.sessions_used,
                    'total_sessions':  sub.plan.units if sub.plan else 0,
                    'photo':           photo_full_url,
                    'end_date':        sub.end_date,
                })

            return Response({
                'role': 'trainer',
                'summary': {
                    'active_clients': len(client_list),
                    'base_revenue':   round(base_revenue, 2),
                    'net_revenue':    round(net_revenue, 2),
                    'deductions':     round(deduction_amount, 2),
                    'additions':      round(addition_amount, 2),
                },
                'clients': client_list,
            })

        # ── VIEW 2: RECEPTIONIST ──────────────────────────────────────────
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
                    'id':           sub.id,
                    'client_name':  sub.client.name,
                    'plan_name':    sub.plan.name if sub.plan else '-',
                    'trainer_name': sub.trainer.first_name if sub.trainer else 'Unassigned',
                    'date':         sub.created_at.date(),
                }
                for sub in recent_subs
            ]

            return Response({
                'role': 'rec',
                'summary': {
                    'active_members':        active_members_count,
                    'new_sales_this_month':  new_sales_count,
                    'visits_today':          checkins_today + group_checkins_today,
                },
                'recent_sales': recent_list,
            })

        # ── VIEW 3: ADMIN ─────────────────────────────────────────────────
        else:
            trainers = (
                User.objects
                .filter(is_superuser=False)
                .exclude(groups__name='REC')
                .annotate(
                    active_packages=Count(
                        'clientsubscription',
                        filter=Q(clientsubscription__is_active=True),
                    ),
                    inactive_packages=Count(
                        'clientsubscription',
                        filter=Q(clientsubscription__is_active=False),
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
            )

            cross_session_value_expr = ExpressionWrapper(
                F('subscription__plan__price') / F('subscription__plan__units'),
                output_field=DecimalField(max_digits=12, decimal_places=4),
            )

            cross_base_qs = (
                TrainingSession.objects
                .filter(
                    date_completed__month=month,
                    date_completed__year=year,
                    is_completed=True,
                    subscription__plan__units__gt=0,
                )
                .exclude(completed_by=F('subscription__trainer'))
                .exclude(completed_by=None)
                .exclude(subscription__trainer=None)
            )

            deductions_qs = (
                cross_base_qs
                .annotate(session_value=cross_session_value_expr)
                .values('subscription__trainer')
                .annotate(total=Sum('session_value'))
                .values_list('subscription__trainer', 'total')
            )

            additions_qs = (
                cross_base_qs
                .annotate(session_value=cross_session_value_expr)
                .values('completed_by')
                .annotate(total=Sum('session_value'))
                .values_list('completed_by', 'total')
            )

            adjustments: dict = {}
            for trainer_id, total_lost in deductions_qs:
                if trainer_id is not None:
                    adjustments[trainer_id] = (
                        adjustments.get(trainer_id, Decimal(0)) - (total_lost or Decimal(0))
                    )
            for trainer_id, total_gained in additions_qs:
                if trainer_id is not None:
                    adjustments[trainer_id] = (
                        adjustments.get(trainer_id, Decimal(0)) + (total_gained or Decimal(0))
                    )

            group_adj = _compute_group_adjustments(month, year)
            for trainer_id, amount in group_adj.items():
                adjustments[trainer_id] = adjustments.get(trainer_id, Decimal(0)) + amount

            trainers_stats = []
            for trainer in trainers:
                base = trainer.base_monthly_revenue or Decimal(0)
                adjustment = adjustments.get(trainer.id, Decimal(0))
                net = base + adjustment

                trainers_stats.append({
                    'id':               trainer.id,
                    'name':             trainer.first_name or trainer.username,
                    'active_packages':  trainer.active_packages,
                    'inactive_packages':trainer.inactive_packages,
                    'total_assigned':   trainer.total_assigned,
                    'base_revenue':     round(base, 2),
                    'adjustments':      round(adjustment, 2),
                    'net_revenue':      round(net, 2),
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
                    'month':         month,
                    'year':          year,
                    'total_sales':   total_sales,
                    'total_revenue': total_revenue_sales,
                    'chart_data':    formatted_chart,
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
        user = self.request.user
        queryset = (
            ClientSubscription.objects.all()
            .select_related('client', 'plan', 'trainer')
            .order_by('-start_date')
        )

        client_id = self.request.query_params.get('client_id')

        if client_id:
            queryset = queryset.filter(client=client_id)
        else:
            if not user.is_superuser and not user.groups.filter(name='REC').exists():
                queryset = queryset.filter(trainer=user)

        return queryset

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Returns all active subscriptions for the requesting trainer."""
        user = request.user
        qs = ClientSubscription.objects.filter(
            trainer=user, is_active=True
        ).select_related('client', 'plan')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# COUNTRIES
# ---------------------------------------------------------------------------

class CountryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Country.objects.all().order_by('name')
    serializer_class = CountrySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


# ---------------------------------------------------------------------------
# TRAINING PLANS
# ---------------------------------------------------------------------------

class TrainingPlanViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        subscription_id = self.request.query_params.get('subscription_id')
        if subscription_id:
            return TrainingPlan.objects.filter(subscription_id=subscription_id)
        return TrainingPlan.objects.all()


class TrainingExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingExerciseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        split_id = self.request.query_params.get('split_id')
        if split_id:
            return TrainingExercise.objects.filter(split_id=split_id)
        return TrainingExercise.objects.all()


# ---------------------------------------------------------------------------
# SESSION LOG (legacy)
# ---------------------------------------------------------------------------

class SessionLogViewSet(viewsets.ModelViewSet):
    serializer_class = SessionLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        subscription_id = self.request.query_params.get('subscription_id')
        if subscription_id:
            return SessionLog.objects.filter(subscription_id=subscription_id)
        return SessionLog.objects.all()


# ---------------------------------------------------------------------------
# TRAINING SESSIONS
# ---------------------------------------------------------------------------

class TrainingSessionViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        subscription_id = self.request.query_params.get('subscription_id')
        if subscription_id:
            return TrainingSession.objects.filter(
                subscription_id=subscription_id
            ).prefetch_related('exercises__sets')
        return TrainingSession.objects.all().prefetch_related('exercises__sets')

    def perform_update(self, serializer):
        instance = serializer.instance
        was_completed = instance.is_completed
        updated = serializer.save()

        if not was_completed and updated.is_completed:
            sub = updated.subscription
            sub.sessions_used = F('sessions_used') + 1
            sub.save(update_fields=['sessions_used'])
            sub.refresh_from_db()

            if sub.plan and sub.sessions_used >= sub.plan.units:
                sub.is_active = False
                sub.save(update_fields=['is_active'])

            updated.completed_by = self.request.user
            updated.save(update_fields=['completed_by'])

    @action(detail=False, methods=['get'], url_path='get-data')
    def get_data(self, request):
        sub_id = request.query_params.get('subscription')
        session_num = request.query_params.get('session_number')

        session = TrainingSession.objects.filter(
            subscription_id=sub_id,
            session_number=session_num,
        ).prefetch_related('exercises__sets').first()

        if not session:
            return Response({'name': f'Session {session_num}', 'exercises': []})

        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='save-data')
    def save_data(self, request):
        data = request.data
        sub_id = data.get('subscription')
        session_num = data.get('session_number')
        mark_complete = data.get('mark_complete', False)

        session, created = TrainingSession.objects.get_or_create(
            subscription_id=sub_id,
            session_number=session_num,
            defaults={'name': data.get('name', f'Session {session_num}')},
        )

        session.name = data.get('name', session.name)

        if mark_complete and not session.is_completed:
            session.is_completed = True
            session.date_completed = timezone.now().date()
            session.completed_by = request.user

            sub = session.subscription
            sub.sessions_used += 1
            if sub.plan and sub.sessions_used >= sub.plan.units:
                sub.is_active = False
            sub.save()

        session.save()

        session.exercises.all().delete()

        exercises_data = data.get('exercises', [])
        for ex_idx, ex_data in enumerate(exercises_data):
            exercise = SessionExercise.objects.create(
                training_session=session,
                order=ex_idx + 1,
                name=ex_data.get('name', ''),
                note=ex_data.get('note', ''),
            )
            for set_idx, set_data in enumerate(ex_data.get('sets', [])):
                SessionSet.objects.create(
                    exercise=exercise,
                    order=set_idx + 1,
                    reps=set_data.get('reps', ''),
                    weight=set_data.get('weight', ''),
                    technique=set_data.get('technique', 'Regular'),
                    equipment=set_data.get('equipment', ''),
                )

        return Response({'status': 'success', 'session_id': session.id})

    @action(detail=False, methods=['get'])
    def history(self, request):
        sub_id = request.query_params.get('subscription')
        sessions = TrainingSession.objects.filter(
            subscription_id=sub_id,
            is_completed=True,
        ).order_by('-date_completed')[:10]

        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# NUTRITION
# ---------------------------------------------------------------------------

class NutritionPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return NutritionPlanCreateSerializer
        return NutritionPlanSerializer

    def get_queryset(self):
        subscription_id = self.request.query_params.get('subscription_id')
        if subscription_id:
            return NutritionPlan.objects.filter(subscription_id=subscription_id)
        return NutritionPlan.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MealPlanViewSet(viewsets.ModelViewSet):
    serializer_class = MealPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        nutrition_plan_id = self.request.query_params.get('nutrition_plan_id')
        if nutrition_plan_id:
            return MealPlan.objects.filter(nutrition_plan_id=nutrition_plan_id)
        return MealPlan.objects.all()


class FoodItemViewSet(viewsets.ModelViewSet):
    serializer_class = FoodItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        meal_plan_id = self.request.query_params.get('meal_plan_id')
        if meal_plan_id:
            return FoodItem.objects.filter(meal_plan_id=meal_plan_id)
        return FoodItem.objects.all()


class NutritionProgressViewSet(viewsets.ModelViewSet):
    serializer_class = NutritionProgressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        nutrition_plan_id = self.request.query_params.get('nutrition_plan_id')
        if nutrition_plan_id:
            return NutritionProgress.objects.filter(nutrition_plan_id=nutrition_plan_id)
        return NutritionProgress.objects.all()


class FoodDatabaseViewSet(viewsets.ModelViewSet):
    serializer_class = FoodDatabaseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'arabic_name', 'category']
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = FoodDatabase.objects.all().order_by('name')
        category = self.request.query_params.get('category')
        if category and category != 'All':
            qs = qs.filter(category=category)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# ---------------------------------------------------------------------------
# COACH SCHEDULE & GROUP TRAINING
# ---------------------------------------------------------------------------

class CoachScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = CoachScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            trainer_id = self.request.query_params.get('trainer_id')
            if trainer_id:
                return CoachSchedule.objects.filter(coach_id=trainer_id)
            return CoachSchedule.objects.all()
        return CoachSchedule.objects.filter(coach=user)

    def perform_create(self, serializer):
        if self.request.user.is_superuser:
            serializer.save()
        else:
            serializer.save(coach=self.request.user)


class GroupTrainingViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSessionLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = HistoryPagination

    def get_queryset(self):
        user = self.request.user
        qs = (
            GroupSessionLog.objects.all()
            .prefetch_related('participants__client')
            .select_related('coach')
            .order_by('-date')
        )
        if not user.is_superuser:
            qs = qs.filter(coach=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(coach=self.request.user)

    @action(detail=False, methods=['get'])
    def child_history(self, request):
        """Returns group session history for a specific child client."""
        client_id = request.query_params.get('client_id')
        if not client_id:
            return Response({'error': 'client_id is required'}, status=400)

        paginator = HistoryPagination()

        participations = (
            GroupSessionParticipant.objects
            .filter(client_id=client_id)
            .select_related('session__coach', 'client')
            .prefetch_related('session__participants__client')
            .order_by('-session__date')
        )

        if not request.user.is_superuser:
            participations = participations.filter(session__coach=request.user)

        page = paginator.paginate_queryset(participations, request)
        history_data = []

        items = page if page is not None else participations

        for p in items:
            session = p.session
            client_name = p.client.name if p.client else ''
            client_id_str = str(client_id)
            child_performance = []

            exercises_data = session.exercises_summary
            if isinstance(exercises_data, str):
                try:
                    exercises_data = json.loads(exercises_data)
                except Exception:
                    exercises_data = []

            for ex in (exercises_data if isinstance(exercises_data, list) else []):
                results = ex.get('results', [])
                user_res = next(
                    (r for r in results
                     if r.get('client') == client_name or str(r.get('client_id')) == client_id_str),
                    None,
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
                'coach':        session.coach.first_name if session.coach else 'Unknown',
                'session_note': p.note,
                'performance':  child_performance,
            })

        if page is not None:
            return paginator.get_paginated_response(history_data)
        return Response(history_data)

    @action(detail=False, methods=['post'])
    def bulk_exercise_history(self, request):
        day_name       = str(request.data.get('day_name', '') or '').strip()
        exercise_names = request.data.get('exercise_names', [])
        client_ids     = request.data.get('client_ids', [])
        user           = request.user

        if not (
            day_name
            and isinstance(exercise_names, list) and exercise_names
            and isinstance(client_ids, list) and client_ids
        ):
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
            client_name   = p.client.name if p.client else ''

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

                results = ex.get('results', []) if isinstance(ex.get('results'), list) else []
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

        for cid_str in result:
            for ename in result[cid_str]:
                if result[cid_str][ename] is None:
                    result[cid_str][ename] = {'found': False}

        return Response(result)


def _legacy_type_to_category(type_str: str) -> str:
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
            return Response({'error': 'Not authorized to respond to this request.'}, status=403)

        if transfer.status != 'pending':
            return Response({'error': 'This transfer request has already been resolved.'}, status=400)

        if new_status not in ('accepted', 'rejected'):
            return Response({'error': 'Invalid status.'}, status=400)

        if new_status == 'rejected':
            transfer.status = 'rejected'
            transfer.save()
            return Response({'status': 'success', 'new_status': 'rejected'})

        with transaction.atomic():
            source_sub = (
                ClientSubscription.objects
                .select_for_update()
                .select_related('plan', 'client')
                .get(pk=transfer.subscription_id)
            )

            if not source_sub.is_active:
                return Response(
                    {'error': 'The source subscription is no longer active.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            sessions_count = transfer.sessions_count
            plan = source_sub.plan
            remaining = (
                (plan.units - source_sub.sessions_used)
                if plan and plan.units
                else 0
            )
            if sessions_count > remaining:
                return Response(
                    {
                        'error': (
                            f'Only {remaining} session(s) remain on the source subscription. '
                            f'Cannot transfer {sessions_count}.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            ClientSubscription.objects.filter(pk=source_sub.pk).update(
                sessions_used=F('sessions_used') + sessions_count
            )
            source_sub.refresh_from_db(fields=['sessions_used'])

            if plan and source_sub.sessions_used >= plan.units:
                source_sub.is_active = False
                source_sub.save(update_fields=['is_active'])

            target_sub = (
                ClientSubscription.objects
                .select_for_update()
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
                target_sub.save(update_fields=['sessions_used'])
            else:
                today = timezone.now().date()
                new_sessions_used = max(plan.units - sessions_count, 0) if plan else 0
                new_end_date = (
                    today + timedelta(days=plan.duration_days)
                    if plan else None
                )
                ClientSubscription.objects.create(
                    client=source_sub.client,
                    plan=plan,
                    trainer=transfer.to_trainer,
                    start_date=today,
                    end_date=new_end_date,
                    is_active=True,
                    sessions_used=new_sessions_used,
                )

            transfer.status = 'accepted'
            transfer.save()

        return Response({'status': 'success', 'new_status': 'accepted'})


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


# ===========================================================================
# TRAINER SHIFT & SCHEDULE
# ===========================================================================

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
            trainer_id = self.request.query_params.get('trainer_id')
            if trainer_id:
                return TrainerShift.objects.filter(trainer_id=trainer_id)
            return TrainerShift.objects.all().select_related('trainer')
        return TrainerShift.objects.filter(trainer=user).select_related('trainer')

    def list(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            shift, _ = TrainerShift.objects.get_or_create(
                trainer=request.user,
                defaults={'shift_start': '08:00', 'shift_end': '20:00', 'slot_duration': 60},
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

    @action(detail=False, methods=['get', 'put', 'patch'], url_path='mine', url_name='mine')
    def mine(self, request):
        """GET/PUT/PATCH /trainer-shift/mine/ — trainer reads or updates own shift."""
        shift, _ = TrainerShift.objects.get_or_create(
            trainer=request.user,
            defaults={'shift_start': '08:00', 'shift_end': '20:00', 'slot_duration': 60},
        )
        if request.method == 'GET':
            return Response(self.get_serializer(shift).data)

        partial = request.method == 'PATCH'
        serializer = self.get_serializer(shift, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TrainerScheduleViewSet(viewsets.ModelViewSet):
    """
    Manages individual weekly schedule slots.

    Inactive-subscription filtering: the queryset always filters to slots
    where the linked ClientSubscription is still active, so expired clients
    never appear in the grid.
    """
    serializer_class = TrainerScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        base_qs = (
            TrainerSchedule.objects
            .select_related('client', 'trainer')
            .filter(
                client__subscriptions__is_active=True,
                client__subscriptions__trainer=F('trainer'),
            )
            .distinct()
            .order_by('day_of_week', 'time_slot')
        )

        if user.is_superuser:
            trainer_id = self.request.query_params.get('trainer_id')
            if trainer_id:
                return base_qs.filter(trainer_id=trainer_id)
            return base_qs

        return base_qs.filter(trainer=user)

    def perform_create(self, serializer):
        if not self.request.user.is_superuser:
            serializer.save(trainer=self.request.user)
        else:
            serializer.save()

    @action(detail=False, methods=['get'], url_path='active-clients', url_name='active-clients')
    def active_clients(self, request):
        """Clients eligible to be scheduled (active subscription with this trainer)."""
        user = request.user

        if user.is_superuser:
            trainer_id = request.query_params.get('trainer_id')
            if not trainer_id:
                return Response(
                    {'error': 'trainer_id query param is required for admin access.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = ClientSubscription.objects.filter(
                trainer_id=trainer_id, is_active=True
            ).select_related('client', 'plan')
        else:
            qs = ClientSubscription.objects.filter(
                trainer=user, is_active=True
            ).select_related('client', 'plan')

        clients = []
        for sub in qs:
            photo_url = None
            if sub.client.photo:
                try:
                    photo_url = request.build_absolute_uri(sub.client.photo.url)
                except Exception:
                    pass
            clients.append({
                'id':              sub.client.id,
                'subscription_id': sub.id,
                'name':            sub.client.name,
                'plan':            sub.plan.name if sub.plan else 'No Plan',
                'sessions_used':   sub.sessions_used,
                'total_sessions':  sub.plan.units if sub.plan else 0,
                'photo':           photo_url,
                'end_date':        sub.end_date,
            })

        return Response(clients)


# ===========================================================================
# ADMIN TRAINER OVERSIGHT
# ===========================================================================

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

    # FIX #19: Extracted shared logic into a private helper so `details` and
    # `mini_dashboard` no longer duplicate ~80 lines of identical code.
    def _build_mini_dashboard_data(self, trainer, request):
        """
        Returns (session_activity: list, chart_data: list) for the last 7 days.

        session_activity entries always include 'completed_by' so the same data
        can power both the detailed view and the lightweight tab.
        chart_data is a list of {'date': 'Mon 03', 'sessions': N} dicts,
        one per day, ordered oldest → newest.
        """
        cutoff = timezone.now().date() - timedelta(days=6)
        today  = timezone.now().date()

        individual_sessions = (
            TrainingSession.objects
            .filter(
                subscription__trainer=trainer,
                is_completed=True,
                date_completed__gte=cutoff,
            )
            .select_related('subscription__client', 'completed_by')
            .order_by('-date_completed')
        )

        group_sessions = (
            GroupSessionLog.objects
            .filter(coach=trainer, date__date__gte=cutoff)
            .prefetch_related('participants__client')
            .order_by('-date')
        )

        # Pre-build chart buckets so we can count in a single pass.
        day_map: dict = {
            today - timedelta(days=i): 0
            for i in range(6, -1, -1)
        }

        session_activity = []

        for sess in individual_sessions:
            d = sess.date_completed
            session_activity.append({
                'type':         'individual',
                'date':         d,
                'client_name':  sess.subscription.client.name,
                'session_name': sess.name,
                'completed_by': sess.completed_by.first_name if sess.completed_by else 'N/A',
            })
            if d in day_map:
                day_map[d] += 1

        for grp in group_sessions:
            d = grp.date.date()
            participant_names = [p.client.name for p in grp.participants.all() if p.client]
            session_activity.append({
                'type':         'group',
                'date':         d,
                'client_name':  ', '.join(participant_names) if participant_names else 'Group',
                'session_name': grp.day_name,
                'completed_by': trainer.first_name or trainer.username,
            })
            if d in day_map:
                day_map[d] += 1

        chart_data = [
            {'date': d.strftime('%a %d'), 'sessions': count}
            for d, count in day_map.items()
        ]

        return session_activity, chart_data

    @action(detail=True, methods=['get'], url_path='details', url_name='details')
    def details(self, request, pk=None):
        """Full overview: trainer info + active clients + last 7 days activity."""
        trainer = self._get_trainer_or_404(pk)
        if not trainer:
            return Response({'error': 'Trainer not found.'}, status=status.HTTP_404_NOT_FOUND)

        active_subs = (
            ClientSubscription.objects
            .filter(trainer=trainer, is_active=True)
            .select_related('client', 'plan')
        )

        clients_data = []
        for sub in active_subs:
            photo_url = None
            if sub.client.photo:
                try:
                    photo_url = request.build_absolute_uri(sub.client.photo.url)
                except Exception:
                    pass

            total = sub.plan.units if sub.plan else 0
            used  = sub.sessions_used

            clients_data.append({
                'client_id':       sub.client.id,
                'client_name':     sub.client.name,
                'client_photo':    photo_url,
                'plan_name':       sub.plan.name if sub.plan else 'No Plan',
                'sessions_used':   used,
                'total_sessions':  total,
                'remaining':       max(total - used, 0) if total else None,
                'progress_pct':    sub.progress_percentage,
                'end_date':        sub.end_date,
                'subscription_id': sub.id,
            })

        session_activity, chart_data = self._build_mini_dashboard_data(trainer, request)

        return Response({
            'trainer': {
                'id':          trainer.id,
                'name':        trainer.first_name or trainer.username,
                'username':    trainer.username,
                'email':       trainer.email,
                'date_joined': trainer.date_joined,
            },
            'clients':          clients_data,
            'session_activity': session_activity,
            'chart_data':       chart_data,
        })

    @action(detail=True, methods=['get'], url_path='mini-dashboard', url_name='mini-dashboard')
    def mini_dashboard(self, request, pk=None):
        """Lightweight tab: only last 7 days activity + chart data."""
        trainer = self._get_trainer_or_404(pk)
        if not trainer:
            return Response({'error': 'Trainer not found.'}, status=status.HTTP_404_NOT_FOUND)

        session_activity, chart_data = self._build_mini_dashboard_data(trainer, request)

        return Response({
            'chart_data':       chart_data,
            'session_activity': session_activity,
        })