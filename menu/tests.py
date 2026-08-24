from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Category, MenuItem, MenuOption, MenuOptionGroup

User = get_user_model()


class MenuCatalogVisibilityTests(APITestCase):
    """The public menu is what most of the site (and every price
    calculation in checkout) is built on, so availability and filtering
    need their own coverage independent of the orders app."""

    def setUp(self):
        self.category = Category.objects.create(name="Rolls", slug="menu-rolls", sort_order=1)
        self.available_item = MenuItem.objects.create(
            category=self.category,
            name="Spicy Tuna Roll",
            slug="spicy-tuna-roll",
            short_description="Spicy tuna, avocado",
            price=Decimal("15.00"),
            spicy=True,
            featured=True,
        )
        self.sold_out_item = MenuItem.objects.create(
            category=self.category,
            name="Seasonal Special",
            slug="seasonal-special",
            short_description="Limited batch",
            price=Decimal("18.00"),
            availability=MenuItem.Availability.SOLD_OUT,
        )
        self.hidden_item = MenuItem.objects.create(
            category=self.category,
            name="Staff Test Item",
            slug="staff-test-item",
            short_description="Not for customers",
            price=Decimal("1.00"),
            availability=MenuItem.Availability.HIDDEN,
        )

    def test_public_listing_excludes_hidden_items_but_keeps_sold_out(self):
        response = self.client.get(reverse("menu-item-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = {row["name"] for row in response.data["results"]}
        self.assertIn(self.available_item.name, names)
        self.assertIn(self.sold_out_item.name, names)
        self.assertNotIn(self.hidden_item.name, names)

    def test_staff_listing_includes_hidden_items(self):
        admin = User.objects.create_superuser(
            email="menu-admin@braziliansushi.com", username="menuadmin", password="StrongPass123!"
        )
        self.client.force_authenticate(admin)

        response = self.client.get(reverse("menu-item-list"))

        names = {row["name"] for row in response.data["results"]}
        self.assertIn(self.hidden_item.name, names)

    def test_featured_and_spicy_filters(self):
        response = self.client.get(reverse("menu-item-list"), {"featured": "true"})
        names = {row["name"] for row in response.data["results"]}
        self.assertEqual(names, {self.available_item.name})

        response = self.client.get(reverse("menu-item-list"), {"spicy": "true"})
        names = {row["name"] for row in response.data["results"]}
        self.assertEqual(names, {self.available_item.name})

    def test_category_filter_by_slug(self):
        other_category = Category.objects.create(name="Nigiri", slug="menu-nigiri", sort_order=2)
        MenuItem.objects.create(
            category=other_category,
            name="Salmon Nigiri",
            slug="salmon-nigiri-menu",
            short_description="Fresh salmon",
            price=Decimal("9.00"),
        )

        response = self.client.get(reverse("menu-item-list"), {"category": "menu-rolls"})

        names = {row["name"] for row in response.data["results"]}
        self.assertNotIn("Salmon Nigiri", names)

    def test_category_listing_does_not_leak_hidden_items(self):
        """Regression test: the nested `items` on the categories endpoint
        used to bypass the hidden-item filter entirely."""
        response = self.client.get(reverse("category-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        category_row = next(row for row in response.data["results"] if row["slug"] == self.category.slug)
        names = {item["name"] for item in category_row["items"]}
        self.assertIn(self.available_item.name, names)
        self.assertNotIn(self.hidden_item.name, names)

    def test_category_listing_shows_hidden_items_to_staff(self):
        admin = User.objects.create_superuser(
            email="menu-admin-cat@braziliansushi.com", username="menuadmincat", password="StrongPass123!"
        )
        self.client.force_authenticate(admin)

        response = self.client.get(reverse("category-list"))

        category_row = next(row for row in response.data["results"] if row["slug"] == self.category.slug)
        names = {item["name"] for item in category_row["items"]}
        self.assertIn(self.hidden_item.name, names)

    def test_write_methods_require_admin(self):
        response = self.client.post(
            reverse("menu-item-list"),
            {
                "category": self.category.id,
                "name": "Unauthorized Item",
                "slug": "unauthorized-item",
                "short_description": "Should not be created",
                "price": "5.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class MenuOptionPricingTests(APITestCase):
    """Option pricing feeds directly into orders/services.py's
    build_order_items — verifying it here keeps that contract explicit."""

    def setUp(self):
        category = Category.objects.create(name="Combos", slug="menu-combos")
        self.menu_item = MenuItem.objects.create(
            category=category,
            name="Build Your Own Combo",
            slug="build-your-own-combo",
            short_description="Choose your protein",
            price=Decimal("20.00"),
        )
        group = MenuOptionGroup.objects.create(menu_item=self.menu_item, name="Protein", required=True, min_select=1, max_select=1)
        self.extra_salmon = MenuOption.objects.create(group=group, name="Extra Salmon", price_delta=Decimal("3.50"))
        self.no_charge_option = MenuOption.objects.create(group=group, name="Standard Tofu", price_delta=Decimal("0.00"), is_default=True)

    def test_menu_item_serializer_exposes_option_pricing(self):
        response = self.client.get(reverse("menu-item-detail", args=[self.menu_item.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        option_group = response.data["option_groups"][0]
        prices = {option["name"]: option["price_delta"] for option in option_group["options"]}
        self.assertEqual(prices["Extra Salmon"], "3.50")
        self.assertEqual(prices["Standard Tofu"], "0.00")
