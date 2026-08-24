from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class CustomerAdminTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="staff@braziliansushi.com",
            username="staff",
            password="StrongPass123!",
        )
        self.customer = User.objects.create_user(
            email="guest@braziliansushi.com",
            username="guest",
            password="StrongPass123!",
        )

    def test_admin_can_verify_customer(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(f"/api/accounts/customers/{self.customer.id}/verify/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.is_verified_customer)
        self.assertEqual(self.customer.verified_reason, User.VerificationReason.IDENTITY)


class SignupConfirmationTests(APITestCase):
    @patch("accounts.serializers.send_account_confirmation", return_value=["email"])
    def test_register_creates_inactive_user_and_returns_confirmation_channels(self, mocked_send_confirmation):
        response = self.client.post(
            "/api/accounts/register/",
            {
                "email": "newguest@braziliansushi.com",
                "username": "newguest",
                "first_name": "New",
                "last_name": "Guest",
                "phone_number": "8135550001",
                "notification_preference": "both",
                "sms_opt_in": True,
                "email_opt_in": True,
                "password": "StrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="newguest@braziliansushi.com")
        self.assertFalse(user.is_active)
        self.assertEqual(response.data["confirmation_channels"], ["email"])
        mocked_send_confirmation.assert_called_once()

    def test_confirm_account_activates_user(self):
        user = User.objects.create_user(
            email="pending@braziliansushi.com",
            username="pendinguser",
            password="StrongPass123!",
            is_active=False,
        )

        response = self.client.post(
            "/api/accounts/confirm-account/",
            {"token": str(user.account_confirmation_token)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertIsNotNone(user.account_confirmed_at)


class LoginThrottleTests(APITestCase):
    """Regression test for rate limiting on the login endpoint."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email="throttle-guard@braziliansushi.com",
            username="throttleguard",
            password="StrongPass123!",
        )

    def tearDown(self):
        cache.clear()

    def test_login_is_throttled_after_repeated_attempts(self):
        url = reverse("token_obtain_pair")

        for _ in range(5):
            response = self.client.post(
                url, {"email": self.user.email, "password": "wrong-password"}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        blocked_response = self.client.post(
            url, {"email": self.user.email, "password": "wrong-password"}, format="json"
        )
        self.assertEqual(blocked_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # A correct password is blocked too — throttling protects the
        # endpoint, not just failed attempts.
        valid_login_response = self.client.post(
            url, {"email": self.user.email, "password": "StrongPass123!"}, format="json"
        )
        self.assertEqual(valid_login_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
