from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed

from .models import Address, FavoriteMenuItem
from .services import send_account_confirmation
from marketing.services import get_eligible_review_order

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirmation_channels = serializers.ListField(child=serializers.CharField(), read_only=True)
    confirmation_required = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "phone_number",
            "notification_preference",
            "sms_opt_in",
            "email_opt_in",
            "password",
            "confirmation_channels",
            "confirmation_required",
        )

    def validate(self, attrs):
        # AUTH_PASSWORD_VALIDATORS (backend/settings.py) is otherwise only
        # ever enforced by Django's own forms (the admin's "add user" form,
        # `manage.py changepassword`) -- nothing wired it up for this API
        # registration endpoint, so it silently accepted passwords like
        # "password" or "12345678" despite CommonPasswordValidator and
        # NumericPasswordValidator being configured. Building an unsaved
        # User from the other submitted fields lets
        # UserAttributeSimilarityValidator do its job too (reject a password
        # that's just the user's own email or name).
        temp_user = User(
            email=attrs.get("email", ""),
            username=attrs.get("username", ""),
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
        )
        try:
            validate_password(attrs.get("password", ""), user=temp_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, is_active=False, **validated_data)
        channels = send_account_confirmation(user)
        if not channels:
            user.is_active = True
            user.account_confirmed_at = timezone.now()
            user.save(update_fields=["is_active", "account_confirmed_at"])
        user._confirmation_channels = channels
        user._confirmation_required = bool(channels)
        return user

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["confirmation_channels"] = getattr(instance, "_confirmation_channels", [])
        data["confirmation_required"] = getattr(instance, "_confirmation_required", False)
        return data


class UserSerializer(serializers.ModelSerializer):
    can_submit_review = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "phone_number",
            "notification_preference",
            "sms_opt_in",
            "email_opt_in",
            "is_verified_customer",
            "verified_reason",
            "loyalty_completed_orders",
            "is_staff",
            "is_superuser",
            "account_confirmed_at",
            "can_submit_review",
        )
        read_only_fields = (
            "email",
            "is_verified_customer",
            "verified_reason",
            "loyalty_completed_orders",
            "is_staff",
            "is_superuser",
            "account_confirmed_at",
            "can_submit_review",
        )

    def get_can_submit_review(self, obj):
        return bool(get_eligible_review_order(obj))


class AdminCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "phone_number",
            "notification_preference",
            "sms_opt_in",
            "email_opt_in",
            "is_verified_customer",
            "verified_reason",
            "loyalty_completed_orders",
            "is_staff",
            "is_active",
            "date_joined",
        )
        read_only_fields = ("date_joined",)


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        exclude = ("user",)


class FavoriteMenuItemSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source="menu_item.name", read_only=True)

    class Meta:
        model = FavoriteMenuItem
        fields = ("id", "menu_item", "menu_item_name", "created_at")
        read_only_fields = ("created_at",)


class ResendConfirmationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ConfirmAccountSerializer(serializers.Serializer):
    token = serializers.UUIDField()


class BrazilianSushiTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "inactive_account": "Your account is still pending confirmation. Please confirm your signup link before signing in.",
        "no_active_account": "We couldn't sign you in with those credentials.",
    }

    @classmethod
    def get_token(cls, user):
        return super().get_token(user)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password", "")
        user = User.objects.filter(email=email).first()
        # check_password gates this on a *correct* password so the friendlier
        # "please confirm your account" message can't be used to enumerate
        # which emails are registered (or which are still unconfirmed) by
        # submitting a login with an arbitrary password — the same class of
        # leak ResendConfirmationView.post already avoids for its endpoint.
        if (
            user
            and not user.is_active
            and not user.account_confirmed_at
            and user.check_password(password)
        ):
            raise AuthenticationFailed(self.error_messages["inactive_account"], code="inactive_account")

        data = super().validate(attrs)
        update_last_login(None, self.user)
        return data
