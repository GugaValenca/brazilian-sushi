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
