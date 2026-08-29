from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Address
from marketing.models import Coupon
from menu.models import Category, MenuItem, MenuOption, MenuOptionGroup
from orders.models import Order, OrderStatusEvent
from orders.services import clone_order_for_reorder

User = get_user_model()


class OrderStatusWorkflowTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="admin@braziliansushi.com",
            username="admin",
            password="StrongPass123!",
        )
        self.customer = User.objects.create_user(
            email="customer@braziliansushi.com",
            username="customer",
            password="StrongPass123!",
        )
        category = Category.objects.create(name="Rolls", slug="rolls")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="Salmon Roll",
            slug="salmon-roll",
            short_description="Fresh salmon roll",
            price=Decimal("18.00"),
        )
        self.client.force_authenticate(self.admin)

    def test_customer_becomes_verified_after_five_successful_orders(self):
        update_url_name = "order-update-status"

        for index in range(5):
            order = Order.objects.create(
                customer=self.customer,
                order_type=Order.OrderType.DELIVERY,
                subtotal=Decimal("18.00"),
                total=Decimal("18.00"),
            )
            order.items.create(
                menu_item=self.menu_item,
                quantity=1,
                unit_price=Decimal("18.00"),
                line_total=Decimal("18.00"),
            )

            response = self.client.post(
                reverse(update_url_name, args=[order.id]),
                {"status": Order.Status.DELIVERED, "note": f"Delivered order {index + 1}"},
                format="json",
            )

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            order.refresh_from_db()
            self.assertEqual(order.status, Order.Status.DELIVERED)
            self.assertTrue(OrderStatusEvent.objects.filter(order=order, status=Order.Status.DELIVERED).exists())

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.loyalty_completed_orders, 5)
        self.assertTrue(self.customer.is_verified_customer)
        self.assertEqual(self.customer.verified_reason, User.VerificationReason.ORDER_HISTORY)


class GuestOrderSecurityTests(APITestCase):
    def setUp(self):
        category = Category.objects.create(name="Nigiri", slug="nigiri")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="Salmon Nigiri",
            slug="salmon-nigiri",
            short_description="Fresh salmon",
            price=Decimal("12.00"),
        )
        self.order = Order.objects.create(
            order_type=Order.OrderType.PICKUP,
            guest_name="Guest Customer",
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

    def test_guest_cannot_list_all_orders(self):
        response = self.client.get(reverse("order-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_guest_can_track_order_with_valid_token(self):
        response = self.client.get(
            reverse("order-track"),
            {"order_id": self.order.id, "token": str(self.order.tracking_token)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.order.id)
        self.assertEqual(response.data["tracking_token"], str(self.order.tracking_token))


class AuthenticatedCheckoutTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email="member@braziliansushi.com",
            username="member",
            password="StrongPass123!",
            first_name="Gustavo",
            last_name="Valenca",
            phone_number="8135550101",
            notification_preference=User.NotificationPreference.EMAIL,
        )
        category = Category.objects.create(name="Combos", slug="combos")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="Date Night Combo",
            slug="date-night-combo-checkout",
            short_description="Shareable combo",
            price=Decimal("36.00"),
        )
        self.client.force_authenticate(self.customer)

    def test_authenticated_checkout_uses_profile_contact_details(self):
        response = self.client.post(
            reverse("order-list"),
            {
                "order_type": Order.OrderType.PICKUP,
                "notes": "Please include extra napkins.",
                "allergy_notes": "Shellfish allergy.",
                "items": [
                    {
                        "menu_item_id": self.menu_item.id,
                        "quantity": 1,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.customer, self.customer)
        self.assertEqual(order.guest_name, "Gustavo Valenca")
        self.assertEqual(order.guest_email, self.customer.email)
        self.assertEqual(order.guest_phone, self.customer.phone_number)
        self.assertEqual(order.notification_preference, User.NotificationPreference.EMAIL)
        self.assertTrue(response.data["has_kitchen_notes"])
        self.assertTrue(response.data["has_allergy_alert"])


class OrderTamperingTests(APITestCase):
    """Regression tests for the mass-assignment fix: a customer must never be
    able to rewrite their own order's price, status, or tracking token
    directly through the generic detail endpoint."""

    def setUp(self):
        self.customer = User.objects.create_user(
            email="tamper@braziliansushi.com",
            username="tamperguard",
            password="StrongPass123!",
        )
        category = Category.objects.create(name="Nigiri", slug="tamper-nigiri")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="Tuna Nigiri",
            slug="tuna-nigiri-tamper",
            short_description="Fresh tuna",
            price=Decimal("14.00"),
        )
        self.order = Order.objects.create(
            customer=self.customer,
            order_type=Order.OrderType.PICKUP,
            subtotal=Decimal("14.00"),
            total=Decimal("14.00"),
        )
        self.order.items.create(
            menu_item=self.menu_item,
            quantity=1,
            unit_price=Decimal("14.00"),
            line_total=Decimal("14.00"),
        )
        self.client.force_authenticate(self.customer)

    def test_owner_cannot_patch_total_or_status(self):
        url = reverse("order-detail", args=[self.order.id])
        response = self.client.patch(
            url,
            {"total": "0.01", "status": Order.Status.DELIVERED, "discount_amount": "13.99"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.order.refresh_from_db()
        self.assertEqual(self.order.total, Decimal("14.00"))
        self.assertEqual(self.order.status, Order.Status.RECEIVED)

    def test_owner_cannot_put_order(self):
        url = reverse("order-detail", args=[self.order.id])
        response = self.client.put(url, {"total": "0.01"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_owner_cannot_delete_order(self):
        url = reverse("order-detail", args=[self.order.id])
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Order.objects.filter(pk=self.order.pk).exists())

    def test_staff_still_updates_status_through_dedicated_action(self):
        admin = User.objects.create_superuser(
            email="tamper-admin@braziliansushi.com",
            username="tamperadmin",
            password="StrongPass123!",
        )
        self.client.force_authenticate(admin)
        url = reverse("order-update-status", args=[self.order.id])

        response = self.client.post(url, {"status": Order.Status.CONFIRMED}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.CONFIRMED)


class CheckoutValidationTests(APITestCase):
    def test_checkout_rejects_unknown_menu_item_with_400_not_500(self):
        response = self.client.post(
            reverse("order-list"),
            {
                "order_type": Order.OrderType.PICKUP,
                "guest_name": "Guest",
                "guest_email": "guest-invalid@braziliansushi.com",
                "guest_phone": "5551234567",
                "notification_preference": "email",
                "items": [{"menu_item_id": 999999, "quantity": 1}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checkout_rejects_sold_out_item(self):
        category = Category.objects.create(name="Combos", slug="tamper-combos")
        menu_item = MenuItem.objects.create(
            category=category,
            name="Sold Out Combo",
            slug="sold-out-combo",
            short_description="Unavailable",
            price=Decimal("20.00"),
            availability=MenuItem.Availability.SOLD_OUT,
        )

        response = self.client.post(
            reverse("order-list"),
            {
                "order_type": Order.OrderType.PICKUP,
                "guest_name": "Guest",
                "guest_email": "guest-soldout@braziliansushi.com",
                "guest_phone": "5551234567",
                "notification_preference": "email",
                "items": [{"menu_item_id": menu_item.id, "quantity": 1}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class DeliveryAddressOwnershipTests(APITestCase):
    """Regression tests for a fixed IDOR: an order's delivery_address field
    used to accept any Address primary key in the database, letting one
    customer attach another customer's saved home address to their own
    order."""

    def setUp(self):
        category = Category.objects.create(name="Rolls", slug="address-ownership-rolls")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="California Roll",
            slug="california-roll-address-test",
            short_description="Classic roll",
            price=Decimal("14.00"),
        )
        self.owner = User.objects.create_user(
            email="address-owner@braziliansushi.com",
            username="addressowner",
            password="StrongPass123!",
        )
        self.attacker = User.objects.create_user(
            email="address-attacker@braziliansushi.com",
            username="addressattacker",
            password="StrongPass123!",
        )
        self.owners_address = Address.objects.create(
            user=self.owner,
            label="Home",
            recipient_name="Address Owner",
            phone_number="8135550001",
            line_1="123 Private Ave",
            city="Tampa",
            state="FL",
            postal_code="33602",
        )

    def _order_payload(self, delivery_address_id):
        return {
            "order_type": Order.OrderType.DELIVERY,
            "delivery_address": delivery_address_id,
            "items": [{"menu_item_id": self.menu_item.id, "quantity": 1}],
        }

    def test_authenticated_customer_cannot_attach_another_customers_address(self):
        self.client.force_authenticate(self.attacker)

        response = self.client.post(
            reverse("order-list"), self._order_payload(self.owners_address.id), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("delivery_address", response.data)

    def test_authenticated_customer_can_attach_their_own_address(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            reverse("order-list"), self._order_payload(self.owners_address.id), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.delivery_address, self.owners_address)

    def test_guest_cannot_attach_any_saved_address(self):
        response = self.client.post(
            reverse("order-list"),
            {
                **self._order_payload(self.owners_address.id),
                "guest_name": "Guest",
                "guest_email": "guest-address-test@braziliansushi.com",
                "guest_phone": "5551234567",
                "notification_preference": "email",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("delivery_address", response.data)


class CouponApplicationTests(APITestCase):
    """A coupon attached to an order used to be accepted with no validation
    at all and never actually applied — discount_amount stayed 0 regardless.
    These cover the coupon actually being checked and its discount applied,
    or the order being rejected outright when the coupon doesn't qualify."""

    def setUp(self):
        category = Category.objects.create(name="Combos", slug="coupon-combos")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="Family Combo",
            slug="family-combo-coupon-test",
            short_description="Shareable combo",
            price=Decimal("40.00"),
        )
        self.now = timezone.now()

    def _order_payload(self, coupon_id):
        return {
            "order_type": Order.OrderType.PICKUP,
            "coupon": coupon_id,
            "guest_name": "Guest",
            "guest_email": "guest-coupon-test@braziliansushi.com",
            "guest_phone": "5551234567",
            "notification_preference": "email",
            "items": [{"menu_item_id": self.menu_item.id, "quantity": 1}],
        }

    def test_active_percentage_coupon_discounts_the_order(self):
        coupon = Coupon.objects.create(
            code="SAVE20",
            description="20% off",
            discount_type=Coupon.DiscountType.PERCENTAGE,
            value=Decimal("20.00"),
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=1),
        )

        response = self.client.post(reverse("order-list"), self._order_payload(coupon.id), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.discount_amount, Decimal("8.00"))
        self.assertEqual(order.total, Decimal("32.00"))

    def test_expired_coupon_rejects_the_order(self):
        coupon = Coupon.objects.create(
            code="EXPIRED10",
            description="Expired",
            discount_type=Coupon.DiscountType.FIXED,
            value=Decimal("10.00"),
            starts_at=self.now - timedelta(days=30),
            ends_at=self.now - timedelta(days=1),
        )

        response = self.client.post(reverse("order-list"), self._order_payload(coupon.id), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("coupon", response.data)
        self.assertEqual(Order.objects.count(), 0)

    def test_coupon_below_minimum_order_rejects_the_order(self):
        coupon = Coupon.objects.create(
            code="BIGORDER",
            description="Requires a bigger order",
            discount_type=Coupon.DiscountType.FIXED,
            value=Decimal("5.00"),
            minimum_order=Decimal("100.00"),
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=1),
        )

        response = self.client.post(reverse("order-list"), self._order_payload(coupon.id), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("coupon", response.data)

    def test_verified_only_coupon_rejects_a_guest_order(self):
        coupon = Coupon.objects.create(
            code="VIPONLY",
            description="Verified customers only",
            discount_type=Coupon.DiscountType.FIXED,
            value=Decimal("5.00"),
            verified_only=True,
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=1),
        )

        response = self.client.post(reverse("order-list"), self._order_payload(coupon.id), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("coupon", response.data)

    def test_fixed_discount_never_exceeds_the_subtotal(self):
        coupon = Coupon.objects.create(
            code="HUGEFIXED",
            description="Discount bigger than the order itself",
            discount_type=Coupon.DiscountType.FIXED,
            value=Decimal("1000.00"),
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=1),
        )

        response = self.client.post(reverse("order-list"), self._order_payload(coupon.id), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.discount_amount, Decimal("40.00"))
        self.assertEqual(order.total, Decimal("0.00"))

    def test_rejected_coupon_leaves_no_orphaned_order_or_items(self):
        coupon = Coupon.objects.create(
            code="EXPIRED-ORPHAN-CHECK",
            description="Expired",
            discount_type=Coupon.DiscountType.FIXED,
            value=Decimal("10.00"),
            starts_at=self.now - timedelta(days=30),
            ends_at=self.now - timedelta(days=1),
        )

        self.client.post(reverse("order-list"), self._order_payload(coupon.id), format="json")

        self.assertEqual(Order.objects.count(), 0)


class OrderItemLimitTests(APITestCase):
    """Regression tests: an absurd quantity used to reach the database as an
    unhandled error instead of a clean validation response, and the number
    of line items per order was unbounded."""

    def setUp(self):
        category = Category.objects.create(name="Rolls", slug="limit-test-rolls")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="Spicy Tuna Roll",
            slug="spicy-tuna-roll-limit-test",
            short_description="Classic roll",
            price=Decimal("13.00"),
        )

    def _payload(self, items):
        return {
            "order_type": Order.OrderType.PICKUP,
            "guest_name": "Guest",
            "guest_email": "guest-limits@braziliansushi.com",
            "guest_phone": "5551234567",
            "notification_preference": "email",
            "items": items,
        }

    def test_absurd_quantity_is_rejected_cleanly(self):
        response = self.client.post(
            reverse("order-list"),
            self._payload([{"menu_item_id": self.menu_item.id, "quantity": 999999999}]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_too_many_line_items_is_rejected_cleanly(self):
        items = [{"menu_item_id": self.menu_item.id, "quantity": 1} for _ in range(51)]

        response = self.client.post(reverse("order-list"), self._payload(items), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_reasonable_quantity_still_works(self):
        response = self.client.post(
            reverse("order-list"),
            self._payload([{"menu_item_id": self.menu_item.id, "quantity": 12}]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class OptionGroupSelectionTests(APITestCase):
    """A required (or min/max-bounded) option group used to be entirely
    unenforced when placing an order — the client could omit a required
    choice, or select more options than a group's max_select allowed."""

    def setUp(self):
        category = Category.objects.create(name="Combos", slug="option-group-combos")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="Build Your Own Bowl",
            slug="build-your-own-bowl",
            short_description="Choose your protein",
            price=Decimal("15.00"),
        )
        self.protein_group = MenuOptionGroup.objects.create(
            menu_item=self.menu_item,
            name="Protein",
            required=True,
            min_select=1,
            max_select=1,
        )
        self.salmon = MenuOption.objects.create(group=self.protein_group, name="Salmon", price_delta=Decimal("0.00"))
        self.tuna = MenuOption.objects.create(group=self.protein_group, name="Tuna", price_delta=Decimal("1.50"))

    def _payload(self, option_ids):
        item = {"menu_item_id": self.menu_item.id, "quantity": 1}
        if option_ids is not None:
            item["option_ids"] = option_ids
        return {
            "order_type": Order.OrderType.PICKUP,
            "guest_name": "Guest",
            "guest_email": "guest-options@braziliansushi.com",
            "guest_phone": "5551234567",
            "notification_preference": "email",
            "items": [item],
        }

    def test_omitting_a_required_group_rejects_the_order(self):
        response = self.client.post(reverse("order-list"), self._payload(None), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_exceeding_max_select_rejects_the_order(self):
        response = self.client.post(
            reverse("order-list"), self._payload([self.salmon.id, self.tuna.id]), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_a_valid_single_selection_is_accepted_and_priced(self):
        response = self.client.post(reverse("order-list"), self._payload([self.tuna.id]), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.subtotal, Decimal("16.50"))


class ReorderRepricingTests(APITestCase):
    """Reordering used to copy the original order's frozen unit_price/line_total
    directly, and never re-checked whether the item was still available —
    unlike every other order-creation path, which always prices from the
    current MenuItem record."""

    def setUp(self):
        self.category = Category.objects.create(name="Combos", slug="reorder-combos")
        self.menu_item = MenuItem.objects.create(
            category=self.category,
            name="Weekend Combo",
            slug="weekend-combo-reorder-test",
            short_description="Shareable combo",
            price=Decimal("20.00"),
        )
        self.customer = User.objects.create_user(
            email="reorder-customer@braziliansushi.com",
            username="reordercustomer",
            password="StrongPass123!",
        )
        self.original_order = Order.objects.create(
            customer=self.customer,
            order_type=Order.OrderType.PICKUP,
            subtotal=Decimal("20.00"),
            total=Decimal("20.00"),
        )
        self.original_order.items.create(
            menu_item=self.menu_item,
            quantity=1,
            unit_price=Decimal("20.00"),
            line_total=Decimal("20.00"),
        )

    def test_reorder_uses_todays_price_not_the_original_price(self):
        self.menu_item.price = Decimal("25.00")
        self.menu_item.save(update_fields=["price"])

        new_order = clone_order_for_reorder(self.original_order, self.customer)

        self.assertEqual(new_order.items.get().unit_price, Decimal("25.00"))
        self.assertEqual(new_order.total, Decimal("25.00"))

    def test_reorder_rejects_an_item_that_is_now_sold_out(self):
        self.menu_item.availability = MenuItem.Availability.SOLD_OUT
        self.menu_item.save(update_fields=["availability"])

        with self.assertRaises(Exception):
            clone_order_for_reorder(self.original_order, self.customer)

        # Nothing left behind despite the failed reorder.
        self.assertEqual(Order.objects.exclude(pk=self.original_order.pk).count(), 0)
