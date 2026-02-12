from datetime import timedelta

from django.contrib.auth.models import User, Group
from django.db import transaction
from django.utils import timezone
from rest_framework import (viewsets,parsers,generics,permissions,serializers,filters,status,mixins,
)
from django.db.models import Sum, Count, Q, F, Case, When, DecimalField
from django.db.models.functions import TruncMonth
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import *
from .serializers import *
from django.db.models.functions import TruncDay
import calendar 
import json 
from decimal import Decimal 


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 1000


# NEW: Dedicated pagination class for history endpoints
class HistoryPagination(PageNumberPagination):
    """
    Pagination specifically for group training history.
    Designed to handle large datasets efficiently (1000+ records).
    """
    page_size = 20  # Default 20 records per page
    page_size_query_param = "page_size"  # Allow client to override
    max_page_size = 100  # Maximum allowed page size


# ... [Keep Login/Token classes as they were] ...
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["first_name"] = user.first_name
        token["is_superuser"] = user.is_superuser
        # Identify if REC
        token["is_receptionist"] = user.groups.filter(name='REC').exists()
        return token


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class TrainerSerializer(serializers.ModelSerializer):
    # Added field to select role during creation
    role = serializers.ChoiceField(choices=[('trainer', 'Trainer'), ('rec', 'Receptionist')], write_only=True, default='trainer')

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

        # Handle Role Assignment
        if role == 'rec':
            group, _ = Group.objects.get_or_create(name='REC')
            user.groups.add(group)
            
        return user

    def update(self, instance, validated_data):
        # Allow updating role if provided
        role = validated_data.pop("role", None)
        password = validated_data.pop("password", None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        
        if role:
            # Clear existing REC groups to reset
            rec_group = Group.objects.filter(name='REC').first()
            if rec_group:
                instance.groups.remove(rec_group)
            
            if role == 'rec':
                group, _ = Group.objects.get_or_create(name='REC')
                instance.groups.add(group)

        return instance


class ManageTrainersViewSet(viewsets.ModelViewSet):
    serializer_class = TrainerSerializer
    # Allow any authenticated user (trainers) to access this list
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Admins see everyone (Trainers + REC)
        # Regular trainers see other trainers/REC
        return User.objects.filter(is_superuser=False).order_by("-date_joined")

    def get_permissions(self):
        # Allow viewing (GET) for all trainers
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        # Only Admins can create/edit/delete
        return [permissions.IsAdminUser()]


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by("-created_at")
    serializer_class = ClientSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "phone", "manual_id"]
    pagination_class = StandardResultsSetPagination
    def get_queryset(self):
        queryset = Client.objects.all().order_by("-created_at")
        is_child = self.request.query_params.get('is_child')
        
        # Filter by Child Status
        if is_child == 'true':
            queryset = queryset.filter(is_child=True)
        elif is_child == 'false':
            queryset = queryset.filter(is_child=False)
            
        return queryset


# views.py

class SubscriptionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    serializer_class = SubscriptionSerializer
    
    def get_queryset(self):
        # Default: order by child status (adults first) then price
        queryset = Subscription.objects.all().order_by('is_child_plan', 'price')
        
        # --- NEW FILTERING LOGIC ---
        target = self.request.query_params.get('target') # 'child' or 'adult'
        
        if target == 'child':
            queryset = queryset.filter(is_child_plan=True)
        elif target == 'adult':
            queryset = queryset.filter(is_child_plan=False)
            
        return queryset


# في ملف views.py

class DashboardAnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        user = request.user
        now = timezone.now()
        
        # Identify Role
        is_rec = user.groups.filter(name='REC').exists()
        
        # 1. Safe Date Parsing
        try:
            month = int(request.query_params.get('month', now.month))
            year = int(request.query_params.get('year', now.year))
        except (ValueError, TypeError):
            month, year = now.month, now.year

        # --- HELPER: Calculate Group Session Adjustments (Safe Version) ---
        def get_group_adjustments():
            group_adjustments = {} # { trainer_id: amount }

            # Fetch logs with necessary relations
            group_logs = GroupSessionLog.objects.filter(
                date__month=month,
                date__year=year
            ).select_related('coach').prefetch_related('participants__client')

            for log in group_logs:
                coach = log.coach
                if not coach: continue

                for participant in log.participants.all():
                    # Check logic safety
                    if not participant.deducted or not participant.client:
                        continue

                    # Safe Subscription Fetching
                    client_sub = ClientSubscription.objects.filter(
                        client=participant.client, 
                        is_active=True
                    ).select_related('plan', 'trainer').first()

                    # Fallback to last sub if active not found
                    if not client_sub:
                        client_sub = ClientSubscription.objects.filter(
                            client=participant.client
                        ).select_related('plan', 'trainer').order_by('-created_at').first()

                    # MATH SAFETY: Ensure plan exists and units > 0
                    if client_sub and client_sub.plan and client_sub.plan.units and client_sub.plan.units > 0:
                        owner = client_sub.trainer
                        
                        try:
                            price = client_sub.plan.price or 0
                            units = client_sub.plan.units
                            # Calculate value per session safely
                            session_value = Decimal(str(price)) / Decimal(str(units))
                        except:
                            session_value = Decimal(0)

                        # Logic: If Owner != Group Coach, move money
                        if owner and owner.id != coach.id:
                            # Deduct from Owner
                            group_adjustments[owner.id] = group_adjustments.get(owner.id, Decimal(0)) - session_value
                            # Add to Group Coach
                            group_adjustments[coach.id] = group_adjustments.get(coach.id, Decimal(0)) + session_value
            
            return group_adjustments

        # --- 1. TRAINER VIEW (Non-Admin, Non-REC) ---
        if not user.is_superuser and not is_rec:
            # A. Base Revenue
            base_revenue = ClientSubscription.objects.filter(
                trainer=user,
                created_at__month=month,
                created_at__year=year
            ).aggregate(total=Sum('plan__price'))['total'] or Decimal(0)

            # B. 1-on-1 Adjustments
            lost_sessions = TrainingSession.objects.filter(
                subscription__trainer=user,
                is_completed=True,
                date_completed__month=month,
                date_completed__year=year
            ).exclude(completed_by=user).select_related('subscription__plan')

            deduction_amount = Decimal(0)
            for sess in lost_sessions:
                plan = sess.subscription.plan
                if plan and plan.units and plan.units > 0:
                    try:
                        deduction_amount += (Decimal(str(plan.price or 0)) / Decimal(str(plan.units)))
                    except: pass

            gained_sessions = TrainingSession.objects.filter(
                completed_by=user,
                is_completed=True,
                date_completed__month=month,
                date_completed__year=year
            ).exclude(subscription__trainer=user).select_related('subscription__plan')

            addition_amount = Decimal(0)
            for sess in gained_sessions:
                plan = sess.subscription.plan
                if plan and plan.units and plan.units > 0:
                    try:
                        addition_amount += (Decimal(str(plan.price or 0)) / Decimal(str(plan.units)))
                    except: pass

            # C. Group Session Adjustments
            group_adj = get_group_adjustments()
            my_group_adj = group_adj.get(user.id, Decimal(0))
            
            if my_group_adj > 0:
                addition_amount += my_group_adj
            else:
                deduction_amount += abs(my_group_adj)

            # Final Math Safety
            base_revenue = Decimal(str(base_revenue))
            net_revenue = base_revenue - deduction_amount + addition_amount

            subs = ClientSubscription.objects.filter(trainer=user, is_active=True).select_related('client', 'plan')
            
            # --- FIX: Build Absolute Photo URL ---
            client_list = []
            for sub in subs:
                photo_full_url = None
                if sub.client.photo:
                    try:
                        photo_full_url = request.build_absolute_uri(sub.client.photo.url)
                    except:
                        photo_full_url = None

                client_list.append({
                    'id': sub.client.id,
                    'name': sub.client.name,
                    'plan': sub.plan.name if sub.plan else "No Plan",
                    'progress': sub.progress_percentage,
                    'photo': photo_full_url, 
                    'manual_id': sub.client.manual_id
                })

            return Response({
                'role': 'trainer',
                'summary': {
                    'active_clients': subs.count(),
                    'base_revenue': base_revenue,
                    'deductions': round(deduction_amount, 2),
                    'additions': round(addition_amount, 2),
                    'net_revenue': round(net_revenue, 2)
                },
                'clients': client_list
            })

        # --- 2. RECEPTIONIST VIEW (New) ---
        elif is_rec:
             # Basic Stats for Reception
            active_members_count = ClientSubscription.objects.filter(is_active=True).count()
            
            current_month_qs = ClientSubscription.objects.filter(created_at__month=month, created_at__year=year)
            new_sales_count = current_month_qs.count()
            
            # Check-ins today (Training Sessions completed today + Group Sessions)
            today = timezone.now().date()
            checkins_today = TrainingSession.objects.filter(is_completed=True, date_completed=today).count()
            group_checkins_today = GroupSessionParticipant.objects.filter(session__date__date=today).count()
            
            total_visits_today = checkins_today + group_checkins_today

            # List of recent sales/subscriptions to verify
            recent_subs = current_month_qs.select_related('client', 'plan', 'trainer').order_by('-created_at')[:10]
            recent_list = []
            for sub in recent_subs:
                recent_list.append({
                    'id': sub.id,
                    'client_name': sub.client.name,
                    'plan_name': sub.plan.name if sub.plan else "-",
                    'trainer_name': sub.trainer.first_name if sub.trainer else "Unassigned",
                    'date': sub.created_at.date()
                })

            return Response({
                'role': 'rec',
                'summary': {
                    'active_members': active_members_count,
                    'new_sales_this_month': new_sales_count,
                    'visits_today': total_visits_today
                },
                'recent_sales': recent_list
            })

        # --- 3. ADMIN VIEW ---
        else:
            # 1. Base Stats
            trainers = User.objects.filter(is_superuser=False).exclude(groups__name='REC').annotate(
                active_packages=Count('clientsubscription', filter=Q(clientsubscription__is_active=True)),
                inactive_packages=Count('clientsubscription', filter=Q(clientsubscription__is_active=False)),
                total_assigned=Count('clientsubscription'),
                base_monthly_revenue=Sum(
                    Case(
                        When(
                            clientsubscription__created_at__month=month,
                            clientsubscription__created_at__year=year,
                            then=F('clientsubscription__plan__price')
                        ),
                        default=0,
                        output_field=DecimalField()
                    )
                )
            )

            # 2. 1-on-1 Adjustments
            cross_sessions = TrainingSession.objects.filter(
                date_completed__month=month,
                date_completed__year=year,
                is_completed=True
            ).exclude(
                completed_by=F('subscription__trainer')
            ).select_related('subscription__plan', 'subscription__trainer', 'completed_by')

            adjustments = {} # { trainer_id: Decimal(amount) }

            for session in cross_sessions:
                plan = session.subscription.plan
                if not plan or not plan.units or plan.units == 0: continue
                
                try:
                    session_value = Decimal(str(plan.price or 0)) / Decimal(str(plan.units))
                except:
                    session_value = Decimal(0)

                owner = session.subscription.trainer
                if owner:
                    adjustments[owner.id] = adjustments.get(owner.id, Decimal(0)) - session_value

                completer = session.completed_by
                if completer:
                    adjustments[completer.id] = adjustments.get(completer.id, Decimal(0)) + session_value

            # 3. Group Session Adjustments
            group_adj = get_group_adjustments()
            
            for trainer_id, amount in group_adj.items():
                adjustments[trainer_id] = adjustments.get(trainer_id, Decimal(0)) + amount

            # 4. Merge Data
            trainers_stats = []
            for trainer in trainers:
                # Ensure base is Decimal even if None
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
                    'net_revenue': round(net, 2)
                })

            # Financials
            current_month_qs = ClientSubscription.objects.filter(created_at__month=month, created_at__year=year)
            total_sales = current_month_qs.count()
            total_revenue_sales = current_month_qs.aggregate(total=Sum('plan__price'))['total'] or 0
            
            chart_data = (
                ClientSubscription.objects.filter(created_at__year=year)
                .annotate(month=TruncMonth('created_at'))
                .values('month')
                .annotate(revenue=Sum('plan__price'))
                .order_by('month')
            )
            
            formatted_chart = []
            revenue_map = {item['month'].month: item['revenue'] for item in chart_data}
            for i in range(1, 13):
                formatted_chart.append({
                    'name': calendar.month_name[i][:3],
                    'revenue': revenue_map.get(i, 0)
                })

            return Response({
                'role': 'admin',
                'trainers_overview': trainers_stats,
                'financials': {
                    'month': month,
                    'year': year,
                    'total_sales': total_sales,
                    'total_revenue': total_revenue_sales,
                    'chart_data': formatted_chart
                }
            })


# In views.py

class ClientSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        # 1. Base Queryset
        queryset = ClientSubscription.objects.all().select_related('client', 'plan', 'trainer').order_by("-start_date")
        
        # 2. Filtering
        client_id = self.request.query_params.get("client_id")
        if client_id:
            queryset = queryset.filter(client=client_id)
        
        # 3. Role Based Restriction
        # If Admin OR REC -> See All
        # If Trainer -> See Own Only (This logic was implicit before, making it explicit helps)
        # Note: The original code returned .all() for everyone. 
        # If you want to restrict Trainers to only their clients, add checks here.
        # Currently keeping existing logic (return all) which fits Reception usage too.
        
        return queryset

    # --- NEW: Dedicated endpoint for Trainer Profile ---
    @action(detail=False, methods=['get'])
    def profile_clients(self, request):
        user = request.user
        
        # Filter 1: Direct Clients (trainer is Me)
        # Filter 2: Covered Clients (Accepted Transfer Request to Me)
        # Note: We use .distinct() to avoid duplicates
        queryset = ClientSubscription.objects.filter(
            Q(trainer=user) | 
            Q(transfer_requests__to_trainer=user, transfer_requests__status='accepted')
        ).filter(is_active=True).distinct()
        
        # Return FULL list (no pagination) so the profile is always complete
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        with transaction.atomic():
            user = self.request.user
            # Admin OR REC can assign any trainer (or leave blank)
            if user.is_superuser or user.groups.filter(name='REC').exists():
                serializer.save()
            else:
                # Trainer assigns themselves automatically
                serializer.save(trainer=user)



# views.py

class CountryViewSet(viewsets.ModelViewSet):
    queryset = Country.objects.all().order_by('name')
    serializer_class = CountrySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly] 





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
        day_names = data.get("day_names")

        plan = TrainingPlan.objects.create(
            subscription_id=sub_id, cycle_length=cycle_length
        )

        for index, name in enumerate(day_names):
            TrainingDaySplit.objects.create(plan=plan, order=index + 1, name=name)

        serializer = self.get_serializer(plan)
        return Response(serializer.data)


class TrainingExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingExerciseSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = TrainingExercise.objects.all()

    @action(detail=False, methods=["post"], url_path="bulk-update")
    def bulk_update(self, request):
        split_id = request.data.get("split_id")
        exercises_data = request.data.get("exercises", [])

        TrainingExercise.objects.filter(split_id=split_id).delete()

        for ex_idx, ex_data in enumerate(exercises_data):
            exercise = TrainingExercise.objects.create(
                split_id=split_id,
                order=ex_idx + 1,
                name=ex_data.get("name", "Exercise"),
                note=ex_data.get("note", ""),
            )
            sets_data = ex_data.get("sets", [])
            for set_idx, set_data in enumerate(sets_data):
                TrainingSet.objects.create(
                    exercise=exercise,
                    order=set_idx + 1,
                    reps=set_data.get("reps", ""),
                    weight=set_data.get("weight", ""),
                    technique=set_data.get("technique", "Regular"),
                    equipment=set_data.get("equipment") or None,
                )

        return Response({"status": "success"})


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
        sub_id = request.data.get("subscription")
        try:
            sub = ClientSubscription.objects.get(id=sub_id)
            log = super().create(request, *args, **kwargs)

            sub.sessions_used = SessionLog.objects.filter(subscription=sub).count()
            is_expired_sessions = sub.plan and sub.sessions_used >= sub.plan.units
            is_expired_date = sub.end_date and timezone.now().date() > sub.end_date

            if is_expired_sessions or is_expired_date:
                sub.is_active = False
            sub.save()
            return log
        except ClientSubscription.DoesNotExist:
            return Response({"error": "Subscription not found"}, status=404)


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

        response_data = {}

        try:
            sub = ClientSubscription.objects.get(id=sub_id)
        except ClientSubscription.DoesNotExist:
            return Response(
                {"error": "Subscription not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

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
                    session.subscription.trainer.first_name
                    if session.subscription.trainer
                    else "TFG Trainer"
                )

            return Response(response_data)

        except TrainingSession.DoesNotExist:
            plan = getattr(sub, "training_plan", None)

            trainer_name = sub.trainer.first_name if sub.trainer else "TFG Trainer"

            if not plan:
                return Response(
                    {
                        "name": f"Session {session_num}",
                        "exercises": [],
                        "trainer_name": trainer_name,
                    }
                )

            split_index = (session_num - 1) % plan.cycle_length
            splits = plan.splits.all().order_by("order")

            if not splits.exists():
                return Response(
                    {
                        "name": f"Session {session_num}",
                        "exercises": [],
                        "trainer_name": trainer_name,
                    }
                )

            target_split = (
                splits[split_index] if split_index < len(splits) else splits[0]
            )

            simulated_data = {
                "id": None,
                "session_number": session_num,
                "name": target_split.name,
                "is_completed": False,
                "trainer_name": trainer_name,
                "exercises": [],
            }

            for ex in target_split.exercises.all():
                sets_data = []
                for s in ex.sets.all():
                    sets_data.append(
                        {
                            "reps": s.reps,
                            "weight": s.weight,
                            "technique": s.technique,
                            "equipment": s.equipment,
                        }
                    )
                # Ensure Note is passed from Template to Session Simulation
                simulated_data["exercises"].append({
                    "name": ex.name, 
                    "note": ex.note, # Load note from template
                    "sets": sets_data
                })

            return Response(simulated_data)

    @action(detail=False, methods=["post"], url_path="save-data")
    def save_session_data(self, request):
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

            # --- SECURITY UPDATE: Check if session is already completed by someone else ---
            if session.is_completed and not request.user.is_superuser:
                # If session is completed, only the person who completed it can edit it
                if session.completed_by and session.completed_by != request.user:
                     return Response(
                         {"error": f"Locked! This session was completed by {session.completed_by.first_name}. Only they can edit it."}, 
                         status=status.HTTP_403_FORBIDDEN
                     )

            session.name = data.get("name", session.name)

            if complete_it:
              session.is_completed = True
              session.date_completed = timezone.now().date()
              session.completed_by = request.user 

            session.save()

            if complete_it:
                sub.sessions_used = TrainingSession.objects.filter(
                    subscription=sub, is_completed=True
                ).count()

                is_finished_sessions = sub.plan and sub.sessions_used >= sub.plan.units
                is_expired_date = sub.end_date and timezone.now().date() > sub.end_date

                if is_finished_sessions or is_expired_date:
                    sub.is_active = False
                sub.save()

            session.exercises.all().delete()
            for ex_idx, ex_data in enumerate(exercises):
                ex_obj = SessionExercise.objects.create(
                    training_session=session, 
                    order=ex_idx + 1, 
                    name=ex_data.get("name"),
                    # --- ADDED: Saving the note ---
                    note=ex_data.get("note", "")
                )
                for set_idx, set_data in enumerate(ex_data.get("sets", [])):
                    SessionSet.objects.create(
                        exercise=ex_obj,
                        order=set_idx + 1,
                        reps=set_data.get("reps", ""),
                        weight=set_data.get("weight", ""),
                        technique=set_data.get("technique", "Regular"),
                        equipment=set_data.get("equipment") or None,
                    )

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

        history = TrainingSession.objects.filter(subscription=sub).order_by(
            "-date_completed", "-created_at", "-session_number"
        )

        latest_days = {}

        for session in history:
            if not session.exercises.exists():
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


class NutritionPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    # Added Pagination here
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

    # ... [Keep the rest of the actions (weekly_overview, duplicate_week) unchanged] ...
    @action(detail=True, methods=["get"])
    def weekly_overview(self, request, pk=None):
        nutrition_plan = self.get_object()
        meal_plans = nutrition_plan.meal_plans.all()

        weekly_data = {}
        for day in [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]:
            day_meals = meal_plans.filter(day=day)
            weekly_data[day] = {
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
                "target_calories": nutrition_plan.target_calories,
                "target_protein": nutrition_plan.target_protein,
                "target_carbs": nutrition_plan.target_carbs,
                "target_fats": nutrition_plan.target_fats,
                "notes": nutrition_plan.notes,
                "created_by": request.user,
            }
            new_plan = NutritionPlan.objects.create(**plan_fields)

            for meal in original_meals:
                original_foods = list(meal.foods.all())
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
                for food in original_foods:
                    FoodItem.objects.create(
                        meal_plan=new_meal,
                        name=food.name,
                        quantity=food.quantity,
                        unit=food.unit,
                        calories=food.calories,
                        protein=food.protein,
                        carbs=food.carbs,
                        fats=food.fats,
                        fiber=food.fiber,
                        category=food.category,
                        preparation=food.preparation,
                        order=food.order,
                    )

        return Response(
            {"status": "Week duplicated successfully", "new_plan_id": new_plan.id}
        )


# ... [Keep MealPlanViewSet, FoodItemViewSet, NutritionProgressViewSet, FoodDatabaseViewSet unchanged] ...
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
        return Response(
            {"error": "No photo provided"}, status=status.HTTP_400_BAD_REQUEST
        )

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


class FoodItemViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "category"]
    serializer_class = FoodItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = FoodItem.objects.all()
        meal_plan_id = self.request.query_params.get("meal_plan_id")
        if meal_plan_id:
            queryset = queryset.filter(meal_plan_id=meal_plan_id)
        return queryset.select_related("meal_plan")

    def perform_create(self, serializer):
        food_item = serializer.save()
        meal_plan = food_item.meal_plan
        foods = meal_plan.foods.all()
        meal_plan.total_calories = sum(f.calories for f in foods)
        meal_plan.total_protein = sum(f.protein for f in foods)
        meal_plan.total_carbs = sum(f.carbs for f in foods)
        meal_plan.total_fats = sum(f.fats for f in foods)
        meal_plan.save()

    def perform_destroy(self, instance):
        meal_plan = instance.meal_plan
        instance.delete()
        foods = meal_plan.foods.all()
        meal_plan.total_calories = sum(f.calories for f in foods)
        meal_plan.total_protein = sum(f.protein for f in foods)
        meal_plan.total_carbs = sum(f.carbs for f in foods)
        meal_plan.total_fats = sum(f.fats for f in foods)
        meal_plan.save()


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
                {"error": "nutrition_plan_id required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        progress = NutritionProgress.objects.filter(
            nutrition_plan_id=nutrition_plan_id, date__range=[week_start, week_end]
        )
        serializer = self.get_serializer(progress, many=True)
        return Response(serializer.data)


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


class CoachScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = CoachScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = CoachSchedule.objects.all()
        
        # Filter by specific coach
        coach_id = self.request.query_params.get('coach_id')
        if coach_id:
            queryset = queryset.filter(coach_id=coach_id)
            
        return queryset

    @action(detail=False, methods=['get'])
    def get_trainers(self, request):
        # Return list of coaches (excluding superusers/admins) for the tabs
        trainers = User.objects.filter(is_superuser=False).values('id', 'first_name', 'username')
        return Response(list(trainers))
    
    
    
    
class GroupTrainingViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @action(detail=False, methods=['get'])
    def schedule(self, request):
        coach_id = request.query_params.get('coach_id')
        
        # --- FIX: Only fetch schedules for clients with an ACTIVE subscription ---
        queryset = CoachSchedule.objects.filter(client__subscriptions__is_active=True)
        
        if coach_id:
            queryset = queryset.filter(coach_id=coach_id)
            
        # .distinct() prevents duplicates if a client accidentally has multiple active subs
        queryset = queryset.distinct()
        
        serializer = CoachScheduleSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add_to_schedule(self, request):
        coach_id = request.data.get('coach')
        client_id = request.data.get('client')
        day = request.data.get('day')
        session_time = request.data.get('session_time')  # NEW: Optional time field

        if not all([coach_id, client_id, day]):
            return Response({"error": "Missing fields"}, status=400)

        obj, created = CoachSchedule.objects.get_or_create(
            coach_id=coach_id,
            client_id=client_id,
            day=day,
            defaults={'session_time': session_time} if session_time else {}
        )
        
        # If updating existing record and time provided, update it
        if not created and session_time:
            obj.session_time = session_time
            obj.save()
            
        serializer = CoachScheduleSerializer(obj)
        return Response(serializer.data)

    @action(detail=False, methods=['delete'])
    def remove_from_schedule(self, request):
        pk = request.query_params.get('id')
        CoachSchedule.objects.filter(id=pk).delete()
        return Response({'status': 'deleted'})

    @action(detail=False, methods=['get'])
    def history(self, request):
        """
        Get paginated group session history.
        
        Query Params:
            - page: Page number (default: 1)
            - page_size: Records per page (default: 20, max: 100)
        
        Returns:
            Paginated response with count, next, previous, and results
        """
        user = request.user
        
        # Filter by coach unless admin
        if user.is_superuser:
            logs = GroupSessionLog.objects.all()
        else:
            logs = GroupSessionLog.objects.filter(coach=user)
        
        logs = logs.order_by('-date')
        
        # Apply pagination
        paginator = HistoryPagination()
        page = paginator.paginate_queryset(logs, request, view=self)
        
        if page is not None:
            serializer = GroupSessionLogSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        # Fallback to unpaginated (shouldn't happen with proper pagination)
        serializer = GroupSessionLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def complete_session(self, request):
        data = request.data
        coach = request.user
        day_name = data.get('day_name')
        exercises = data.get('exercises', [])
        participants_data = data.get('participants', [])

        with transaction.atomic():
            # Use json.dumps to safely store the list of objects as a string
            exercises_json = json.dumps(exercises) if isinstance(exercises, list) else exercises

            log = GroupSessionLog.objects.create(
                coach=coach,
                day_name=day_name,
                exercises_summary=exercises_json
            )

            for p_data in participants_data:
                client_id = p_data.get('client_id')
                note = p_data.get('note', '')
                
                deducted = False
                # Find the active subscription to deduct from
                sub = ClientSubscription.objects.filter(
                    client_id=client_id, is_active=True
                ).first()

                if sub:
                    sub.sessions_used += 1
                    # Auto-expire if session limit reached
                    if sub.plan and sub.sessions_used >= sub.plan.units:
                        sub.is_active = False
                    sub.save()
                    deducted = True

                GroupSessionParticipant.objects.create(
                    session=log,
                    client_id=client_id,
                    note=note,
                    deducted=deducted
                )

        return Response({'status': 'Session Completed & Subscriptions Deducted'})

    @action(detail=False, methods=['get'])
    def client_history(self, request):
        """
        Get paginated history for a specific child.
        
        Query Params:
            - client_id: ID of the child (required)
            - page: Page number (default: 1)
            - page_size: Records per page (default: 20, max: 100)
        
        Returns:
            Paginated response with performance data for each session
        """
        client_id = request.query_params.get('client_id')
        user = request.user
        
        if not client_id:
            return Response({"error": "client_id is required"}, status=400)

        # Filter by coach permissions
        participations = GroupSessionParticipant.objects.filter(
            client_id=client_id
        ).select_related('session', 'client')
        
        # Non-admin users only see their own sessions
        if not user.is_superuser:
            participations = participations.filter(session__coach=user)
        
        participations = participations.order_by('-session__date')
        
        # Apply pagination
        paginator = HistoryPagination()
        page = paginator.paginate_queryset(participations, request, view=self)
        
        # Process paginated results
        page_data = page if page is not None else participations
        history_data = []

        for p in page_data:
            session = p.session
            client_name = p.client.name
            
            try:
                if isinstance(session.exercises_summary, str):
                    exercises_data = json.loads(session.exercises_summary)
                else:
                    exercises_data = session.exercises_summary
            except:
                exercises_data = []

            child_performance = []
            session_note_for_child = p.note

            if isinstance(exercises_data, list):
                for ex in exercises_data:
                    results = ex.get('results', [])
                    user_res = next((r for r in results if r.get('client') == client_name), None)
                    
                    if user_res:
                        child_performance.append({
                            'exercise': ex.get('name', 'Unknown'),
                            'type': ex.get('type', 'strength'),
                            'val1': user_res.get('val1', '-'),
                            'val2': user_res.get('val2', '-'),
                            'note': user_res.get('note', '')
                        })

            history_data.append({
                'id': session.id,
                'date': session.date,
                'day_name': session.day_name,
                'coach': session.coach.first_name if session.coach else "Unknown",
                'session_note': session_note_for_child, 
                'performance': child_performance
            })

        # Return paginated response
        if page is not None:
            return paginator.get_paginated_response(history_data)
        
        return Response(history_data)
    
    
    

class GroupWorkoutTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = GroupWorkoutTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = GroupWorkoutTemplate.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        
        
    
    
# In views.py

# --- views.py ---

class SessionTransferRequestViewSet(viewsets.ModelViewSet):
    serializer_class = SessionTransferRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Show requests where I am the sender OR the receiver
        return SessionTransferRequest.objects.filter(
            Q(from_trainer=user) | Q(to_trainer=user)
        ).order_by('-created_at')

    def perform_create(self, serializer):
        # Automatically set 'from_trainer' to the logged-in user
        serializer.save(from_trainer=self.request.user)

    @action(detail=True, methods=['post'])
    def respond(self, request, pk=None):
        transfer = self.get_object()
        new_status = request.data.get('status')

        # Security: Only the RECEIVER can accept/reject
        if transfer.to_trainer != request.user:
            return Response({"error": "Not authorized to respond to this request"}, status=403)

        if new_status not in ['accepted', 'rejected']:
            return Response({"error": "Invalid status"}, status=400)

        transfer.status = new_status
        transfer.save()
        return Response({"status": "success", "new_status": new_status})
    
    
    
    
# views.py

class ManualNutritionSaveViewSet(viewsets.ModelViewSet):
    serializer_class = ManualNutritionSaveSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Requirement #4: Each account sees only their own records
        return ManualNutritionSave.objects.filter(user=self.request.user).order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ManualWorkoutSaveViewSet(viewsets.ModelViewSet):
    serializer_class = ManualWorkoutSaveSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Requirement #4: Each account sees only their own records
        return ManualWorkoutSave.objects.filter(user=self.request.user).order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)