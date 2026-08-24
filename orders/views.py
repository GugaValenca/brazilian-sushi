from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db.models import Avg, DurationField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from payments.services import create_checkout_session

from .models import DeliveryZone, Order
from .serializers import CreateOrderSerializer, DeliveryZoneSerializer, OrderSerializer
from .services import apply_status_transition, clone_order_for_reorder


class DeliveryZoneViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DeliveryZone.objects.filter(active=True)
    serializer_class = DeliveryZoneSerializer


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.prefetch_related("items__selections", "status_events").select_related(
        "customer",
        "delivery_address",
        "coupon",
        "delivery_zone",
    )
    permission_classes = [permissions.AllowAny]
    # Orders are never mutated through the generic PUT/PATCH/DELETE routes.
    # Every state change (status, verification, totals) goes through a
    # dedicated, permission-checked action below instead — this is a second,
    # independent guard on top of OrderSerializer's read_only_fields so a
    # future refactor can't accidentally reopen direct field writes.
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return CreateOrderSerializer
        return OrderSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        # If Stripe is configured, hand the client a Checkout URL priced
        # entirely from what the server just computed for this order — the
        # frontend never sends (or can influence) an amount. If Stripe isn't
        # configured, checkout_url is simply absent and the order proceeds
        # exactly as it always has.
        checkout_url = create_checkout_session(order)

        response_serializer = OrderSerializer(order, context={"request": request})
        data = dict(response_serializer.data)
        if checkout_url:
            data["checkout_url"] = checkout_url
        headers = self.get_success_headers(response_serializer.data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_staff:
            return queryset
        if user.is_authenticated:
            return queryset.filter(customer=user)
        if self.action == "track":
            return queryset
        return queryset.none()

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def track(self, request):
        order_id = request.query_params.get("order_id")
        token = request.query_params.get("token")
        if not order_id or not token:
            return Response({"detail": "order_id and token are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.prefetch_related("items__selections", "status_events").select_related(
                "customer",
                "delivery_address",
                "coupon",
                "delivery_zone",
            ).get(pk=order_id, tracking_token=token)
        except (Order.DoesNotExist, ValidationError, ValueError):
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def reorder(self, request, pk=None):
        original_order = self.get_object()
        if original_order.customer != request.user and not request.user.is_staff:
            return Response({"detail": "You cannot reorder this order."}, status=status.HTTP_403_FORBIDDEN)

        new_order = clone_order_for_reorder(original_order, request.user)
        return Response(OrderSerializer(new_order, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAdminUser])
    def staff_queue(self, request):
        queue = self.get_queryset().filter(status__in=[Order.Status.RECEIVED, Order.Status.CONFIRMED, Order.Status.PREPARING, Order.Status.READY, Order.Status.OUT_FOR_DELIVERY])
        serializer = OrderSerializer(queue, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAdminUser])
    def summary(self, request):
        queryset = self.get_queryset()
        data = {
            "received": queryset.filter(status=Order.Status.RECEIVED).count(),
            "confirmed": queryset.filter(status=Order.Status.CONFIRMED).count(),
            "preparing": queryset.filter(status=Order.Status.PREPARING).count(),
            "ready": queryset.filter(status=Order.Status.READY).count(),
            "out_for_delivery": queryset.filter(status=Order.Status.OUT_FOR_DELIVERY).count(),
            "delivered": queryset.filter(status=Order.Status.DELIVERED).count(),
            "pickup_orders": queryset.filter(order_type=Order.OrderType.PICKUP).count(),
            "delivery_orders": queryset.filter(order_type=Order.OrderType.DELIVERY).count(),
            **self._delivery_metrics(queryset),
        }
        return Response(data)

    @staticmethod
    def _delivery_metrics(queryset):
        week_ago = timezone.now() - timedelta(days=7)
        delivered = queryset.filter(status=Order.Status.DELIVERED)

        revenue_rows = (
            delivered.filter(completed_at__gte=week_ago)
            .annotate(day=TruncDate("completed_at"))
            .values("day")
            .annotate(revenue=Sum("total"))
            .order_by("day")
        )
        daily_revenue = [
            {"date": row["day"].isoformat(), "revenue": str(row["revenue"] or Decimal("0.00"))}
            for row in revenue_rows
            if row["day"]
        ]
        revenue_last_7_days = sum((row["revenue"] or Decimal("0.00") for row in revenue_rows), Decimal("0.00"))

        avg_duration = (
            delivered.filter(confirmed_at__isnull=False, completed_at__isnull=False)
            .annotate(duration=ExpressionWrapper(F("completed_at") - F("confirmed_at"), output_field=DurationField()))
            .aggregate(avg=Avg("duration"))["avg"]
        )
        average_delivery_minutes = int(avg_duration.total_seconds() // 60) if avg_duration else None

        return {
            "revenue_last_7_days": str(revenue_last_7_days),
            "daily_revenue": daily_revenue,
            "average_delivery_minutes": average_delivery_minutes,
        }

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAdminUser])
    def update_status(self, request, pk=None):
        order = self.get_object()
        next_status = request.data.get("status")
        note = request.data.get("note", "")
        if next_status not in Order.Status.values:
            return Response({"detail": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)

        order = apply_status_transition(order, next_status, note)
        return Response(OrderSerializer(order, context={"request": request}).data)
