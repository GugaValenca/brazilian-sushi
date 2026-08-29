from rest_framework import serializers

from accounts.models import Address

from .models import DeliveryZone, Order, OrderItem, OrderItemSelection, OrderStatusEvent
from .services import create_order


class DeliveryZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryZone
        fields = "__all__"


class OrderItemWriteSerializer(serializers.Serializer):
    menu_item_id = serializers.IntegerField()
    # Capped well above anything a real order would need. Without a ceiling,
    # a huge quantity here (unit_price * quantity) can produce a line_total
    # past the model field's max_digits, which Postgres rejects at INSERT
    # time as an unhandled 500 rather than the clean 400 this should be —
    # SQLite (used by the test DB) doesn't enforce that precision at all, so
    # this class of bug wouldn't otherwise show up in tests.
    quantity = serializers.IntegerField(min_value=1, max_value=50)
    option_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    special_request = serializers.CharField(required=False, allow_blank=True)


class CreateOrderSerializer(serializers.ModelSerializer):
    # max_length keeps a single request from creating an unbounded number of
    # OrderItem rows in one call — no real cart needs more than this.
    items = OrderItemWriteSerializer(many=True, write_only=True, min_length=1, max_length=50)
    # Overrides the ModelSerializer's default auto-generated field, which
    # would otherwise validate against Address.objects.all() — i.e. accept
    # ANY address primary key in the database, letting one customer attach
    # (and thereby route a delivery to) another customer's saved home
    # address. Scoped to the requesting user's own addresses in __init__;
    # a guest checkout has no addresses to choose from at all.
    delivery_address = serializers.PrimaryKeyRelatedField(
        queryset=Address.objects.none(), required=False, allow_null=True
    )

    class Meta:
        model = Order
        fields = (
            "id",
            "customer",
            "delivery_address",
            "coupon",
            "delivery_zone",
            "order_type",
            "guest_name",
            "guest_email",
            "guest_phone",
            "scheduled_for",
            "notes",
            "allergy_notes",
            "notification_preference",
            "items",
        )
        read_only_fields = ("customer",)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            self.fields["delivery_address"].queryset = user.addresses.all()

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user if request.user.is_authenticated else None

        if user:
            attrs["guest_name"] = user.get_full_name().strip() or user.username
            attrs["guest_email"] = user.email
            attrs["guest_phone"] = user.phone_number
            attrs["notification_preference"] = user.notification_preference
            return attrs

        missing_fields = [
            field_name
            for field_name in ("guest_name", "guest_email", "guest_phone", "notification_preference")
            if not attrs.get(field_name)
        ]
        if missing_fields:
            raise serializers.ValidationError(
                {field_name: "This field is required for guest checkout." for field_name in missing_fields}
            )

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        request = self.context["request"]
        user = request.user if request.user.is_authenticated else None
        return create_order(validated_data, items_data, user)


class OrderItemSelectionSerializer(serializers.ModelSerializer):
    option_name = serializers.CharField(source="option.name", read_only=True)

    class Meta:
        model = OrderItemSelection
        fields = ("id", "option", "option_name", "price_delta")


class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source="menu_item.name", read_only=True)
    selections = OrderItemSelectionSerializer(many=True, read_only=True)

    class Meta:
        model = OrderItem
        fields = ("id", "menu_item", "menu_item_name", "quantity", "unit_price", "line_total", "special_request", "selections")


class OrderStatusEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusEvent
        fields = ("id", "status", "note", "created_at")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_events = OrderStatusEventSerializer(many=True, read_only=True)
    average_delivery_time = serializers.ReadOnlyField()
    has_kitchen_notes = serializers.SerializerMethodField()
    has_allergy_alert = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = "__all__"
        # Every field except the customer-editable ones (notes, allergy_notes)
        # is derived server-side. This is a deliberate allow-list, not an
        # oversight: OrderViewSet also disables PUT/PATCH/DELETE entirely
        # (see http_method_names below), so this list is a second, independent
        # layer in case the serializer is ever reused by a future writable view.
        read_only_fields = (
            "customer",
            "delivery_address",
            "coupon",
            "delivery_zone",
            "tracking_token",
            "status",
            "subtotal",
            "delivery_fee",
            "discount_amount",
            "total",
            "estimated_minutes",
            "confirmed_at",
            "preparation_started_at",
            "dispatched_at",
            "completed_at",
            "created_at",
            "updated_at",
            "payment_status",
            "stripe_checkout_session_id",
        )

    def get_has_kitchen_notes(self, obj):
        return bool((obj.notes or "").strip() or (obj.allergy_notes or "").strip())

    def get_has_allergy_alert(self, obj):
        return bool((obj.allergy_notes or "").strip())
