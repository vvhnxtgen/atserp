"""Send a test email + WhatsApp to the admin, to verify .env credentials.

Usage:
    python manage.py test_notify
    python manage.py test_notify --to +919812345678
"""
from django.core.management.base import BaseCommand
from django.conf import settings as dj

from core.models import LabSettings
from core.whatsapp import send_whatsapp, wa_link
from core.utils import send_email, _compose


class Command(BaseCommand):
    help = "Send a test admin notification (email + WhatsApp) using current .env settings."

    def add_arguments(self, parser):
        parser.add_argument("--to", help="Override the WhatsApp recipient (E.164, e.g. +9198...)")

    def handle(self, *args, **opts):
        s = LabSettings.get()
        s, text = _compose("Notification test", ["This is a test message from Arudhya ERP.",
                                                 "If you received this, notifications are working."], "ERP")
        self.stdout.write(self.style.NOTICE("Configuration:"))
        self.stdout.write(f"  Email backend   : {dj.EMAIL_BACKEND.split('.')[-1]}")
        self.stdout.write(f"  Email from/to   : {dj.DEFAULT_FROM_EMAIL}  ->  {s.admin_email or '(admin_email not set)'}")
        self.stdout.write(f"  WhatsApp provider: {dj.WHATSAPP_PROVIDER}")
        wa_to = opts.get("to") or s.admin_whatsapp or dj.WHATSAPP_ADMIN_TO
        self.stdout.write(f"  WhatsApp to      : {wa_to or '(not set)'}")
        self.stdout.write("")

        # Email
        es = send_email("Notification test", text, s)
        style = {"sent": self.style.SUCCESS, "failed": self.style.ERROR}.get(es, self.style.WARNING)
        self.stdout.write("Email    : " + style(es))

        # WhatsApp
        ws = send_whatsapp(wa_to, text)
        style = {"sent": self.style.SUCCESS, "failed": self.style.ERROR}.get(ws, self.style.WARNING)
        self.stdout.write("WhatsApp : " + style(ws))
        if ws == "link" and wa_to:
            self.stdout.write("  (provider=link) open this to send manually:")
            self.stdout.write("  " + wa_link(wa_to, text))
        elif ws == "skipped":
            self.stdout.write(self.style.WARNING("  Skipped — check WHATSAPP_PROVIDER and credentials in .env"))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Done."))
