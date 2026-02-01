from datetime import timedelta

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework import (viewsets,parsers,generics,permissions,serializers,filters,status,
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




class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 1000


# ... [Keep Login/Token classes as they were] ...
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["first_name"] = user.first_name
        token["is_superuser"] = user.is_superuser
        return token


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class TrainerSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "email", "password", "date_joined")
        extra_kwargs = {"password": {"write_only": True, "required": False}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
        )
        user.is_staff = False
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ManageTrainersViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = TrainerSerializer
    queryset = User.objects.filter(is_superuser=False).order_by("-date_joined")


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



# In views.py

class DashboardAnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        user = request.user
        now = timezone.now()
        
        # --- 1. TRAINER VIEW ---
        if not user.is_superuser:
            # OPTIMIZATION: select_related fetches client & plan in the same query
            subs = ClientSubscription.objects.filter(trainer=user, is_active=True)\
                .select_related('client', 'plan')
            
            current_month_revenue = ClientSubscription.objects.filter(
                trainer=user,
                created_at__month=now.month,
                created_at__year=now.year
            ).aggregate(total=Sum('plan__price'))['total'] or 0

            # ... (Rest of trainer logic remains the same) ...
            # (Just ensure you serialize 'subs' efficiently)
            client_list = [{
                'id': sub.client.id,
                'name': sub.client.name,
                'plan': sub.plan.name if sub.plan else "No Plan",
                # ...
            } for sub in subs]

            return Response({
                'role': 'trainer',
                'summary': {'active_clients': subs.count(), 'current_month_revenue': current_month_revenue},
                'clients': client_list
            })

        # --- 2. ADMIN VIEW (HEAVILY OPTIMIZED) ---
        else:
            month = int(request.query_params.get('month', now.month))
            year = int(request.query_params.get('year', now.year))

            # SINGLE QUERY TO GET ALL TRAINER STATS & REVENUE
            trainers = User.objects.filter(is_superuser=False).annotate(
                active_packages=Count('clientsubscription', filter=Q(clientsubscription__is_active=True)),
                inactive_packages=Count('clientsubscription', filter=Q(clientsubscription__is_active=False)),
                total_assigned=Count('clientsubscription'),
                # Calculate Monthly Revenue per trainer inside the DB
                monthly_revenue=Sum(
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

            trainers_stats = []
            for trainer in trainers:
                trainers_stats.append({
                    'id': trainer.id,
                    'name': trainer.first_name or trainer.username,
                    'active_packages': trainer.active_packages,
                    'inactive_packages': trainer.inactive_packages,
                    'total_assigned': trainer.total_assigned,
                    'monthly_revenue': trainer.monthly_revenue or 0 # Logic moved to DB
                })

            # Financials (Total)
            current_month_qs = ClientSubscription.objects.filter(created_at__month=month, created_at__year=year)
            total_sales = current_month_qs.count()
            total_revenue = current_month_qs.aggregate(total=Sum('plan__price'))['total'] or 0
            
            # Chart Data (Optimized)
            chart_data = (
                ClientSubscription.objects.filter(created_at__year=year)
                .annotate(month=TruncMonth('created_at'))
                .values('month')
                .annotate(revenue=Sum('plan__price'))
                .order_by('month')
            )
            
            # Format Chart Data
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
                    'total_revenue': total_revenue,
                    'chart_data': formatted_chart
                }
            })


class ClientSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        # OPTIMIZATION: Fetch related Client, Plan, and Trainer data immediately
        queryset = ClientSubscription.objects.all().select_related('client', 'plan', 'trainer').order_by("-start_date")
        
        client_id = self.request.query_params.get("client_id")
        if client_id:
            queryset = queryset.filter(client=client_id)
        return queryset

    # CONCURRENCY FIX: Use atomic transaction
    def perform_create(self, serializer):
        with transaction.atomic():
            if not self.request.user.is_superuser:
                serializer.save(trainer=self.request.user)
            else:
                serializer.save()



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
                simulated_data["exercises"].append({"name": ex.name, "sets": sets_data})

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
                    training_session=session, order=ex_idx + 1, name=ex_data.get("name")
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
