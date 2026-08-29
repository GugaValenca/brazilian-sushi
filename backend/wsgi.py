"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os
import sys
import traceback

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")


def build_error_app():
    """Fallback WSGI app used only if Django fails to even start up (e.g. a
    misconfigured environment) — keeps the process importable instead of
    crashing the whole function, while never putting the traceback in the
    HTTP response itself, where any visitor could read it. It goes to
    stderr instead, which is where Vercel's function logs pick it up."""

    def error_app(environ, start_response):
        body = b"Service temporarily unavailable."
        start_response(
            "500 Internal Server Error",
            [
                ("Content-Type", "text/plain; charset=utf-8"),
                ("Content-Length", str(len(body))),
            ],
        )
        return [body]

    return error_app


try:
    application = get_wsgi_application()
except Exception:
    print(traceback.format_exc(), file=sys.stderr)
    application = build_error_app()
