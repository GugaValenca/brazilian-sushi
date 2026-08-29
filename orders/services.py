"""Business logic for orders, kept out of views/serializers so it can be
unit-tested without going through HTTP (mirrors accounts/services.py and
marketing/services.py)."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from menu.models import MenuItem, MenuOption

from .models import Order, OrderItem, OrderItemSelection, OrderStatusEvent


class UnavailableMenuItem(serializers.ValidationError):
    """Raised when an order references a menu item that no longer exists or
    is not currently orderable."""


class InvalidCoupon(serializers.ValidationError):
    """Raised when an order references a coupon that can't actually be
    applied — rejected outright rather than silently charging full price, so
    a customer who typed in a real (but expired/inapplicable) code finds out
    immediately instead of assuming a discount was applied."""


def _compute_coupon_discount(coupon, subtotal, user):
    now = timezone.now()
    if not coupon.active or not (coupon.starts_at <= now <= coupon.ends_at):
        raise InvalidCoupon({"coupon": "This coupon is no longer valid."})
    if subtotal < coupon.minimum_order:
        raise InvalidCoupon(
            {"coupon": f"This coupon requires a minimum order of ${coupon.minimum_order}."}
        )
    # `user` is already guaranteed authenticated (or None for a guest
    # checkout) by CreateOrderSerializer.create — see its call site.
    if coupon.verified_only and not (user and user.is_verified_customer):
        raise InvalidCoupon({"coupon": "This coupon is only available to verified customers."})

    if coupon.discount_type == coupon.DiscountType.PERCENTAGE:
        discount = (subtotal * coupon.value / Decimal("100")).quantize(Decimal("0.01"))
    else:
        discount = coupon.value
    return min(discount, subtotal)


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


def _resolve_options(menu_item, option_ids):
    """Validates the selected options against each of the item's option
    groups (required / min_select / max_select) and returns the selected
    MenuOption rows. An option belonging to another item is silently
    excluded by the group__menu_item filter, same as before this check
    existed — this only adds the group cardinality rules on top."""
    selected_options = list(
        MenuOption.objects.select_related("group").filter(id__in=option_ids, group__menu_item=menu_item)
    )
    selected_by_group = {}
    for option in selected_options:
        selected_by_group.setdefault(option.group_id, []).append(option)

    for group in menu_item.option_groups.all():
        count = len(selected_by_group.get(group.id, []))
        if group.required and count == 0:
            raise UnavailableMenuItem(
                {"items": f'"{group.name}" is required for "{menu_item.name}".'}
            )
        if count < group.min_select:
            raise UnavailableMenuItem(
                {"items": f'Select at least {group.min_select} option(s) for "{group.name}" on "{menu_item.name}".'}
            )
        if count > group.max_select:
            raise UnavailableMenuItem(
                {"items": f'Select at most {group.max_select} option(s) for "{group.name}" on "{menu_item.name}".'}
            )

    return selected_options


def build_order_items(order, items_data):
    """Create OrderItem/OrderItemSelection rows for ``order`` from validated
    cart payload. Prices are always computed from the current MenuItem/MenuOption
    records — the client-submitted price is never trusted."""
    subtotal = Decimal("0.00")
    for item_data in items_data:
        menu_item = _resolve_menu_item(item_data["menu_item_id"])
        option_ids = item_data.get("option_ids", [])
        selected_options = _resolve_options(menu_item, option_ids)
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

    # Wrapped in a transaction: build_order_items or the coupon check below
    # can raise partway through (a sold-out item, an expired coupon) after
    # the Order row already exists — without this, that failed request would
    # still leave an orphaned, item-less Order behind despite the 400
    # response the client actually got.
    with transaction.atomic():
        coupon = validated_data.get("coupon")
        order = Order.objects.create(customer=user, **validated_data)
        subtotal = build_order_items(order, items_data)

        if order.delivery_zone and order.order_type == Order.OrderType.DELIVERY:
            order.delivery_fee = order.delivery_zone.fee
            order.estimated_minutes = order.delivery_zone.average_minutes

        if coupon:
            order.discount_amount = _compute_coupon_discount(coupon, subtotal, user)

        order.subtotal = subtotal
        order.total = max(subtotal + order.delivery_fee - order.discount_amount, Decimal("0.00"))
        order.save()
        OrderStatusEvent.objects.create(order=order, status=order.status, note="Order created")
    return order


def clone_order_for_reorder(original_order, customer):
    """Places a new order for the same items as ``original_order``. Deliberately
    does not copy the old unit_price/line_total across: menu prices and item
    availability can both have changed since then, and every other order-creation
    path in this file prices strictly from current MenuItem/MenuOption records —
    reorder re-runs the same build_order_items used for a fresh checkout instead
    of trusting frozen numbers from a potentially stale historical order."""
    items_data = [
        {
            "menu_item_id": item.menu_item_id,
            "quantity": item.quantity,
            "option_ids": list(item.selections.values_list("option_id", flat=True)),
            "special_request": item.special_request,
        }
        for item in original_order.items.all()
    ]

    with transaction.atomic():
        new_order = Order.objects.create(
            customer=customer,
            delivery_address=original_order.delivery_address,
            delivery_zone=original_order.delivery_zone,
            order_type=original_order.order_type,
            notes=original_order.notes,
            allergy_notes=original_order.allergy_notes,
            notification_preference=original_order.notification_preference,
        )
        subtotal = build_order_items(new_order, items_data)

        if new_order.delivery_zone and new_order.order_type == Order.OrderType.DELIVERY:
            new_order.delivery_fee = new_order.delivery_zone.fee
            new_order.estimated_minutes = new_order.delivery_zone.average_minutes

        # Carry the original coupon forward only if it's still valid today —
        # reorder never asks the customer to re-enter one, so an expired or
        # now-inapplicable coupon is just dropped instead of blocking the
        # whole reorder over a promo they weren't actively trying to use.
        if original_order.coupon:
            try:
                new_order.discount_amount = _compute_coupon_discount(original_order.coupon, subtotal, customer)
                new_order.coupon = original_order.coupon
            except InvalidCoupon:
                pass

        new_order.subtotal = subtotal
        new_order.total = max(subtotal + new_order.delivery_fee - new_order.discount_amount, Decimal("0.00"))
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
