from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import handle_webhook_event


class StripeWebhookView(APIView):
    """Receives Stripe's server-to-server payment confirmation. Not part of
    the public API surface a browser calls directly — authenticated purely
    by the Stripe-Signature header, verified against STRIPE_WEBHOOK_SECRET
    in handle_webhook_event."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        order = handle_webhook_event(request.body, request.META.get("HTTP_STRIPE_SIGNATURE", ""))
        return Response({"received": bool(order)})
