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

    def test_can_filter_customer_list_by_staff_status(self):
        """Backs the Staff admin page, which only lists staff accounts."""
        self.client.force_authenticate(self.admin)

        response = self.client.get("/api/accounts/customers/", {"is_staff": "true"})

        ids = {row["id"] for row in response.data["results"]}
        self.assertIn(self.admin.id, ids)
        self.assertNotIn(self.customer.id, ids)


class CustomerAdminPrivilegeEscalationTests(APITestCase):
    """Regression coverage for a real privilege-escalation gap: IsAdminUser
    only requires is_staff, so without an extra guard any staff member could
    grant themselves (or anyone else) is_staff/is_superuser through a plain
    PATCH on this viewset."""

    def setUp(self):
        self.superuser = User.objects.create_superuser(
            email="super@braziliansushi.com", username="super", password="StrongPass123!"
        )
        self.staff = User.objects.create_user(
            email="plain-staff@braziliansushi.com", username="plainstaff", password="StrongPass123!", is_staff=True
        )
        self.other_staff = User.objects.create_user(
            email="other-staff@braziliansushi.com", username="otherstaff", password="StrongPass123!", is_staff=True
        )

    def test_plain_staff_cannot_grant_themselves_superuser(self):
        self.client.force_authenticate(self.staff)

        response = self.client.patch(f"/api/accounts/customers/{self.staff.id}/", {"is_superuser": True}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.staff.refresh_from_db()
        self.assertFalse(self.staff.is_superuser)

    def test_plain_staff_cannot_revoke_another_staff_members_access(self):
        self.client.force_authenticate(self.staff)

        response = self.client.patch(
            f"/api/accounts/customers/{self.other_staff.id}/", {"is_staff": False}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.other_staff.refresh_from_db()
        self.assertTrue(self.other_staff.is_staff)

    def test_plain_staff_can_still_update_unrelated_fields(self):
        self.client.force_authenticate(self.staff)

        response = self.client.patch(
            f"/api/accounts/customers/{self.other_staff.id}/", {"first_name": "Updated"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.other_staff.refresh_from_db()
        self.assertEqual(self.other_staff.first_name, "Updated")

    def test_superuser_can_grant_staff_access(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.patch(
            f"/api/accounts/customers/{self.other_staff.id}/", {"is_superuser": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.other_staff.refresh_from_db()
        self.assertTrue(self.other_staff.is_superuser)

    def test_plain_staff_cannot_set_a_password(self):
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            f"/api/accounts/customers/{self.other_staff.id}/set_password/", {"password": "BrandNewPass123!"}
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_can_set_a_password(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.post(
            f"/api/accounts/customers/{self.other_staff.id}/set_password/", {"password": "BrandNewPass123!"}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.other_staff.refresh_from_db()
        self.assertTrue(self.other_staff.check_password("BrandNewPass123!"))

    def test_weak_password_is_rejected(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.post(
            f"/api/accounts/customers/{self.other_staff.id}/set_password/", {"password": "password"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


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


class LoginEnumerationTests(APITestCase):
    """Regression tests for a fixed user-enumeration leak: the login
    endpoint used to reveal that an email belonged to a registered-but-
    unconfirmed account whenever *any* password was submitted for it,
    without the password actually needing to be correct."""

    def setUp(self):
        cache.clear()
        self.pending_user = User.objects.create_user(
            email="pending-confirmation@braziliansushi.com",
            username="pendingconfirmation",
            password="StrongPass123!",
            is_active=False,
        )

    def tearDown(self):
        cache.clear()

    def test_wrong_password_for_unconfirmed_account_gives_generic_error(self):
        response = self.client.post(
            reverse("token_obtain_pair"),
            {"email": self.pending_user.email, "password": "totally-wrong-password"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("pending confirmation", str(response.data).lower())

    def test_correct_password_for_unconfirmed_account_still_explains_why(self):
        response = self.client.post(
            reverse("token_obtain_pair"),
            {"email": self.pending_user.email, "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("pending confirmation", str(response.data).lower())


class RegistrationPasswordStrengthTests(APITestCase):
    """Regression tests: AUTH_PASSWORD_VALIDATORS (backend/settings.py) was
    configured but never actually invoked by registration -- confirmed by
    registering real accounts with "password", "12345678", and "qwertyui"
    over real HTTP and getting a 201 back for all three."""

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def _payload(self, password, email=None, username=None):
        return {
            "email": email or "weak-password-test@braziliansushi.com",
            "username": username or "weakpasswordtest",
            "first_name": "Weak",
            "last_name": "Password",
            "phone_number": "8135551234",
            "notification_preference": "email",
            "sms_opt_in": False,
            "email_opt_in": True,
            "password": password,
        }

    def test_common_password_is_rejected(self):
        response = self.client.post(reverse("register"), self._payload("password"), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_all_numeric_password_is_rejected(self):
        response = self.client.post(reverse("register"), self._payload("12345678"), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_password_matching_the_users_own_email_is_rejected(self):
        response = self.client.post(
            reverse("register"),
            self._payload("carlossilva", email="carlossilva@braziliansushi.com", username="carlossilva"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_a_genuinely_strong_password_is_still_accepted(self):
        response = self.client.post(reverse("register"), self._payload("Tr0ub4dor&Zebra!91"), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
