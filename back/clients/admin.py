from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User, Group
from django.utils.html import format_html
from django.db.models import Sum, Count, F
from django.utils import timezone
from datetime import timedelta

# --- Unfold Imports ---
from unfold.admin import ModelAdmin, TabularInline, StackedInline
from unfold.decorators import display, action
from unfold.contrib.filters.admin import (
    RangeDateFilter,
    TextFilter
)
from unfold.contrib.import_export.forms import ExportForm, ImportForm
from unfold.contrib.import_export.forms import SelectableFieldsExportForm

# --- Local Imports ---
from .models import *

# --- 1. SETUP ADMIN SITE ---
admin.site.unregister(User)
admin.site.unregister(Group)

@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    list_display = ("username", "first_name", "role_badge", "active_clients_count", "last_login")
    search_fields = ("username", "first_name", "email")

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Profile", {"fields": ("first_name", "last_name", "email", "is_active"), "classes": ("tab",)}),
        ("Permissions", {"fields": ("is_staff", "is_superuser", "groups"), "classes": ("tab",)}),
    )

    @display(description="Role", label={"Admin": "danger", "Trainer": "success"})
    def role_badge(self, obj):
        return "Admin" if obj.is_superuser else "Trainer"

    @display(description="Clients")
    def active_clients_count(self, obj):
        return obj.clientsubscription_set.filter(is_active=True).count()


# --- 2. INLINES (Nested Data) ---

class SubscriptionInline(TabularInline):
    model = ClientSubscription
    extra = 0
    fields = ('plan', 'start_date', 'end_date', 'progress_bar', 'is_active')
    readonly_fields = ('end_date', 'progress_bar')
    can_delete = False
    show_change_link = True

    @display(description="Usage")
    def progress_bar(self, obj):
        if not obj.plan or obj.plan.units == 0:
            return 0
        percent = int((obj.sessions_used / obj.plan.units) * 100)
        return min(percent, 100)  # Cap at 100% — sessions_used can exceed plan.units after transfers


class MealPlanInline(StackedInline):
    model = MealPlan
    extra = 0
    tab = True
    fields = ('day', 'meal_type', 'meal_name', 'total_calories', 'is_completed')
    readonly_fields = ('total_calories',)


# ── NEW: Inline for TrainerSchedule inside Trainer/User admin ──
class TrainerScheduleInline(TabularInline):
    model = TrainerSchedule
    extra = 0
    fields = ('day_of_week', 'time_slot', 'client')
    show_change_link = True
    verbose_name = "Schedule Slot"
    verbose_name_plural = "Weekly Schedule Slots"


# --- 3. MAIN MODELS ---

@admin.register(Client)
class ClientAdmin(ModelAdmin):
    list_display = ('user_card', 'status_badge', 'contact_info', 'active_plan', 'country_flag')
    search_fields = ('name', 'manual_id', 'phone')
    list_filter = ('status', 'country', 'is_child')
    list_filter_submit = True
    inlines = [SubscriptionInline]

    fieldsets = (
        ("Identity", {
            'fields': ('name', 'manual_id', 'photo')
        }),
        ("Contact & Location", {
            'classes': ('tab',),
            'fields': ('phone', 'country', 'address', 'parent_phone')
        }),
        ("Physical Profile", {
            'classes': ('tab',),
            'fields': ('birth_date', 'nature_of_work', 'status', 'injuries', 'smoking', 'sleep_hours')
        }),
    )

    @display(description="Client", header=True)
    def user_card(self, obj):
        return [
            obj.name,
            f"ID: {obj.manual_id}",
            obj.photo
        ]

    @display(description="Status", label={
        "Active": "success",
        "Inactive": "secondary",
        "Injured": "warning"
    })
    def status_badge(self, obj):
        return obj.status

    @display(description="Contact")
    def contact_info(self, obj):
        return format_html(
            '<a href="tel:{}" class="text-blue-500 hover:text-blue-700">{}</a>',
            obj.phone, obj.phone
        )

    @display(description="Location")
    def country_flag(self, obj):
        return f"{obj.country}"
    
    @display(description="Active Plan")
    def active_plan(self, obj):
        sub = obj.subscriptions.filter(is_active=True).select_related('plan').first()
        return sub.plan.name if sub else "-"


@admin.register(ClientSubscription)
class ClientSubscriptionAdmin(ModelAdmin):
    list_display = ('client_link', 'plan_badge', 'trainer_avatar', 'visual_progress', 'expiry_status')
    list_filter = (
        ('start_date', RangeDateFilter),
        'is_active',
        'trainer',
        'plan'
    )
    autocomplete_fields = ['client', 'plan', 'trainer']
    actions = ['mark_completed', 'renew_subscription']

    fieldsets = (
        (None, {
            'fields': ('client', 'plan', 'trainer', 'is_active')
        }),
        ('Timeline & Progress', {
            'classes': ('tab',),
            'fields': ('start_date', 'end_date', 'sessions_used')
        }),
        ('Body Composition (InBody)', {
            'classes': ('tab',),
            'fields': ('inbody_weight', 'inbody_fat', 'inbody_muscle', 'inbody_goal', 'inbody_notes')
        }),
    )

    @display(description="Client")
    def client_link(self, obj):
        return obj.client.name

    @display(description="Plan", label=True)
    def plan_badge(self, obj):
        return obj.plan.name if obj.plan else "Custom"

    @display(description="Trainer", header=True)
    def trainer_avatar(self, obj):
        if not obj.trainer: return "Unassigned"
        return [obj.trainer.first_name, "Personal Trainer"]

    @display(description="Usage %")
    def visual_progress(self, obj):
        if not obj.plan or obj.plan.units == 0:
            return 0
        return int((obj.sessions_used / obj.plan.units) * 100)

    @display(description="Expires", label={"Expired": "danger", "Valid": "success"})
    def expiry_status(self, obj):
        if obj.end_date and obj.end_date < timezone.now().date():
            return "Expired"
        return "Valid"

    @action(description="Mark selected subscriptions as inactive/completed")
    def mark_completed(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} subscription(s) marked as inactive.")

    @action(description="Renew selected subscriptions based on plan duration")
    def renew_subscription(self, request, queryset):
        for sub in queryset.select_related('plan'):
            if sub.end_date:
                # Use the plan's actual duration rather than a hardcoded 30 days.
                # Fall back to 30 days only when no plan is attached (e.g. custom subs).
                days = sub.plan.duration_days if sub.plan else 30
                sub.end_date += timedelta(days=days)
                sub.is_active = True
                sub.save()
        self.message_user(request, "Selected subscriptions renewed based on their plan duration.")


@admin.register(NutritionPlan)
class NutritionPlanAdmin(ModelAdmin):
    list_display = ('name', 'client_name', 'calories_indicator', 'macro_breakdown', 'created_at')
    inlines = [MealPlanInline]
    list_filter = ('created_at',)

    fieldsets = (
        ("Settings", {
            'fields': ('subscription', 'name', 'duration_weeks', 'created_by')
        }),
        ("Calorie Targets", {
            'classes': ('tab',),
            'fields': ('target_calories', 'target_protein', 'target_carbs', 'target_fats')
        }),
        ("Calculator Data", {
            'classes': ('tab', 'collapse'),
            'fields': ('calc_gender', 'calc_tdee', 'calc_weight', 'calc_activity_level')
        }),
    )
    
    @display(description="Client") 
    def client_name(self, obj):
        return obj.subscription.client.name

    @display(description="Target", label="info")
    def calories_indicator(self, obj):
        return f"{obj.target_calories} kcal"

    @display(description="Macros (P/C/F)")
    def macro_breakdown(self, obj):
        return f"{obj.target_protein}g / {obj.target_carbs}g / {obj.target_fats}g"


# --- 4. DATA MANAGEMENT ---

@admin.register(FoodDatabase)
class FoodDatabaseAdmin(ModelAdmin):
    list_display = ('name', 'category_badge', 'calories_per_100g', 'protein_per_100g')
    search_fields = ('name',)
    list_filter = ('category',)
    list_per_page = 20

    @display(description="Category", label=True)
    def category_badge(self, obj):
        return obj.category


@admin.register(Subscription)
class SubscriptionPackageAdmin(ModelAdmin):
    list_display = ('name', 'price_formatted', 'units', 'duration_days', 'is_child_plan')
    search_fields = ('name',)

    @display(description="Price")
    def price_formatted(self, obj):
        return f"${obj.price}"


@admin.register(Country)
class CountryAdmin(ModelAdmin):
    list_display = ('name', 'code', 'dial_code')


# --- 5. NEW: TRAINER SHIFT & SCHEDULE ---

@admin.register(TrainerShift)
class TrainerShiftAdmin(ModelAdmin):
    """
    Admin panel for managing trainer working hours.
    """
    list_display = ('trainer_display', 'shift_start', 'shift_end', 'slot_duration_display', 'updated_at')
    search_fields = ('trainer__first_name', 'trainer__username')
    autocomplete_fields = ['trainer']

    fieldsets = (
        ("Trainer", {
            'fields': ('trainer',)
        }),
        ("Shift Hours", {
            'fields': ('shift_start', 'shift_end', 'slot_duration')
        }),
    )

    @display(description="Trainer")
    def trainer_display(self, obj):
        return obj.trainer.first_name or obj.trainer.username

    @display(description="Slot Duration")
    def slot_duration_display(self, obj):
        return f"{obj.slot_duration} min"


@admin.register(TrainerSchedule)
class TrainerScheduleAdmin(ModelAdmin):
    """
    Admin panel for viewing and managing all schedule slots.
    Shows only slots where the client still has an active subscription.
    """
    list_display = ('trainer_display', 'day_display', 'time_slot', 'client_display', 'subscription_status')
    search_fields = ('trainer__first_name', 'client__name')
    list_filter = ('day_of_week', 'trainer')
    autocomplete_fields = ['trainer', 'client']

    fieldsets = (
        ("Slot", {
            'fields': ('trainer', 'client', 'day_of_week', 'time_slot')
        }),
    )

    def get_queryset(self, request):
        """
        Filter out slots for clients with expired subscriptions.

        FIX #20: الكود السابق كان يستخدم filter مزدوج على نفس الـ JOIN:
            filter(
                client__subscriptions__is_active=True,
                client__subscriptions__trainer=DjF('trainer'),
            )
        هذا ينتج JOIN ضخم من TrainerSchedule → Client → ClientSubscription
        مع شرطين على نفس الـ FK، وكان يتطلب .distinct() لإزالة التكرار.
        الطريقة الأنظم هي استخدام Exists() subquery التي تُجري correlated
        subquery بدلاً من JOIN، وتضمن دقة النتيجة بدون الحاجة لـ distinct().
        """
        from django.db.models import Exists, OuterRef
        active_sub_exists = ClientSubscription.objects.filter(
            client=OuterRef('client'),
            trainer=OuterRef('trainer'),
            is_active=True,
        )
        return (
            super().get_queryset(request)
            .select_related('trainer', 'client')
            .filter(Exists(active_sub_exists))
        )

    @display(description="Trainer")
    def trainer_display(self, obj):
        return obj.trainer.first_name or obj.trainer.username

    @display(description="Day")
    def day_display(self, obj):
        return dict(TrainerSchedule.DAY_CHOICES).get(obj.day_of_week, str(obj.day_of_week))

    @display(description="Client")
    def client_display(self, obj):
        return obj.client.name

    @display(description="Sub Status", label={"Active": "success", "Expired": "danger"})
    def subscription_status(self, obj):
        has_active = obj.client.subscriptions.filter(
            trainer=obj.trainer, is_active=True
        ).exists()
        return "Active" if has_active else "Expired"


# --- Register remaining technical models simply ---
admin.site.register(TrainingPlan, ModelAdmin)
admin.site.register(TrainingExercise, ModelAdmin)