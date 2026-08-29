from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import ContactMessage, Coupon, Promotion, Review
from .serializers import (
    ContactMessageCreateSerializer,
    ContactMessageSerializer,
    CouponSerializer,
    PromotionSerializer,
    ReviewEligibilitySerializer,
    ReviewSerializer,
)
from .services import get_eligible_review_order


class PromotionViewSet(viewsets.ModelViewSet):
    serializer_class = PromotionSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = Promotion.objects.all()
        if self.request.user.is_staff:
            return queryset
        now = timezone.now()
        return queryset.filter(active=True, starts_at__lte=now, ends_at__gte=now)


class CouponViewSet(viewsets.ModelViewSet):
    serializer_class = CouponSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = Coupon.objects.all()
        if self.request.user.is_staff:
            return queryset
        now = timezone.now()
        return queryset.filter(active=True, starts_at__lte=now, ends_at__gte=now)


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = Review.objects.select_related("user", "order").prefetch_related("order__items__menu_item")
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(approval_status=Review.ApprovalStatus.APPROVED)

    def perform_create(self, serializer):
        eligible_order = get_eligible_review_order(self.request.user)
        requested_order_id = self.request.data.get("order_id")

        if not eligible_order or str(eligible_order.id) != str(requested_order_id):
            raise PermissionDenied("This review is no longer available. Reviews can only be submitted for the current eligible delivered order.")

        serializer.save(
            user=self.request.user,
            order=eligible_order,
            approval_status=Review.ApprovalStatus.PENDING,
        )

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def eligibility(self, request):
        payload = ReviewEligibilitySerializer.from_user(request.user)
        if not payload:
            return Response({"detail": "No eligible delivered order is currently available for review."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ReviewEligibilitySerializer(payload).data)


class ContactMessageViewSet(viewsets.ModelViewSet):
    queryset = ContactMessage.objects.all()

    def get_permissions(self):
        if self.action in {"list", "retrieve", "update", "partial_update", "destroy"}:
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        if self.action == "create":
            return ContactMessageCreateSerializer
        return ContactMessageSerializer
