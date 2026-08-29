from datetime import timedelta

from rest_framework import serializers

from .models import ContactMessage, Coupon, Promotion, Review
from .services import get_eligible_review_order


class PromotionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promotion
        fields = "__all__"


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = "__all__"


class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="user.get_full_name", read_only=True)
    is_verified_customer = serializers.BooleanField(source="user.is_verified_customer", read_only=True)
    order_id = serializers.IntegerField(source="order.id", read_only=True)
    order_item_names = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "user",
            "order",
            "order_id",
            "order_item_names",
            "customer_name",
            "is_verified_customer",
            "rating",
            "title",
            "content",
            "customer_photo",
            "approval_status",
            "created_at",
        )
        read_only_fields = ("user", "created_at")

    def get_order_item_names(self, obj):
        if not obj.order_id:
            return []
        return [item.menu_item.name for item in obj.order.items.select_related("menu_item").all()]


class ReviewEligibilitySerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    available_until = serializers.DateTimeField()
    product_names = serializers.ListField(child=serializers.CharField())

    @classmethod
    def from_user(cls, user):
        order = get_eligible_review_order(user)
        if not order:
            return None

        return {
            "order_id": order.id,
            "available_until": order.completed_at + timedelta(hours=24),
            "product_names": [item.menu_item.name for item in order.items.select_related("menu_item").all()],
        }


class ContactMessageSerializer(serializers.ModelSerializer):
    """Used for staff-only actions (list/retrieve/update/destroy — see
    ContactMessageViewSet.get_permissions), where `resolved` is meant to be
    writable. The public create action uses ContactMessageCreateSerializer
    instead, which doesn't expose the field at all — a single serializer
    with `resolved` merely read-only would block *both* the public write
    (correct) and the staff one (not correct), since read_only_fields
    applies to every action that uses the serializer, not just create."""

    class Meta:
        model = ContactMessage
        fields = "__all__"
        read_only_fields = ("created_at",)


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("id", "name", "email", "phone", "message", "created_at")
        read_only_fields = ("created_at",)
