from django.contrib import admin
from .models import *
   


# 1. Client Admin
@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'manual_id', 'phone', 'status', 'created_at')
    search_fields = ('name', 'manual_id', 'phone')
    list_filter = ('status', 'created_at')
    ordering = ('-created_at',)

# 2. Subscription Packages Admin (The Plans you sell)
@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('name', 'units', 'duration_days', 'price')
    search_fields = ('name',)

# 3. Client Subscriptions Admin (Who bought what)
@admin.register(ClientSubscription)
class ClientSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('client', 'plan', 'trainer', 'start_date', 'end_date', 'is_active', 'sessions_used')
    list_filter = ('is_active', 'start_date', 'plan')
    search_fields = ('client__name', 'plan__name', 'trainer__username')
    autocomplete_fields = ['client', 'plan', 'trainer'] # Makes selecting clients faster
    
    # Organize InBody Data in a separate section
    fieldsets = (
        ('Subscription Details', {
            'fields': ('client', 'plan', 'trainer', 'is_active', 'sessions_used')
        }),
        ('Dates', {
            'fields': ('start_date', 'end_date')
        }),
        ('InBody Analysis', {
            'fields': ('inbody_height', 'inbody_weight', 'inbody_muscle', 'inbody_fat', 'inbody_tbw', 'inbody_goal', 'inbody_activity', 'inbody_notes'),
            'classes': ('collapse',) # Click to expand
        }),
    )

# 4. Training Plan Admin (With Inline Splits)
# This allows you to edit the "Days" inside the "Plan" page directly
class TrainingDaySplitInline(admin.TabularInline):
    model = TrainingDaySplit
    extra = 0 # Don't show empty extra rows
    fields = ('order', 'name')
    ordering = ('order',)

@admin.register(TrainingPlan)
class TrainingPlanAdmin(admin.ModelAdmin):
    list_display = ('subscription', 'cycle_length', 'created_at')
    inlines = [TrainingDaySplitInline] # Shows the days inside the plan
    
    
    
    
    
    
    
    
    
    
    
    
 
@admin.register(NutritionPlan)
class NutritionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'get_client', 'duration_weeks', 'target_calories', 'diet_type', 'created_at')
    list_filter = ('diet_type', 'created_at')
    search_fields = ('name', 'subscription__client__name')

    def get_client(self, obj):
        return obj.subscription.client.name
    get_client.short_description = 'Client'
    
    
@admin.register(MealPlan)
class MealPlanAdmin(admin.ModelAdmin):
    list_display = ('nutrition_plan', 'day', 'meal_type', 'total_calories', 'is_completed')
    list_filter = ('day', 'meal_type', 'is_completed')

@admin.register(FoodItem)
class FoodItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'meal_plan', 'quantity', 'calories')
    search_fields = ('name',)

@admin.register(FoodDatabase)
class FoodDatabaseAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'calories_per_100g', 'is_verified')
    list_filter = ('category', 'is_verified')
    search_fields = ('name',)