from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

MAX_REVIEW_PHOTO_SIZE_BYTES = 5 * 1024 * 1024


def validate_review_photo_size(file):
    """Caps review photo uploads at 5MB. Content itself is already validated
    as a real image by ImageField (via Pillow) — this only guards against an
    otherwise-valid, needlessly huge file being accepted and stored."""
    if file.size > MAX_REVIEW_PHOTO_SIZE_BYTES:
        raise ValidationError("Image must be 5MB or smaller.")


class Promotion(models.Model):
    class Audience(models.TextChoices):
        ALL = "all", "All customers"
        VERIFIED = "verified", "Verified customers"
        RETURNING = "returning", "Returning customers"
        PICKUP = "pickup", "Pickup customers"
        DELIVERY = "delivery", "Delivery customers"

    title = models.CharField(max_length=150)
    description = models.TextField()
    audience = models.CharField(max_length=20, choices=Audience.choices, default=Audience.ALL)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    active = models.BooleanField(default=True)
    featured = models.BooleanField(default=False)


class Coupon(models.Model):
    class DiscountType(models.TextChoices):
        PERCENTAGE = "percentage", "Percentage"
        FIXED = "fixed", "Fixed amount"

    code = models.CharField(max_length=30, unique=True)
    description = models.CharField(max_length=255)
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices)
    value = models.DecimalField(max_digits=8, decimal_places=2)
    minimum_order = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    verified_only = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()


class Review(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews")
    order = models.OneToOneField("orders.Order", on_delete=models.CASCADE, related_name="review", null=True, blank=True)
    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=120)
    content = models.TextField()
    customer_photo = models.ImageField(
        upload_to="reviews/", blank=True, null=True, validators=[validate_review_photo_size]
    )
    approval_status = models.CharField(max_length=20, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ContactMessage(models.Model):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
