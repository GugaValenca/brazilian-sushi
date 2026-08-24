import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase, TestCase
from django.urls import reverse

from accounts.models import User


class StaticAssetServingTests(TestCase):
    def test_admin_static_asset_is_served(self):
        response = self.client.get(reverse("static-asset", args=["admin/css/base.css"]))

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/css", response["Content-Type"])


class AdminRenderingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            email="admin@example.com",
            username="admin",
            password="StrongPass123!",
        )

    def test_admin_dashboard_renders_for_superuser(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("admin:index"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Operations Dashboard")

    def test_admin_pages_set_no_cache_headers(self):
        login_response = self.client.get(reverse("admin:login"))
        self.assertEqual(login_response.status_code, 200)
        self.assertIn("no-store", login_response["Cache-Control"])

        self.client.force_login(self.user)
        index_response = self.client.get(reverse("admin:index"))
        self.assertEqual(index_response.status_code, 200)
        self.assertIn("no-store", index_response["Cache-Control"])


class ProductionSafetyTests(SimpleTestCase):
    """Regression tests for the fail-fast settings check: the app must
    refuse to boot with DEBUG=False and no real SECRET_KEY/ALLOWED_HOSTS,
    instead of silently running exposed."""

    def _run_check(self, env_overrides, unset=()):
        env = os.environ.copy()
        env.update(env_overrides)
        for key in unset:
            env.pop(key, None)
        result = subprocess.run(
            [sys.executable, "manage.py", "check"],
            cwd=Path(__file__).resolve().parent.parent,
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return result

    def test_boot_fails_with_default_secret_key_in_production(self):
        result = self._run_check(
            {"DJANGO_DEBUG": "false", "DJANGO_ALLOWED_HOSTS": "example.com"},
            unset=["DJANGO_SECRET_KEY"],
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY", result.stderr)

    def test_boot_fails_with_no_allowed_hosts_in_production(self):
        result = self._run_check(
            {
                "DJANGO_DEBUG": "false",
                "DJANGO_SECRET_KEY": "a-real-unique-production-secret-key",
                "DJANGO_ALLOWED_HOSTS": "",
            }
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_ALLOWED_HOSTS", result.stderr)

    def test_boot_succeeds_in_production_with_real_settings(self):
        result = self._run_check(
            {
                "DJANGO_DEBUG": "false",
                "DJANGO_SECRET_KEY": "a-real-unique-production-secret-key",
                "DJANGO_ALLOWED_HOSTS": "example.com",
            }
        )

        self.assertEqual(result.returncode, 0, result.stderr)
