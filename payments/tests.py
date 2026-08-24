from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from menu.models import Category, MenuItem
from orders.models import Order

from .services import create_checkout_session, handle_webhook_event, stripe_configured

User = get_user_model()


class StripeNotConfiguredTests(TestCase):
    """When no Stripe keys are set (the default), payments must be a
    complete no-op so checkout keeps working exactly as it did before this
    feature existed."""

    def setUp(self):
        category = Category.objects.create(name="Rolls", slug="payments-rolls")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="California Roll",
            slug="california-roll-payments",
            short_description="Classic roll",
            price=Decimal("12.00"),
        )
        self.order = Order.objects.create(
            order_type=Order.OrderType.PICKUP,
            guest_name="Guest",
            guest_email="guest@braziliansushi.com",
            guest_phone="5551234567",
            subtotal=Decimal("12.00"),
            total=Decimal("12.00"),
        )
        self.order.items.create(
            menu_item=self.menu_item,
            quantity=1,
            unit_price=Decimal("12.00"),
            line_total=Decimal("12.00"),
        )

    def test_stripe_configured_is_false_by_default(self):
        self.assertFalse(stripe_configured())

    def test_create_checkout_session_returns_none_without_keys(self):
        checkout_url = create_checkout_session(self.order)

        self.assertIsNone(checkout_url)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, Order.PaymentStatus.NOT_REQUIRED)
        self.assertEqual(self.order.stripe_checkout_session_id, "")

    def test_webhook_ignored_without_keys(self):
        result = handle_webhook_event(b"{}", "irrelevant-signature")
        self.assertIsNone(result)


@override_settings(STRIPE_SECRET_KEY="sk_test_dummy", STRIPE_WEBHOOK_SECRET="whsec_dummy")
class StripeWebhookSecurityTests(TestCase):
    def test_webhook_rejects_invalid_signature(self):
        result = handle_webhook_event(b'{"type": "checkout.session.completed"}', "not-a-real-signature")
        self.assertIsNone(result)
