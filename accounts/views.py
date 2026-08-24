from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    BrazilianSushiTokenObtainPairSerializer,
    ConfirmAccountSerializer,
    AddressSerializer,
    AdminCustomerSerializer,
    FavoriteMenuItemSerializer,
    RegisterSerializer,
    ResendConfirmationSerializer,
    UserSerializer,
)
from .services import send_account_confirmation

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"
    throttle_classes = [ScopedRateThrottle]


class LoginView(TokenObtainPairView):
    serializer_class = BrazilianSushiTokenObtainPairSerializer
    throttle_scope = "auth"
    throttle_classes = [ScopedRateThrottle]


class ConfirmAccountView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        serializer = ConfirmAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]

        try:
            user = User.objects.get(account_confirmation_token=token)
        except User.DoesNotExist:
            return Response({"detail": "This confirmation link is invalid or has expired."}, status=status.HTTP_404_NOT_FOUND)

        if user.account_confirmed_at:
            return Response({"detail": "Your account is already confirmed."})

        user.account_confirmed_at = timezone.now()
        user.is_active = True
        user.save(update_fields=["account_confirmed_at", "is_active"])
        return Response({"detail": "Your account has been confirmed. You can now sign in."})


class ResendConfirmationView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        serializer = ResendConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email=email).first()
        if user and not user.account_confirmed_at:
            send_account_confirmation(user)

        return Response(
            {"detail": "If an account is pending confirmation for that email, we have sent fresh confirmation instructions."},
            status=status.HTTP_200_OK,
        )


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.addresses.all()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def make_default(self, request, pk=None):
        self.get_queryset().update(is_default=False)
        address = self.get_object()
        address.is_default = True
        address.save(update_fields=["is_default"])
        return Response({"status": "default address updated"})


class FavoriteMenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteMenuItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.favorite_items.select_related("menu_item")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CustomerAdminViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = AdminCustomerSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        customer = self.get_object()
        customer.is_verified_customer = True
        customer.verified_reason = User.VerificationReason.IDENTITY
        customer.save(update_fields=["is_verified_customer", "verified_reason"])
        return Response(self.get_serializer(customer).data)

    @action(detail=True, methods=["post"])
    def remove_verification(self, request, pk=None):
        customer = self.get_object()
        customer.is_verified_customer = False
        customer.verified_reason = User.VerificationReason.NONE
        customer.save(update_fields=["is_verified_customer", "verified_reason"])
        return Response(self.get_serializer(customer).data)
