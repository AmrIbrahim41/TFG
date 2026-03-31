from rest_framework import viewsets, permissions

from ..models import ManualNutritionSave, ManualWorkoutSave
from ..serializers import ManualNutritionSaveSerializer, ManualWorkoutSaveSerializer


class ManualNutritionSaveViewSet(viewsets.ModelViewSet):
    serializer_class = ManualNutritionSaveSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Always return a flat list for the history drawer.

    def get_queryset(self):
        return ManualNutritionSave.objects.filter(user=self.request.user).order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ManualWorkoutSaveViewSet(viewsets.ModelViewSet):
    serializer_class = ManualWorkoutSaveSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Always return a flat list for the history drawer.

    def get_queryset(self):
        return ManualWorkoutSave.objects.filter(user=self.request.user).order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
