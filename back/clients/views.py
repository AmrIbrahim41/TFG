from rest_framework import (
    viewsets,
    parsers,
    generics,
    permissions,
    serializers,
    filters,
)
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import (
    MultiPartParser,
    FormParser,
    JSONParser,
)
from django.utils import timezone

from .models import *
from .serializers import *
from django.db import transaction  # <--- تأكد من إضافة هذا السطر في أعلى الملف خالص


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 1000


# 1. Custom Login
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


# 2. Trainer Serializer
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


# 3. ViewSets
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


class SubscriptionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    queryset = Subscription.objects.all().order_by("price")
    serializer_class = SubscriptionSerializer


class ClientSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ClientSubscription.objects.all().order_by("-start_date")
        client_id = self.request.query_params.get("client_id")
        if client_id:
            queryset = queryset.filter(client=client_id)
        return queryset

    def perform_create(self, serializer):
        if not self.request.user.is_superuser:
            serializer.save(trainer=self.request.user)
        else:
            serializer.save()


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

    # --- 1. SMART GET (View/Edit) ---
    # --- 1. SMART GET (View/Edit) ---
    @action(detail=False, methods=["get"], url_path="get-data")
    def get_session_data(self, request):
        sub_id = request.query_params.get("subscription")
        session_num = int(request.query_params.get("session_number"))

        response_data = {}

        try:
            session = TrainingSession.objects.get(
                subscription_id=sub_id, session_number=session_num
            )
            response_data = self.get_serializer(session).data

            # --- FIX: INJECT TRAINER NAME ---
            # If completed, use the person who completed it. If not, use the subscription's trainer.
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
            sub = ClientSubscription.objects.get(id=sub_id)
            plan = getattr(sub, "training_plan", None)

            # --- FIX: GET TRAINER FROM SUBSCRIPTION ---
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
                "trainer_name": trainer_name,  # <--- Added Here
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

    # --- 2. SAVE (Updated) ---
    @action(detail=False, methods=["post"], url_path="save-data")
    def save_session_data(self, request):
        data = request.data
        sub_id = data.get("subscription")
        session_number = data.get("session_number")
        exercises = data.get("exercises", [])
        complete_it = data.get("mark_complete", False)

        # 1. التحقق من وجود الاشتراك فقط (بدون منع المدربين الآخرين)
        try:
            sub = ClientSubscription.objects.get(id=sub_id)
        except ClientSubscription.DoesNotExist:
            return Response({"error": "Subscription not found"}, status=404)

        # 2. حماية البيانات (Atomic Transaction)
        # هذا السطر يضمن أن العملية كلها تنجح أو تفشل كلها، فلا تضيع التمارين
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
                # هنا بنسجل مين المدرب اللي قفل السشن فعلياً (حتى لو مش هو صاحب الاشتراك)
                session.completed_by = request.user

            session.save()

            if complete_it:
                # إعادة حساب الجلسات المستخدمة
                sub.sessions_used = TrainingSession.objects.filter(
                    subscription=sub, is_completed=True
                ).count()

                is_finished_sessions = sub.plan and sub.sessions_used >= sub.plan.units
                is_expired_date = sub.end_date and timezone.now().date() > sub.end_date

                if is_finished_sessions or is_expired_date:
                    sub.is_active = False
                sub.save()

            # حذف القديم وإعادة بناء الجديد بأمان داخل الـ transaction
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

    # --- 3. GET HISTORY ---
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


# -----------------------------------------------------------------------------------------------------
# -----------------------------------------------------------------------------------------------------
# -----------------------------------------------------------------------------------------------------
# -----------------------------------------------------------------------------------------------------
# -----------------------------------------------------------------------------------------------------


# Add these views to your views.py file

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import datetime, timedelta

from .models import NutritionPlan, MealPlan, FoodItem, NutritionProgress, FoodDatabase
from .serializers import (
    NutritionPlanSerializer,
    NutritionPlanCreateSerializer,
    MealPlanSerializer,
    MealPlanCreateSerializer,
    FoodItemSerializer,
    NutritionProgressSerializer,
    FoodDatabaseSerializer,
)


class NutritionPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return NutritionPlanCreateSerializer
        return NutritionPlanSerializer

    def get_queryset(self):
        queryset = NutritionPlan.objects.all()

        # Filter by subscription to show all cards for that sub
        subscription_id = self.request.query_params.get("subscription_id")
        if subscription_id:
            queryset = queryset.filter(subscription_id=subscription_id)

        # Filter by client
        client_id = self.request.query_params.get("client_id")
        if client_id:
            queryset = queryset.filter(subscription__client_id=client_id)

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        # Automatically assign the logged-in user
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def weekly_overview(self, request, pk=None):
        """
        Get weekly nutrition overview with totals
        """
        nutrition_plan = self.get_object()
        meal_plans = nutrition_plan.meal_plans.all()

        # Group by day
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

        # 1. Force evaluation of the list BEFORE modifying anything
        # We fetch the original meals and their foods into memory
        original_meals = list(nutrition_plan.meal_plans.all().prefetch_related("foods"))

        if not original_meals:
            return Response({"error": "No meals to duplicate"}, status=400)

        with transaction.atomic():
            for meal in original_meals:
                # Cache the foods list from the original meal
                original_foods = list(meal.foods.all())

                # Create NEW meal
                meal.pk = None
                # Optional: You might want to rename the day to avoid duplicates like "Monday (Copy)"
                # meal.day = f"{meal.day} (Copy)"
                meal.save()

                # Create NEW foods attached to the NEW meal
                for food in original_foods:
                    food.pk = None
                    food.meal_plan = meal
                    food.save()

        return Response({"status": "Week duplicated successfully"})


class MealPlanViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing individual meal plans
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return MealPlanCreateSerializer
        return MealPlanSerializer

    def get_queryset(self):
        queryset = MealPlan.objects.all()

        # Filter by nutrition plan
        nutrition_plan_id = self.request.query_params.get("nutrition_plan_id")
        if nutrition_plan_id:
            queryset = queryset.filter(nutrition_plan_id=nutrition_plan_id)

        # Filter by day
        day = self.request.query_params.get("day")
        if day:
            queryset = queryset.filter(day=day)

        # Filter by meal type
        meal_type = self.request.query_params.get("meal_type")
        if meal_type:
            queryset = queryset.filter(meal_type=meal_type)

        return queryset.select_related("nutrition_plan").prefetch_related("foods")

    @action(detail=True, methods=["post"])
    def mark_completed(self, request, pk=None):
        """
        Mark a meal as completed
        """
        meal_plan = self.get_object()
        meal_plan.is_completed = True
        meal_plan.completed_at = timezone.now()
        meal_plan.save()

        return Response({"status": "Meal marked as completed"})

    @action(detail=True, methods=["post"])
    def add_photo(self, request, pk=None):
        """
        Add photo to meal
        """
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
        """
        Recalculate meal totals from food items
        """
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
    """
    ViewSet for managing food items
    """

    serializer_class = FoodItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = FoodItem.objects.all()

        # Filter by meal plan
        meal_plan_id = self.request.query_params.get("meal_plan_id")
        if meal_plan_id:
            queryset = queryset.filter(meal_plan_id=meal_plan_id)

        return queryset.select_related("meal_plan")

    def perform_create(self, serializer):
        food_item = serializer.save()

        # Auto-recalculate meal totals
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

        # Recalculate totals after deletion
        foods = meal_plan.foods.all()
        meal_plan.total_calories = sum(f.calories for f in foods)
        meal_plan.total_protein = sum(f.protein for f in foods)
        meal_plan.total_carbs = sum(f.carbs for f in foods)
        meal_plan.total_fats = sum(f.fats for f in foods)
        meal_plan.save()


class NutritionProgressViewSet(viewsets.ModelViewSet):
    """
    ViewSet for tracking nutrition progress
    """

    serializer_class = NutritionProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = NutritionProgress.objects.all()

        # Filter by nutrition plan
        nutrition_plan_id = self.request.query_params.get("nutrition_plan_id")
        if nutrition_plan_id:
            queryset = queryset.filter(nutrition_plan_id=nutrition_plan_id)

        # Filter by date range
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")

        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)

        return queryset.select_related("nutrition_plan")

    @action(detail=False, methods=["get"])
    def weekly_progress(self, request):
        """
        Get progress for the current week
        """
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
    """
    ViewSet for food database (pre-populated food items)
    """

    serializer_class = FoodDatabaseSerializer
    permission_classes = [IsAuthenticated]
    queryset = FoodDatabase.objects.all()

    @action(detail=False, methods=["get"])
    def search(self, request):
        """
        Search foods by name
        """
        query = request.query_params.get("q", "")
        category = request.query_params.get("category", "")

        queryset = self.get_queryset()

        if query:
            queryset = queryset.filter(name__icontains=query)

        if category:
            queryset = queryset.filter(category=category)

        # Limit results
        queryset = queryset[:20]

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
