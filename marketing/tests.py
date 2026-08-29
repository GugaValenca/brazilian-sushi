from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.test import APITestCase

from .models import ContactMessage, Review
from orders.models import Order
from menu.models import Category, MenuItem

User = get_user_model()


class ReviewSubmissionTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Rolls", slug="rolls", sort_order=1)
        self.menu_item = MenuItem.objects.create(
            category=self.category,
            name="Brazilian Roll",
            slug="brazilian-roll-review-test",
            short_description="Signature roll",
            description="Signature roll",
            price="18.99",
            allergens="fish",
        )

    def test_customer_without_completed_order_cannot_submit_review(self):
        user = User.objects.create_user(
            email="guest-review@braziliansushi.com",
            username="guestreview",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user)

        response = self.client.post(
            reverse("review-list"),
            {
                "rating": 5,
                "title": "Amazing dinner",
                "content": "Great sushi and fast delivery.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Review.objects.count(), 0)

    def test_customer_with_completed_order_review_starts_pending_approval(self):
        user = User.objects.create_user(
            email="verified-review@braziliansushi.com",
            username="verifiedreview",
            password="StrongPass123!",
        )
        order = Order.objects.create(
            customer=user,
            order_type=Order.OrderType.DELIVERY,
            status=Order.Status.DELIVERED,
            guest_name="Verified Review",
            guest_email=user.email,
            guest_phone="8135550002",
            total="25.00",
            subtotal="25.00",
            completed_at=timezone.now(),
        )
        order.items.create(
            menu_item=self.menu_item,
            quantity=1,
            unit_price="18.99",
            line_total="18.99",
        )
        self.client.force_authenticate(user)

        response = self.client.post(
            reverse("review-list"),
            {
                "order_id": order.id,
                "rating": 5,
                "title": "Premium experience",
                "content": "Presentation, flavor, and timing were excellent.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        review = Review.objects.get()
        self.assertEqual(review.user, user)
        self.assertEqual(review.order, order)
        self.assertEqual(review.approval_status, Review.ApprovalStatus.PENDING)

    def test_review_window_expires_after_24_hours(self):
        user = User.objects.create_user(
            email="expired-review@braziliansushi.com",
            username="expiredreview",
            password="StrongPass123!",
        )
        order = Order.objects.create(
            customer=user,
            order_type=Order.OrderType.DELIVERY,
            status=Order.Status.DELIVERED,
            guest_name="Expired Review",
            guest_email=user.email,
            guest_phone="8135550003",
            total="25.00",
            subtotal="25.00",
            completed_at=timezone.now() - timedelta(hours=25),
        )
        order.items.create(
            menu_item=self.menu_item,
            quantity=1,
            unit_price="18.99",
            line_total="18.99",
        )
        self.client.force_authenticate(user)

        response = self.client.get(reverse("review-eligibility"))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_eligibility_returns_latest_delivered_order_details(self):
        user = User.objects.create_user(
            email="eligible-review@braziliansushi.com",
            username="eligiblereview",
            password="StrongPass123!",
        )
        old_order = Order.objects.create(
            customer=user,
            order_type=Order.OrderType.DELIVERY,
            status=Order.Status.DELIVERED,
            guest_name="Old Delivered",
            guest_email=user.email,
            guest_phone="8135550005",
            total="18.99",
            subtotal="18.99",
            completed_at=timezone.now() - timedelta(hours=6),
        )
        old_order.created_at = timezone.now() - timedelta(hours=7)
        old_order.save(update_fields=["created_at"])
        old_order.items.create(
            menu_item=self.menu_item,
            quantity=1,
            unit_price="18.99",
            line_total="18.99",
        )
        latest_item = MenuItem.objects.create(
            category=self.category,
            name="Dragon Roll",
            slug="dragon-roll-review-test",
            short_description="Another signature roll",
            description="Another signature roll",
            price="19.99",
            allergens="fish",
        )
        latest_order = Order.objects.create(
            customer=user,
            order_type=Order.OrderType.DELIVERY,
            status=Order.Status.DELIVERED,
            guest_name="Latest Delivered",
            guest_email=user.email,
            guest_phone="8135550006",
            total="19.99",
            subtotal="19.99",
            completed_at=timezone.now() - timedelta(hours=1),
        )
        latest_order.created_at = timezone.now() - timedelta(hours=2)
        latest_order.save(update_fields=["created_at"])
        latest_order.items.create(
            menu_item=latest_item,
            quantity=1,
            unit_price="19.99",
            line_total="19.99",
        )
        self.client.force_authenticate(user)

        response = self.client.get(reverse("review-eligibility"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["order_id"], latest_order.id)
        self.assertEqual(response.data["product_names"], ["Dragon Roll"])

    def test_new_order_expires_previous_review_window(self):
        user = User.objects.create_user(
            email="new-order-review@braziliansushi.com",
            username="neworderreview",
            password="StrongPass123!",
        )
        old_order = Order.objects.create(
            customer=user,
            order_type=Order.OrderType.DELIVERY,
            status=Order.Status.DELIVERED,
            guest_name="Old Order",
            guest_email=user.email,
            guest_phone="8135550004",
            total="25.00",
            subtotal="25.00",
            completed_at=timezone.now() - timedelta(hours=2),
        )
        old_order.items.create(
            menu_item=self.menu_item,
            quantity=1,
            unit_price="18.99",
            line_total="18.99",
        )
        Order.objects.create(
            customer=user,
            order_type=Order.OrderType.DELIVERY,
            status=Order.Status.RECEIVED,
            guest_name="New Order",
            guest_email=user.email,
            guest_phone="8135550004",
            total="25.00",
            subtotal="25.00",
        )
        self.client.force_authenticate(user)

        response = self.client.post(
            reverse("review-list"),
            {
                "order_id": old_order.id,
                "rating": 5,
                "title": "Too late",
                "content": "This review should no longer be allowed.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Review.objects.count(), 0)


class ContactMessageResolvedFieldTests(APITestCase):
    """Regression test: `resolved` used to be writable on the public contact
    form, letting anyone mark their own inquiry pre-resolved and hide it from
    the staff queue."""

    def test_public_submission_ignores_a_client_supplied_resolved_flag(self):
        response = self.client.post(
            reverse("contact-message-list"),
            {
                "name": "Visitor",
                "email": "visitor@example.com",
                "phone": "5551234567",
                "message": "Do you deliver to zip 33602?",
                "resolved": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = ContactMessage.objects.get(pk=response.data["id"])
        self.assertFalse(message.resolved)

    def test_staff_can_still_mark_a_message_resolved(self):
        # Regression test for a bug introduced by the fix above: using one
        # serializer with `resolved` merely marked read-only would silently
        # block staff from ever setting it too, since read_only_fields
        # applies to every action sharing that serializer, not just create.
        staff = User.objects.create_superuser(
            email="contact-staff@braziliansushi.com", username="contactstaff", password="StrongPass123!"
        )
        message = ContactMessage.objects.create(
            name="Visitor", email="visitor2@example.com", phone="5551234567", message="Any gluten-free rolls?"
        )
        self.client.force_authenticate(staff)

        response = self.client.patch(
            reverse("contact-message-detail", args=[message.id]), {"resolved": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        message.refresh_from_db()
        self.assertTrue(message.resolved)
