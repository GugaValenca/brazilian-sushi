from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Address

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


class PasswordLengthLimitTests(APITestCase):
    """Regression tests: password fields had no upper bound, so a
    multi-kilobyte "password" would reach Django's PBKDF2 hasher (which
    processes its full input) on every attempt -- a cheap way to burn CPU
    on the most exposed unauthenticated endpoint in the app."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email="password-length@braziliansushi.com", username="passwordlength", password="StrongPass123!"
        )

    def tearDown(self):
        cache.clear()

    def test_oversized_login_password_is_rejected_cleanly(self):
        response = self.client.post(
            reverse("token_obtain_pair"),
            {"email": self.user.email, "password": "x" * 10000},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversized_registration_password_is_rejected_cleanly(self):
        response = self.client.post(
            reverse("register"),
            {
                "email": "new-signup@braziliansushi.com",
                "username": "newsignup",
                "first_name": "New",
                "last_name": "Signup",
                "phone_number": "5551234567",
                "notification_preference": "email",
                "sms_opt_in": False,
                "email_opt_in": True,
                "password": "x" * 10000,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="new-signup@braziliansushi.com").exists())


class LogoutAndTokenRotationTests(APITestCase):
    """Logging out used to only ever discard the refresh token client-side —
    the token itself stayed valid on the server for its full 7-day lifetime.
    These cover the fix: an explicit blacklist on logout, and rotation so a
    refresh token can only ever be used once."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="logout-test@braziliansushi.com", username="logouttest", password="StrongPass123!"
        )

    def _login(self):
        response = self.client.post(
            reverse("token_obtain_pair"), {"email": self.user.email, "password": "StrongPass123!"}, format="json"
        )
        return response.data["access"], response.data["refresh"]

    def test_logout_blacklists_the_refresh_token(self):
        _, refresh = self._login()

        logout_response = self.client.post(reverse("logout"), {"refresh": refresh}, format="json")
        self.assertEqual(logout_response.status_code, status.HTTP_205_RESET_CONTENT)

        reuse_response = self.client.post(reverse("token_refresh"), {"refresh": refresh}, format="json")
        self.assertEqual(reuse_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_does_not_require_a_still_valid_access_token(self):
        """The access token may already be expired by the time someone logs
        out of an idle session -- logout must not depend on it."""
        _, refresh = self._login()
        self.client.credentials()  # no Authorization header at all

        response = self.client.post(reverse("logout"), {"refresh": refresh}, format="json")

        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

    def test_logout_with_an_already_invalid_token_still_succeeds(self):
        response = self.client.post(reverse("logout"), {"refresh": "not-a-real-token"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

    def test_refreshing_rotates_the_refresh_token_and_blacklists_the_old_one(self):
        _, refresh = self._login()

        first_refresh_response = self.client.post(reverse("token_refresh"), {"refresh": refresh}, format="json")
        self.assertEqual(first_refresh_response.status_code, status.HTTP_200_OK)
        new_refresh = first_refresh_response.data["refresh"]
        self.assertNotEqual(new_refresh, refresh)

        # The old refresh token was rotated out -- reusing it must fail now.
        reuse_response = self.client.post(reverse("token_refresh"), {"refresh": refresh}, format="json")
        self.assertEqual(reuse_response.status_code, status.HTTP_401_UNAUTHORIZED)

        # The new one still works.
        second_refresh_response = self.client.post(reverse("token_refresh"), {"refresh": new_refresh}, format="json")
        self.assertEqual(second_refresh_response.status_code, status.HTTP_200_OK)


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


class RegistrationDuplicateDetectionTests(APITestCase):
    """Regression tests: a duplicate email was already rejected (a DB-level
    unique constraint), but with a generic "user with this email already
    exists." message, and a duplicate phone number wasn't checked at all
    (phone_number has no uniqueness constraint of its own)."""

    def setUp(self):
        cache.clear()
        self.existing = User.objects.create_user(
            email="already-registered@braziliansushi.com",
            username="alreadyregistered",
            password="StrongPass123!",
            phone_number="8135559999",
        )

    def tearDown(self):
        cache.clear()

    def _payload(self, **overrides):
        payload = {
            "email": "new-signup@braziliansushi.com",
            "username": "newsignup",
            "first_name": "New",
            "last_name": "Signup",
            "phone_number": "8135550000",
            "notification_preference": "email",
            "sms_opt_in": False,
            "email_opt_in": True,
            "password": "Tr0ub4dor&Zebra!91",
        }
        payload.update(overrides)
        return payload

    def test_duplicate_email_gets_a_clear_already_registered_message(self):
        response = self.client.post(
            reverse("register"), self._payload(email=self.existing.email), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", str(response.data["email"][0]))

    def test_duplicate_phone_number_is_rejected(self):
        response = self.client.post(
            reverse("register"), self._payload(phone_number=self.existing.phone_number), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", str(response.data["phone_number"][0]))

    def test_a_blank_phone_number_never_collides_with_another_blank_one(self):
        User.objects.create_user(email="blank-phone@braziliansushi.com", username="blankphone", password="StrongPass123!")

        response = self.client.post(reverse("register"), self._payload(phone_number=""), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class RegistrationAddressTests(APITestCase):
    """Regression tests: registration never asked for a delivery address at
    all -- a customer had no way to have one on file before their first
    delivery order, when checkout would ask for it anyway."""

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def _payload(self, **overrides):
        payload = {
            "email": "signup-with-address@braziliansushi.com",
            "username": "signupwithaddress",
            "first_name": "Signup",
            "last_name": "WithAddress",
            "phone_number": "8135550001",
            "notification_preference": "email",
            "sms_opt_in": False,
            "email_opt_in": True,
            "password": "Tr0ub4dor&Zebra!91",
        }
        payload.update(overrides)
        return payload

    def test_registration_without_an_address_still_works(self):
        response = self.client.post(reverse("register"), self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email=self._payload()["email"])
        self.assertFalse(user.addresses.exists())

    def test_registration_with_a_complete_address_saves_it_as_the_default(self):
        response = self.client.post(
            reverse("register"),
            self._payload(
                address_line_1="123 Main St",
                address_city="Tampa",
                address_state="FL",
                address_postal_code="33602",
                address_delivery_notes="Gate code 4321",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email=self._payload()["email"])
        address = user.addresses.get()
        self.assertTrue(address.is_default)
        self.assertEqual(address.line_1, "123 Main St")
        self.assertEqual(address.delivery_notes, "Gate code 4321")

    def test_registration_with_a_partial_address_is_rejected(self):
        response = self.client.post(
            reverse("register"), self._payload(address_line_1="123 Main St"), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email=self._payload()["email"]).exists())


class AddressDefaultAssignmentTests(APITestCase):
    """Regression tests: a customer's first saved address was never
    automatically marked as their default -- nothing pointed checkout (or
    the admin) at any particular one until they happened to hit
    make_default themselves."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="address-default@braziliansushi.com", username="addressdefault", password="StrongPass123!"
        )
        self.client.force_authenticate(self.user)

    def _payload(self, **overrides):
        payload = {
            "label": "Home",
            "recipient_name": "Address Default",
            "phone_number": "8135550002",
            "line_1": "1 First St",
            "city": "Tampa",
            "state": "FL",
            "postal_code": "33602",
        }
        payload.update(overrides)
        return payload

    def test_the_first_address_becomes_the_default_automatically(self):
        response = self.client.post(reverse("address-list"), self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["is_default"])

    def test_a_second_address_does_not_become_default_unless_requested(self):
        self.client.post(reverse("address-list"), self._payload(), format="json")

        second = self.client.post(reverse("address-list"), self._payload(line_1="2 Second St"), format="json")

        self.assertFalse(second.data["is_default"])
        self.assertEqual(Address.objects.filter(user=self.user, is_default=True).count(), 1)

    def test_explicitly_requesting_default_on_a_new_address_unsets_the_old_one(self):
        self.client.post(reverse("address-list"), self._payload(), format="json")

        second = self.client.post(
            reverse("address-list"), self._payload(line_1="2 Second St", is_default=True), format="json"
        )

        self.assertTrue(second.data["is_default"])
        self.assertEqual(Address.objects.filter(user=self.user, is_default=True).count(), 1)
