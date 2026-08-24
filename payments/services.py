"""Stripe Checkout integration.

Every function here is a no-op (returns None / False) when STRIPE_SECRET_KEY
isn't configured, so the rest of the checkout flow behaves exactly as it did
before payments existed — the same "only activates if the env var is set"
pattern already used for Twilio SMS in accounts/services.py.
"""
import logging

import stripe
from django.conf import settings

logger = logging.getLogger(__name__)


def stripe_configured():
    return bool(settings.STRIPE_SECRET_KEY)


def create_checkout_session(order):
    """Create a Stripe Checkout Session priced from the order's own
    server-computed line items and return its URL, or None if Stripe isn't
    configured or the session couldn't be created (checkout then proceeds
    without a payment step)."""
    if not stripe_configured():
        return None

    stripe.api_key = settings.STRIPE_SECRET_KEY

    line_items = [
        {
            "price_data": {
                "currency": "usd",
                "product_data": {"name": item.menu_item.name},
                "unit_amount": int(item.unit_price * 100),
            },
            "quantity": item.quantity,
        }
        for item in order.items.all()
    ]
    if order.delivery_fee:
        line_items.append(
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": "Delivery fee"},
                    "unit_amount": int(order.delivery_fee * 100),
                },
                "quantity": 1,
            }
        )
    if not line_items:
        return None

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=line_items,
            success_url=(
                f"{settings.STRIPE_CHECKOUT_SUCCESS_URL}"
                f"?order={order.id}&token={order.tracking_token}&payment=success"
            ),
            cancel_url=f"{settings.STRIPE_CHECKOUT_CANCEL_URL}?payment=cancelled",
            client_reference_id=str(order.id),
            customer_email=order.guest_email or None,
            metadata={"order_id": str(order.id), "tracking_token": str(order.tracking_token)},
        )
    except stripe.error.StripeError:
        logger.exception("Failed to create Stripe checkout session for order %s", order.pk)
        return None

    order.stripe_checkout_session_id = session.id
    order.payment_status = order.PaymentStatus.PENDING
    order.save(update_fields=["stripe_checkout_session_id", "payment_status"])
    return session.url


def handle_webhook_event(payload, sig_header):
    """Verify and process a Stripe webhook payload. Returns the Order that
    was updated, or None if the event was invalid, unverifiable, or not a
    payment confirmation we care about."""
    if not stripe_configured() or not settings.STRIPE_WEBHOOK_SECRET:
        return None

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        logger.warning("Rejected Stripe webhook: invalid payload or signature")
        return None

    if event["type"] != "checkout.session.completed":
        return None

    # Imported lazily to avoid a module-load-time circular import between
    # orders (which calls create_checkout_session) and payments (which needs
    # the Order model to process the webhook it triggers).
    from orders.models import Order
    from orders.services import apply_status_transition

    session = event["data"]["object"]
    order_id = session.get("client_reference_id")
    session_id = session.get("id")
    if not order_id or not session_id:
        return None

    try:
        order = Order.objects.get(pk=order_id, stripe_checkout_session_id=session_id)
    except (Order.DoesNotExist, ValueError):
        logger.warning("Stripe webhook referenced unknown order/session: %s / %s", order_id, session_id)
        return None

    if order.payment_status == Order.PaymentStatus.PAID:
        return order  # idempotent — Stripe may deliver the same event more than once

    order.payment_status = Order.PaymentStatus.PAID
    order.save(update_fields=["payment_status"])
    apply_status_transition(order, Order.Status.CONFIRMED, note="Payment confirmed via Stripe")
    return order
