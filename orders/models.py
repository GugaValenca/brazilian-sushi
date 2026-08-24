import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models


class DeliveryZone(models.Model):
    name = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=12, unique=True)
    fee = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    minimum_order = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    average_minutes = models.PositiveIntegerField(default=45)
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.postal_code})"


class Order(models.Model):
    class OrderType(models.TextChoices):
        DELIVERY = "delivery", "Delivery"
        PICKUP = "pickup", "Pickup"

    class NotificationPreference(models.TextChoices):
        SMS = "sms", "SMS"
        EMAIL = "email", "Email"
        BOTH = "both", "Both"

    class Status(models.TextChoices):
        RECEIVED = "received", "Order received"
        CONFIRMED = "confirmed", "Confirmed"
        PREPARING = "preparing", "In preparation"
        READY = "ready", "Ready for pickup"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
        NOT_REQUIRED = "not_required", "Not required"
        PENDING = "pending", "Pending payment"
        PAID = "paid", "Paid"
        FAILED = "failed", "Payment failed"

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="orders")
    delivery_address = models.ForeignKey("accounts.Address", null=True, blank=True, on_delete=models.SET_NULL, related_name="orders")
    coupon = models.ForeignKey("marketing.Coupon", null=True, blank=True, on_delete=models.SET_NULL, related_name="orders")
    delivery_zone = models.ForeignKey(DeliveryZone, null=True, blank=True, on_delete=models.SET_NULL)
    tracking_token = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    order_type = models.CharField(max_length=20, choices=OrderType.choices)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.RECEIVED)
    guest_name = models.CharField(max_length=120, blank=True)
    guest_email = models.EmailField(blank=True)
    guest_phone = models.CharField(max_length=20, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    allergy_notes = models.TextField(blank=True)
    notification_preference = models.CharField(max_length=10, choices=NotificationPreference.choices, default=NotificationPreference.BOTH)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.NOT_REQUIRED)
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True)
    subtotal = models.DecimalField(max_digits=9, decimal_places=2, default=0)
    delivery_fee = models.DecimalField(max_digits=9, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=9, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=9, decimal_places=2, default=0)
    estimated_minutes = models.PositiveIntegerField(default=45)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    preparation_started_at = models.DateTimeField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def average_delivery_time(self):
        checkpoints = [self.confirmed_at, self.preparation_started_at, self.dispatched_at, self.completed_at]
        valid = [checkpoint for checkpoint in checkpoints if checkpoint]
        if len(valid) < 2:
            return None
        return int((valid[-1] - valid[0]).total_seconds() // 60)

    def recalculate_totals(self):
        subtotal = sum((item.line_total for item in self.items.all()), Decimal("0.00"))
        self.subtotal = subtotal
        self.total = max(subtotal + self.delivery_fee - self.discount_amount, Decimal("0.00"))


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    menu_item = models.ForeignKey("menu.MenuItem", on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=8, decimal_places=2)
    line_total = models.DecimalField(max_digits=9, decimal_places=2)
    special_request = models.CharField(max_length=255, blank=True)


class OrderItemSelection(models.Model):
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name="selections")
    option = models.ForeignKey("menu.MenuOption", on_delete=models.PROTECT)
    price_delta = models.DecimalField(max_digits=8, decimal_places=2, default=0)


class OrderStatusEvent(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="status_events")
    status = models.CharField(max_length=30, choices=Order.Status.choices)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
