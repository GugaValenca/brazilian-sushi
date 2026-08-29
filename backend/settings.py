import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

INSECURE_DEFAULT_SECRET_KEY = "unsafe-dev-key-change-me"


def env_str(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in env_str(name, default).split(",") if item.strip()]


SECRET_KEY = env_str("DJANGO_SECRET_KEY", INSECURE_DEFAULT_SECRET_KEY)
DEBUG = env_str("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://127.0.0.1:8080,http://localhost:8080")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "http://127.0.0.1:8080,http://localhost:8080")

# Refuse to boot with production-unsafe settings instead of silently running
# exposed. This only ever fires when DEBUG=False, so local development
# (DEBUG=true by default) is unaffected.
if not DEBUG:
    if SECRET_KEY == INSECURE_DEFAULT_SECRET_KEY:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY must be set to a unique, unpredictable value in production "
            "(DEBUG=False). Refusing to start with the insecure default key."
        )
    if not ALLOWED_HOSTS:
        raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set when DEBUG=False.")


def build_database_config():
    database_url = env_str("DATABASE_URL")
    if database_url:
        parsed = urlparse(database_url)
        engine_map = {
            "postgres": "django.db.backends.postgresql",
            "postgresql": "django.db.backends.postgresql",
            "pgsql": "django.db.backends.postgresql",
            "sqlite": "django.db.backends.sqlite3",
        }
        engine = engine_map.get(parsed.scheme)
        if not engine:
            raise ValueError(f"Unsupported database scheme in DATABASE_URL: {parsed.scheme}")

        if engine == "django.db.backends.sqlite3":
            db_name = unquote(parsed.path.lstrip("/")) or str(BASE_DIR / "db.sqlite3")
            return {
                "ENGINE": engine,
                "NAME": db_name,
            }

        return {
            "ENGINE": engine,
            "NAME": unquote(parsed.path.lstrip("/")),
            "USER": unquote(parsed.username or ""),
            "PASSWORD": unquote(parsed.password or ""),
            "HOST": parsed.hostname or "",
            "PORT": str(parsed.port or ""),
            "CONN_MAX_AGE": int(env_str("DB_CONN_MAX_AGE", "60")),
            "OPTIONS": {
                "sslmode": env_str("DB_SSLMODE", "require"),
            },
        }

    return {
        "ENGINE": env_str("DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": env_str("DB_NAME", str(BASE_DIR / "db.sqlite3")),
        "USER": env_str("DB_USER"),
        "PASSWORD": env_str("DB_PASSWORD"),
        "HOST": env_str("DB_HOST"),
        "PORT": env_str("DB_PORT"),
    }


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "drf_spectacular",
    "accounts",
    "menu",
    "orders",
    "marketing",
    "payments",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "backend.middleware.SecurityHeadersMiddleware",
    "backend.middleware.AdminNoCacheMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "api.wsgi.app"

DATABASES = {
    "default": build_database_config()
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = env_str("DJANGO_TIME_ZONE", "America/Chicago")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = env_str("SECURE_SSL_REDIRECT", "true").lower() == "true"
    SECURE_HSTS_SECONDS = int(env_str("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = "DENY"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 12,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Every unauthenticated/authenticated request is rate-limited by default;
    # auth endpoints additionally use the tighter "auth" scope below via
    # ScopedRateThrottle so login/register/resend-confirmation can't be
    # brute-forced or used to spam an inbox/phone.
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        # The storefront's own warmup/navigation flow (menu, categories,
        # promotions, reviews, delivery zones) issues several anonymous GET
        # requests per page — 60/min left too little headroom for someone
        # genuinely browsing multiple pages back to back.
        "anon": "180/min",
        "user": "300/min",
        "auth": "5/min",
        # Order creation is open to guests (no login required), so it needs
        # its own cap independent of the generic anon rate above — otherwise
        # the kitchen queue can be flooded with junk orders far faster than
        # any real customer would ever place them.
        "order_create": "20/min",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Brazilian Sushi API",
    "DESCRIPTION": "Ordering, accounts, menu and marketing API for the Brazilian Sushi platform.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

EMAIL_HOST = env_str("EMAIL_HOST")
EMAIL_PORT = int(env_str("EMAIL_PORT", "587"))
EMAIL_HOST_USER = env_str("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env_str("EMAIL_HOST_PASSWORD")
EMAIL_USE_TLS = env_str("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_USE_SSL = env_str("EMAIL_USE_SSL", "false").lower() == "true"
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = env_str("DEFAULT_FROM_EMAIL", "hello@braziliansushi.com")
PUBLIC_APP_URL = env_str("PUBLIC_APP_URL", "http://127.0.0.1:8080")
ACCOUNT_CONFIRMATION_URL = env_str("ACCOUNT_CONFIRMATION_URL", f"{PUBLIC_APP_URL.rstrip('/')}/confirm-account")
TWILIO_ACCOUNT_SID = env_str("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = env_str("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = env_str("TWILIO_FROM_NUMBER")

# Stripe Checkout (sandbox-friendly): the whole payment step is a no-op when
# these are unset, so local development and any deployment that hasn't
# configured Stripe yet keep working exactly as before — same pattern as the
# Twilio SMS integration above (see payments/services.py).
STRIPE_SECRET_KEY = env_str("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = env_str("STRIPE_PUBLISHABLE_KEY")
STRIPE_WEBHOOK_SECRET = env_str("STRIPE_WEBHOOK_SECRET")
STRIPE_CHECKOUT_SUCCESS_URL = env_str(
    "STRIPE_CHECKOUT_SUCCESS_URL", f"{PUBLIC_APP_URL.rstrip('/')}/track-order"
)
STRIPE_CHECKOUT_CANCEL_URL = env_str(
    "STRIPE_CHECKOUT_CANCEL_URL", f"{PUBLIC_APP_URL.rstrip('/')}/checkout"
)

# Error monitoring (optional): only initializes if a DSN is provided, so the
# app runs identically with or without Sentry configured.
DJANGO_SENTRY_DSN = env_str("DJANGO_SENTRY_DSN")
if DJANGO_SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=DJANGO_SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=float(env_str("DJANGO_SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        send_default_pii=False,
        environment=env_str("DJANGO_SENTRY_ENVIRONMENT", "production" if not DEBUG else "development"),
    )
