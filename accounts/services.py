import logging
from base64 import b64encode
from urllib import error, parse, request

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)


def build_confirmation_url(user):
    token = str(user.account_confirmation_token)
    base_url = settings.ACCOUNT_CONFIRMATION_URL.rstrip("/")
    return f"{base_url}?token={token}"


def can_send_email_confirmation():
    return settings.DEBUG or settings.EMAIL_BACKEND != "django.core.mail.backends.console.EmailBackend"


def available_confirmation_channels(user):
    channels = []
    if user.email and can_send_email_confirmation():
        channels.append("email")
    if (
        user.phone_number
        and user.notification_preference in {user.NotificationPreference.SMS, user.NotificationPreference.BOTH}
        and settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_FROM_NUMBER
    ):
        channels.append("sms")
    return channels


def send_confirmation_email(user, confirmation_url):
    subject = "Confirm your Brazilian Sushi account"
    context = {
        "first_name": user.first_name or user.username,
        "confirmation_url": confirmation_url,
        "year": timezone.now().year,
    }
    # A plain-text alternative isn't just a fallback for text-only clients --
    # it's also what many spam filters expect to see alongside an HTML body,
    # and what screen readers and preview panes show first.
    text_body = render_to_string("accounts/emails/account_confirmation.txt", context)
    html_body = render_to_string("accounts/emails/account_confirmation.html", context)

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)


def send_confirmation_sms(user, confirmation_url):
    payload = parse.urlencode(
        {
            "To": user.phone_number,
            "From": settings.TWILIO_FROM_NUMBER,
            "Body": f"Brazilian Sushi account confirmation: {confirmation_url}",
        }
    ).encode("utf-8")
    credentials = f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}".encode("utf-8")
    headers = {
        "Authorization": f"Basic {b64encode(credentials).decode('utf-8')}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    twilio_request = request.Request(
        url=f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
        data=payload,
        headers=headers,
        method="POST",
    )
    with request.urlopen(twilio_request, timeout=10) as response:
        if response.status >= 400:
            raise RuntimeError("SMS confirmation request failed")


def send_account_confirmation(user):
    confirmation_url = build_confirmation_url(user)
    available_channels = available_confirmation_channels(user)
    if not available_channels:
        return []

    delivered_channels = []

    if "email" in available_channels:
        try:
            send_confirmation_email(user, confirmation_url)
            delivered_channels.append("email")
        except Exception:  # pragma: no cover - defensive logging path
            logger.exception("Failed to send confirmation email for user %s", user.pk)

    if "sms" in available_channels:
        try:
            send_confirmation_sms(user, confirmation_url)
            delivered_channels.append("sms")
        except (RuntimeError, error.URLError, error.HTTPError, ValueError):
            logger.exception("Failed to send confirmation SMS for user %s", user.pk)

    user.account_confirmation_sent_at = timezone.now()
    user.save(update_fields=["account_confirmation_sent_at"])
    return delivered_channels
