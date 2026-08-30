from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import MaxLengthValidator
from django.utils import timezone
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.validators import UniqueValidator

from .models import Address, FavoriteMenuItem
from .services import send_account_confirmation
from marketing.services import get_eligible_review_order

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    # max_length guards against a password-hashing DoS: PBKDF2 (Django's
    # default hasher) processes its full input, so an unbounded field lets
    # a request submit a multi-megabyte "password" and force an expensive
    # hash of it. 128 is far beyond any real password anyone would type.
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    confirmation_channels = serializers.ListField(child=serializers.CharField(), read_only=True)
    confirmation_required = serializers.BooleanField(read_only=True)
    # A delivery address is optional at signup -- a customer who only ever
    # picks up in-store has no reason to provide one, and checkout already
    # requires one before a *delivery* order can be placed either way. If
    # they do provide one here, it's saved as their default address so it's
    # ready to go the first time they order delivery, instead of asking
    # again at checkout for information they already gave once.
    address_line_1 = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=255)
    address_line_2 = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=255)
    address_city = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=100)
    address_state = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=2)
    address_postal_code = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=12)
    address_delivery_notes = serializers.CharField(write_only=True, required=False, allow_blank=True)

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
            "address_line_1",
            "address_line_2",
            "address_city",
            "address_state",
            "address_postal_code",
            "address_delivery_notes",
        )
        extra_kwargs = {
            # email already has a DB-level unique constraint, which DRF
            # auto-validates -- overridden here purely for a clearer message
            # than the default "user with this email already exists.".
            "email": {
                "validators": [
                    UniqueValidator(
                        queryset=User.objects.all(),
                        message="An account with this email already exists. Try signing in instead.",
                    )
                ]
            },
        }

    def validate_phone_number(self, value):
        # phone_number has no DB-level uniqueness constraint (it's blank=True,
        # and a plain unique=True would collide every blank phone number
        # against every other one) -- enforced here instead, and only for a
        # phone number actually provided.
        if value and User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError(
                "An account with this phone number already exists. Try signing in instead."
            )
        return value

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

        # The address is entirely optional, but a partial one (e.g. a city
        # with no street) would otherwise silently save an unusable address
        # row instead of asking for what's missing.
        address_provided = any(
            attrs.get(field) for field in ("address_line_1", "address_city", "address_state", "address_postal_code")
        )
        if address_provided:
            missing = [
                field
                for field in ("address_line_1", "address_city", "address_state", "address_postal_code")
                if not attrs.get(field)
            ]
            if missing:
                raise serializers.ValidationError(
                    {field: "This field is required to save a delivery address." for field in missing}
                )

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        address_fields = {
            key: validated_data.pop(key, "")
            for key in (
                "address_line_1",
                "address_line_2",
                "address_city",
                "address_state",
                "address_postal_code",
                "address_delivery_notes",
            )
        }
        user = User.objects.create_user(password=password, is_active=False, **validated_data)

        if address_fields["address_line_1"]:
            Address.objects.create(
                user=user,
                label="Home",
                recipient_name=user.get_full_name().strip() or user.username,
                phone_number=user.phone_number,
                line_1=address_fields["address_line_1"],
                line_2=address_fields["address_line_2"],
                city=address_fields["address_city"],
                state=address_fields["address_state"],
                postal_code=address_fields["address_postal_code"],
                delivery_notes=address_fields["address_delivery_notes"],
                is_default=True,
            )

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


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        exclude = ("user",)


class AdminCustomerSerializer(serializers.ModelSerializer):
    # A customer's saved addresses (including any delivery notes) weren't
    # visible anywhere in the admin -- staff had no way to see where a
    # customer lives, or the gate code/building instructions they'd saved,
    # outside of an order that happened to carry one.
    addresses = AddressSerializer(many=True, read_only=True)

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
            "is_active",
            "date_joined",
            "addresses",
        )
        read_only_fields = ("date_joined",)


class SetCustomerPasswordSerializer(serializers.Serializer):
    """Deliberately not a self-service reset (production has no email
    provider configured — see README's Known Limitations). A superuser
    setting a new staff member's password directly is the smallest real fix
    that doesn't depend on that."""

    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    def validate_password(self, value):
        user = self.context.get("user")
        try:
            validate_password(value, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value


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


class LogoutSerializer(serializers.Serializer):
    # A real refresh JWT is a few hundred characters; capped well above that
    # so an oversized garbage string doesn't get as far as RefreshToken()
    # attempting to decode it.
    refresh = serializers.CharField(max_length=2048)


class BrazilianSushiTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "inactive_account": "Your account is still pending confirmation. Please confirm your signup link before signing in.",
        "no_active_account": "We couldn't sign you in with those credentials.",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # SimpleJWT builds the password field dynamically (see
        # TokenObtainSerializer.__init__) with no length limit at all —
        # login is the most exposed, most frequently-hit unauthenticated
        # endpoint in the app, so an unbounded field here is the most
        # exploitable spot for the PBKDF2-hashing-a-huge-string DoS this
        # guards against (check_password hashes whatever it's given).
        # Appended rather than redeclared to avoid quietly dropping
        # whatever else SimpleJWT configured on its own PasswordField.
        self.fields["password"].validators.append(MaxLengthValidator(128))

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
