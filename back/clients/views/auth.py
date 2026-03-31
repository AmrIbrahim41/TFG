from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class LoginRateThrottle(AnonRateThrottle):
    """
    Brute-force mitigation for POST /auth/login/.
    Keyed on the remote IP address via DRF's AnonRateThrottle mechanism.

    Add the matching rate to your DRF settings:
        REST_FRAMEWORK = {
            'DEFAULT_THROTTLE_RATES': {'login_anon': '10/min'},
        }
    """
    scope = "login_anon"


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["first_name"] = user.first_name
        token["is_superuser"] = user.is_superuser
        token["is_receptionist"] = user.groups.filter(name="REC").exists()
        return token


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]


class CurrentUserView(APIView):
    """
    GET /auth/users/me/
    Returns minimal user data needed by WorkoutEditor:
      • id            — compared against completedByTrainerId for isReadOnly
      • first_name    — display name in the header
      • username      — fallback display name
      • is_superuser  — so the frontend can show admin-only controls
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'is_superuser': user.is_superuser,
        })
