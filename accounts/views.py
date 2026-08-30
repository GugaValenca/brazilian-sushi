from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import (
    BrazilianSushiTokenObtainPairSerializer,
    ConfirmAccountSerializer,
    AddressSerializer,
    AdminCustomerSerializer,
    FavoriteMenuItemSerializer,
    LogoutSerializer,
    RegisterSerializer,
    ResendConfirmationSerializer,
    SetCustomerPasswordSerializer,
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
    # TokenObtainPairView doesn't set its own permission_classes, so this was
    # silently relying on REST_FRAMEWORK's DEFAULT_PERMISSION_CLASSES being
    # AllowAny -- the only view in the project depending on that global
    # default rather than declaring its own. Made explicit so the global
    # default can be tightened to IsAuthenticated (see settings.py) without
    # breaking the one endpoint that must stay public no matter what.
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"
    throttle_classes = [ScopedRateThrottle]


class RefreshView(TokenRefreshView):
    """Same reasoning as LoginView above: TokenRefreshView doesn't declare
    its own permission_classes either, and a refresh request has no access
    token to authenticate with in the first place (only a refresh token in
    the body) -- it must stay explicitly public."""

    permission_classes = [permissions.AllowAny]


class LogoutView(APIView):
    """Blacklists the given refresh token immediately, instead of the
    previous behavior where "logging out" only ever discarded it
    client-side -- a leaked or left-behind token stayed valid for its full
    lifetime regardless. AllowAny (like RefreshView above): possessing the
    refresh token itself is what proves the right to invalidate it, the
    same trust model the refresh endpoint already uses, so this doesn't
    need -- and shouldn't require -- a still-valid access token too (the
    access token may well have already expired by the time someone logs
    out of an idle session)."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            # Already expired, malformed, or already blacklisted -- the
            # caller's goal (this token must not work anymore) is already
            # satisfied either way.
            pass

        return Response(status=status.HTTP_205_RESET_CONTENT)


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
        # A customer's very first address has nothing to be "default"
        # relative to -- make it one automatically instead of leaving every
        # address unmarked until they think to hit make_default themselves.
        will_be_default = not self.get_queryset().exists() or serializer.validated_data.get("is_default", False)
        if will_be_default:
            self.get_queryset().update(is_default=False)
        serializer.save(user=self.request.user, is_default=will_be_default)

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
    filter_backends = [filters.SearchFilter]
    search_fields = ["email", "username", "first_name", "last_name", "phone_number"]

    def get_queryset(self):
        queryset = super().get_queryset()
        is_staff = self.request.query_params.get("is_staff")
        if is_staff == "true":
            queryset = queryset.filter(is_staff=True)
        elif is_staff == "false":
            queryset = queryset.filter(is_staff=False)
        return queryset

    def perform_update(self, serializer):
        # IsAdminUser only requires is_staff, so without this check any
        # staff member could hand themselves (or anyone else) is_staff or
        # is_superuser through a plain PATCH -- a real privilege-escalation
        # gap. Granting/revoking either flag now requires the *acting* user
        # to already be a superuser.
        escalation_fields = {"is_staff", "is_superuser"}
        if escalation_fields & set(serializer.validated_data) and not self.request.user.is_superuser:
            raise PermissionDenied("Only a superuser can change staff or superuser status.")
        serializer.save()

    @action(detail=True, methods=["post"])
    def set_password(self, request, pk=None):
        if not request.user.is_superuser:
            raise PermissionDenied("Only a superuser can set another user's password.")

        customer = self.get_object()
        serializer = SetCustomerPasswordSerializer(data=request.data, context={"user": customer})
        serializer.is_valid(raise_exception=True)
        customer.set_password(serializer.validated_data["password"])
        customer.save(update_fields=["password"])
        return Response({"detail": "Password updated."})

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
