import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase, TestCase
from django.urls import reverse


class StaticAssetServingTests(TestCase):
    def test_a_real_static_asset_is_served(self):
        # DRF's own browsable-API assets -- always present regardless of
        # which apps are installed, unlike admin-specific static files.
        response = self.client.get(reverse("static-asset", args=["rest_framework/css/bootstrap.min.css"]))

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/css", response["Content-Type"])


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

    def test_boot_fails_with_a_short_secret_key_in_production(self):
        result = self._run_check(
            {
                "DJANGO_DEBUG": "false",
                "DJANGO_SECRET_KEY": "short-but-not-the-default",
                "DJANGO_ALLOWED_HOSTS": "example.com",
            }
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
