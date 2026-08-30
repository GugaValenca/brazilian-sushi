from rest_framework import serializers

from accounts.models import Address, User
from marketing.models import Coupon

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
    # Unbounded before this: a huge option_ids array here becomes a huge SQL
    # IN(...) clause in _resolve_options, and no real menu item has more
    # than a handful of selectable options across all its groups combined.
    option_ids = serializers.ListField(child=serializers.IntegerField(), required=False, max_length=20)
    # Must match OrderItem.special_request's max_length (models.py) — the
    # serializer previously had no limit of its own, so an oversized value
    # passed validation here and only failed at the database with a raw,
    # unhandled error in Postgres (SQLite, used by the test DB, doesn't
    # enforce column length at all, so this class of bug doesn't surface in
    # tests without deliberately checking for it — the same gap the
    # quantity/line_total comment above already called out for that field).
    special_request = serializers.CharField(required=False, allow_blank=True, max_length=255)


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
            "guest_delivery_line_1",
            "guest_delivery_line_2",
            "guest_delivery_city",
            "guest_delivery_state",
            "guest_delivery_postal_code",
            "guest_delivery_notes",
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
        else:
            missing_fields = [
                field_name
                for field_name in ("guest_name", "guest_email", "guest_phone", "notification_preference")
                if not attrs.get(field_name)
            ]
            if missing_fields:
                raise serializers.ValidationError(
                    {field_name: "This field is required for guest checkout." for field_name in missing_fields}
                )

        # A delivery order with nowhere to actually deliver to previously
        # sailed straight through: delivery_zone only ever priced a fee for
        # a broad postal-code area, never carried a street address, and
        # nothing here required one. The kitchen would confirm and prepare
        # an order with genuinely no address on file.
        if attrs.get("order_type") == Order.OrderType.DELIVERY:
            if user:
                if not attrs.get("delivery_address"):
                    raise serializers.ValidationError(
                        {"delivery_address": "Select a delivery address for this order."}
                    )
            else:
                missing_address_fields = [
                    field_name
                    for field_name in (
                        "guest_delivery_line_1",
                        "guest_delivery_city",
                        "guest_delivery_state",
                        "guest_delivery_postal_code",
                    )
                    if not attrs.get(field_name)
                ]
                if missing_address_fields:
                    raise serializers.ValidationError(
                        {field_name: "This field is required for delivery." for field_name in missing_address_fields}
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


class OrderCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "phone_number", "is_verified_customer")


class OrderDeliveryAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ("id", "label", "recipient_name", "phone_number", "line_1", "line_2", "city", "state", "postal_code", "delivery_notes")


class OrderCouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = ("id", "code", "discount_type", "value")


class OrderAdminDetailSerializer(OrderSerializer):
    """The single-order view (OrderViewSet.retrieve) needs the actual
    customer/address/coupon/zone content, not just the bare foreign key ids
    OrderSerializer otherwise renders them as -- a staff member reviewing one
    order needs the real delivery address text and coupon code on screen."""

    customer = OrderCustomerSerializer(read_only=True)
    delivery_address = OrderDeliveryAddressSerializer(read_only=True)
    coupon = OrderCouponSerializer(read_only=True)
    delivery_zone = DeliveryZoneSerializer(read_only=True)
