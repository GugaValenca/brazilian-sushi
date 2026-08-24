"""Business logic for orders, kept out of views/serializers so it can be
unit-tested without going through HTTP (mirrors accounts/services.py and
marketing/services.py)."""
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from menu.models import MenuItem, MenuOption

from .models import Order, OrderItem, OrderItemSelection, OrderStatusEvent


class UnavailableMenuItem(serializers.ValidationError):
    """Raised when an order references a menu item that no longer exists or
    is not currently orderable."""


def _resolve_menu_item(menu_item_id):
    try:
        menu_item = MenuItem.objects.get(pk=menu_item_id)
    except (MenuItem.DoesNotExist, ValueError, TypeError):
        raise UnavailableMenuItem(
            {"items": "One or more items in your cart are no longer available."}
        )
    if menu_item.availability != MenuItem.Availability.AVAILABLE:
        raise UnavailableMenuItem(
            {"items": f'"{menu_item.name}" is currently unavailable and was removed from the menu.'}
        )
    return menu_item


def build_order_items(order, items_data):
    """Create OrderItem/OrderItemSelection rows for ``order`` from validated
    cart payload. Prices are always computed from the current MenuItem/MenuOption
    records — the client-submitted price is never trusted."""
    subtotal = Decimal("0.00")
    for item_data in items_data:
        menu_item = _resolve_menu_item(item_data["menu_item_id"])
        option_ids = item_data.get("option_ids", [])
        selected_options = list(MenuOption.objects.filter(id__in=option_ids, group__menu_item=menu_item))
        extra_cost = sum((option.price_delta for option in selected_options), Decimal("0.00"))
        unit_price = menu_item.price + extra_cost
        line_total = unit_price * item_data["quantity"]
        order_item = OrderItem.objects.create(
            order=order,
            menu_item=menu_item,
            quantity=item_data["quantity"],
            unit_price=unit_price,
            line_total=line_total,
            special_request=item_data.get("special_request", ""),
        )
        for option in selected_options:
            OrderItemSelection.objects.create(order_item=order_item, option=option, price_delta=option.price_delta)
        subtotal += line_total
    return subtotal


def create_order(validated_data, items_data, user):
    items_data = items_data or []
    if not items_data:
        raise serializers.ValidationError({"items": "Your order must include at least one item."})

    order = Order.objects.create(customer=user, **validated_data)
    subtotal = build_order_items(order, items_data)

    if order.delivery_zone and order.order_type == Order.OrderType.DELIVERY:
        order.delivery_fee = order.delivery_zone.fee
        order.estimated_minutes = order.delivery_zone.average_minutes

    order.subtotal = subtotal
    order.total = max(subtotal + order.delivery_fee - order.discount_amount, Decimal("0.00"))
    order.save()
    OrderStatusEvent.objects.create(order=order, status=order.status, note="Order created")
    return order


def clone_order_for_reorder(original_order, customer):
    new_order = Order.objects.create(
        customer=customer,
        delivery_address=original_order.delivery_address,
        coupon=original_order.coupon,
        delivery_zone=original_order.delivery_zone,
        order_type=original_order.order_type,
        notes=original_order.notes,
        allergy_notes=original_order.allergy_notes,
        notification_preference=original_order.notification_preference,
        delivery_fee=original_order.delivery_fee,
        estimated_minutes=original_order.estimated_minutes,
    )
    for item in original_order.items.all():
        cloned_item = new_order.items.create(
            menu_item=item.menu_item,
            quantity=item.quantity,
            unit_price=item.unit_price,
            line_total=item.line_total,
            special_request=item.special_request,
        )
        for selection in item.selections.all():
            cloned_item.selections.create(option=selection.option, price_delta=selection.price_delta)
    new_order.recalculate_totals()
    new_order.save()
    OrderStatusEvent.objects.create(order=new_order, status=new_order.status, note="Reordered from previous order")
    return new_order


def apply_status_transition(order, next_status, note=""):
    """Move ``order`` to ``next_status``, stamping the relevant timestamp,
    recording the event, and applying the loyalty/verification rules. Returns
    the updated order."""
    if next_status not in Order.Status.values:
        raise serializers.ValidationError({"status": "Invalid status."})

    order.status = next_status
    now = timezone.now()
    if next_status == Order.Status.CONFIRMED:
        order.confirmed_at = now
    elif next_status == Order.Status.PREPARING:
        order.preparation_started_at = now
    elif next_status == Order.Status.OUT_FOR_DELIVERY:
        order.dispatched_at = now
    elif next_status == Order.Status.DELIVERED:
        order.completed_at = now
    order.save()
    OrderStatusEvent.objects.create(order=order, status=next_status, note=note)

    customer = order.customer
    if customer and next_status == Order.Status.DELIVERED:
        _apply_loyalty(customer, order)

    return order


def _apply_loyalty(customer, order):
    customer.loyalty_completed_orders += 1
    if order.order_type == Order.OrderType.PICKUP and not customer.is_verified_customer:
        customer.is_verified_customer = True
        customer.verified_reason = User.VerificationReason.PICKUP
    elif customer.loyalty_completed_orders >= 5 and not customer.is_verified_customer:
        customer.is_verified_customer = True
        customer.verified_reason = User.VerificationReason.ORDER_HISTORY
    customer.save(update_fields=["loyalty_completed_orders", "is_verified_customer", "verified_reason"])
