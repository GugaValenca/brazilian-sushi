from django.core.cache import cache
from django.http import HttpResponse
from rest_framework.throttling import AnonRateThrottle


class AdminLoginThrottleMiddleware:
    """Rate-limits POST attempts to the Django admin login page, by client.

    The customer-facing JWT login (accounts/serializers.py) is throttled at
    the DRF layer via the "auth" scope (5/min) -- but Django's own built-in
    admin login view is a plain Django view, not a DRF one, so none of that
    throttling ever applied to it. That left the single most sensitive
    login in the app (grants access to customer PII, order/pricing control,
    and the ability to grant other accounts staff status) with no
    brute-force protection at all, confirmed by sending it 15 rapid
    wrong-password attempts locally and getting a normal 200 back every
    time.

    Uses the same 5-per-60s budget as the "auth" scope, and the same
    client-identification DRF's throttles already use (X-Forwarded-For aware
    via AnonRateThrottle.get_ident), so behavior matches everywhere.
    Successful logins reset the count; failed ones consume it.
    """

    LOGIN_PATH = "/admin/login/"
    MAX_ATTEMPTS = 5
    WINDOW_SECONDS = 60

    def __init__(self, get_response):
        self.get_response = get_response
        self._throttle = AnonRateThrottle()

    def _cache_key(self, request):
        return f"admin-login-throttle:{self._throttle.get_ident(request)}"

    def __call__(self, request):
        is_login_attempt = request.method == "POST" and request.path == self.LOGIN_PATH

        if is_login_attempt:
            cache_key = self._cache_key(request)
            if cache.get(cache_key, 0) >= self.MAX_ATTEMPTS:
                return HttpResponse(
                    "Too many login attempts. Please wait a minute and try again.",
                    status=429,
                    content_type="text/plain",
                )

        response = self.get_response(request)

        if is_login_attempt:
            cache_key = self._cache_key(request)
            if response.status_code == 302:
                # Django's admin login redirects (to `next`, or /admin/) only
                # on success -- a failed attempt re-renders the form with a 200.
                cache.delete(cache_key)
            else:
                cache.set(cache_key, cache.get(cache_key, 0) + 1, self.WINDOW_SECONDS)

        return response


class SecurityHeadersMiddleware:
    """Adds headers Django's SecurityMiddleware does not set by default
    (CSP, Referrer-Policy, Permissions-Policy). Django-served responses only
    — the built SPA is served directly by Vercel's static routing and gets
    the equivalent headers from vercel.json instead."""

    CSP = "; ".join(
        [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https://api.stripe.com",
            "frame-src https://checkout.stripe.com",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ]
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("Content-Security-Policy", self.CSP)
        response.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)")
        response.setdefault("X-Content-Type-Options", "nosniff")
        return response


class AdminNoCacheMiddleware:
    """Prevent stale HTML/CSS from being reused on Django admin pages."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if request.path.startswith("/admin"):
            response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"

        return response
