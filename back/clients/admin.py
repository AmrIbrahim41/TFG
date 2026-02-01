from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User, Group
from django.utils.html import format_html
from django.db.models import Sum, Count, F
from django.utils import timezone

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
        # Generates a visual progress bar
        if not obj.plan or obj.plan.units == 0:
            return 0
        percent = int((obj.sessions_used / obj.plan.units) * 100)
        return percent 


class MealPlanInline(StackedInline):
    model = MealPlan
    extra = 0
    tab = True # <--- This magic makes each meal a clickable tab!
    fields = ('day', 'meal_type', 'meal_name', 'total_calories', 'is_completed')
    readonly_fields = ('total_calories',)


# --- 3. MAIN MODELS ---

@admin.register(Client)
class ClientAdmin(ModelAdmin):
    list_display = ('user_card', 'status_badge', 'contact_info', 'active_plan', 'country_flag')
    search_fields = ('name', 'manual_id', 'phone')
    list_filter = ('status', 'country', 'is_child')
    list_filter_submit = True  # Adds a "Apply Filters" button (cleaner UI)
    inlines = [SubscriptionInline]

    # Tabs Configuration
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
        # Returns a rich card with image and name
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
        # Assuming you have flag emojis or logic based on country code
        return f"{obj.country}" 

    def active_plan(self, obj):
        sub = obj.subscriptions.filter(is_active=True).select_related('plan').first()
        return sub.plan.name if sub else "-"


@admin.register(ClientSubscription)
class ClientSubscriptionAdmin(ModelAdmin):
    list_display = ('client_link', 'plan_badge', 'trainer_avatar', 'visual_progress', 'expiry_status')
    list_filter = (
        ('start_date', RangeDateFilter), # Date Range Picker
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
        # Unfold automatically renders integers 0-100 as progress bars if configured
        if not obj.plan or obj.plan.units == 0:
            return 0
        return int((obj.sessions_used / obj.plan.units) * 100)

    @display(description="Expires", label={"Expired": "danger", "Valid": "success"})
    def expiry_status(self, obj):
        if obj.end_date and obj.end_date < timezone.now().date():
            return "Expired"
        return "Valid"

    @action(description="Renew selected subscriptions (Add 30 days)")
    def renew_subscription(self, request, queryset):
        for sub in queryset:
            if sub.end_date:
                sub.end_date += timedelta(days=30)
                sub.is_active = True
                sub.save()
        self.message_user(request, "Selected subscriptions renewed for 30 days.")


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
            'classes': ('tab', 'collapse'), # Collapsed by default
            'fields': ('calc_gender', 'calc_tdee', 'calc_weight', 'calc_activity_level')
        }),
    )

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

# Register remaining technical models simply
admin.site.register(TrainingPlan, ModelAdmin)
admin.site.register(TrainingExercise, ModelAdmin)