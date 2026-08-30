import django_filters

from .models import Order


class OrderFilterSet(django_filters.FilterSet):
    """Backs the admin order list's filter controls. Search (guest/customer
    name, email, phone) is handled separately by DRF's SearchFilter on
    OrderViewSet -- this only covers the structured filters."""

    id = django_filters.NumberFilter(field_name="id")
    status = django_filters.MultipleChoiceFilter(choices=Order.Status.choices)
    payment_status = django_filters.ChoiceFilter(choices=Order.PaymentStatus.choices)
    order_type = django_filters.ChoiceFilter(choices=Order.OrderType.choices)
    created_after = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_before = django_filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = Order
        fields = ["id", "status", "payment_status", "order_type", "created_after", "created_before"]
