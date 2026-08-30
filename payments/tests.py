import hashlib
import hmac
import json
import time
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from menu.models import Category, MenuItem
from orders.models import Order

from .services import create_checkout_session, handle_webhook_event, refund_order, stripe_configured

User = get_user_model()


def signed_webhook_headers(payload: bytes, secret: str) -> str:
    """Builds a real Stripe-Signature header the same way Stripe itself
    does, so tests exercise actual signature verification (stripe.Webhook.
    construct_event) instead of stubbing it out."""
    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.{payload.decode()}".encode()
    signature = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={signature}"


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

    def test_refund_returns_false_without_keys(self):
        self.assertFalse(refund_order(self.order))


@override_settings(STRIPE_SECRET_KEY="sk_test_dummy", STRIPE_WEBHOOK_SECRET="whsec_dummy")
class RefundOrderTests(TestCase):
    def setUp(self):
        category = Category.objects.create(name="Rolls", slug="refund-rolls")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="Dragon Roll",
            slug="dragon-roll-refund-test",
            short_description="Classic roll",
            price=Decimal("16.00"),
        )
        self.order = Order.objects.create(
            order_type=Order.OrderType.PICKUP,
            guest_name="Refund Guest",
            guest_email="refund-guest@braziliansushi.com",
            guest_phone="5551234567",
            subtotal=Decimal("16.00"),
            total=Decimal("16.00"),
            payment_status=Order.PaymentStatus.PAID,
            stripe_checkout_session_id="cs_test_refund_me",
        )

    def test_refund_without_a_checkout_session_id_returns_false(self):
        self.order.stripe_checkout_session_id = ""
        self.order.save(update_fields=["stripe_checkout_session_id"])

        self.assertFalse(refund_order(self.order))

    @patch("stripe.Refund.create")
    @patch("stripe.checkout.Session.retrieve")
    def test_successful_refund_marks_the_order_refunded(self, mock_retrieve, mock_refund_create):
        mock_retrieve.return_value = MagicMock(payment_intent="pi_test_123")

        result = refund_order(self.order)

        self.assertTrue(result)
        mock_refund_create.assert_called_once_with(payment_intent="pi_test_123")
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, Order.PaymentStatus.REFUNDED)

    @patch("stripe.checkout.Session.retrieve")
    def test_missing_payment_intent_on_the_session_returns_false(self, mock_retrieve):
        mock_retrieve.return_value = MagicMock(payment_intent=None)

        result = refund_order(self.order)

        self.assertFalse(result)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, Order.PaymentStatus.PAID)

    @patch("stripe.checkout.Session.retrieve")
    def test_a_stripe_error_is_caught_and_returns_false(self, mock_retrieve):
        import stripe

        mock_retrieve.side_effect = stripe.error.StripeError("boom")

        result = refund_order(self.order)

        self.assertFalse(result)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, Order.PaymentStatus.PAID)


@override_settings(STRIPE_SECRET_KEY="sk_test_dummy", STRIPE_WEBHOOK_SECRET="whsec_dummy")
class StripeWebhookSecurityTests(TestCase):
    def test_webhook_rejects_invalid_signature(self):
        result = handle_webhook_event(b'{"type": "checkout.session.completed"}', "not-a-real-signature")
        self.assertIsNone(result)


@override_settings(STRIPE_SECRET_KEY="sk_test_dummy", STRIPE_WEBHOOK_SECRET="whsec_dummy")
class StripeWebhookProcessingTests(TestCase):
    """Regression tests for a real bug found by hitting this endpoint with
    an actual signed request instead of only unit-testing around it: the
    stripe-python version pinned in requirements.txt (15.x) returns
    event["data"]["object"] as a StripeObject, not a dict -- calling .get()
    on it raised AttributeError, crashing this endpoint with a 500 on every
    real webhook delivery. The previous tests only covered "not configured"
    and "bad signature", never a valid signed event reaching this code."""

    def setUp(self):
        category = Category.objects.create(name="Rolls", slug="webhook-processing-rolls")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="Spicy Tuna Roll",
            slug="spicy-tuna-roll-webhook-test",
            short_description="Classic roll",
            price=Decimal("14.00"),
        )
        self.order = Order.objects.create(
            order_type=Order.OrderType.PICKUP,
            guest_name="Webhook Guest",
            guest_email="webhook-guest@braziliansushi.com",
            guest_phone="5551234567",
            subtotal=Decimal("14.00"),
            total=Decimal("14.00"),
            stripe_checkout_session_id="cs_test_matching_session",
        )
        self.order.items.create(
            menu_item=self.menu_item,
            quantity=1,
            unit_price=Decimal("14.00"),
            line_total=Decimal("14.00"),
        )

    def _event_payload(self, session_id, order_id):
        return json.dumps(
            {
                "id": "evt_test",
                "type": "checkout.session.completed",
                "data": {"object": {"id": session_id, "client_reference_id": str(order_id)}},
            }
        ).encode()

    def test_valid_signed_event_marks_the_order_paid_without_crashing(self):
        payload = self._event_payload("cs_test_matching_session", self.order.id)
        signature = signed_webhook_headers(payload, "whsec_dummy")

        order = handle_webhook_event(payload, signature)

        self.assertIsNotNone(order)
        self.assertEqual(order.id, self.order.id)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, Order.PaymentStatus.PAID)
        self.assertTrue(self.order.status_events.filter(note="Payment confirmed via Stripe").exists())

    def test_valid_signed_event_for_an_already_advanced_order_does_not_regress_its_status(self):
        self.order.status = Order.Status.DELIVERED
        self.order.completed_at = None
        self.order.save(update_fields=["status"])
        payload = self._event_payload("cs_test_matching_session", self.order.id)
        signature = signed_webhook_headers(payload, "whsec_dummy")

        handle_webhook_event(payload, signature)

        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(self.order.status, Order.Status.DELIVERED, "a late webhook must not regress order status")

    def test_valid_signature_but_unmatched_session_is_ignored_without_crashing(self):
        payload = self._event_payload("cs_test_does_not_exist", self.order.id)
        signature = signed_webhook_headers(payload, "whsec_dummy")

        result = handle_webhook_event(payload, signature)

        self.assertIsNone(result)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, Order.PaymentStatus.NOT_REQUIRED)

    def test_valid_signature_with_unexpected_event_shape_does_not_crash(self):
        payload = json.dumps({"id": "evt_test", "type": "checkout.session.completed", "data": {}}).encode()
        signature = signed_webhook_headers(payload, "whsec_dummy")

        result = handle_webhook_event(payload, signature)

        self.assertIsNone(result)

    def test_repeated_delivery_of_the_same_event_is_idempotent(self):
        payload = self._event_payload("cs_test_matching_session", self.order.id)
        signature = signed_webhook_headers(payload, "whsec_dummy")

        handle_webhook_event(payload, signature)
        second_call_order = handle_webhook_event(payload, signature)

        self.assertIsNotNone(second_call_order)
        self.assertEqual(self.order.status_events.filter(note="Payment confirmed via Stripe").count(), 1)
