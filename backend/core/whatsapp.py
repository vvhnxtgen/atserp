"""WhatsApp delivery — Meta Cloud API, Twilio, or wa.me link fallback.

Reads provider + credentials from settings (which load them from .env).
`send_whatsapp()` returns one of:
  "sent"    – message accepted by the provider
  "link"    – provider is 'link'; caller should offer a one-tap wa.me message
  "skipped" – provider 'none', or no recipient/credentials configured
  "failed"  – provider call raised / returned an error
"""
import json
import re
import urllib.error
import urllib.request

from django.conf import settings as dj


def _digits(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def wa_link(phone: str, text: str) -> str:
    """Build a click-to-chat wa.me URL with a pre-filled message."""
    from urllib.parse import quote
    return f"https://wa.me/{_digits(phone)}?text={quote(text)}"


def _post_json(url, payload, headers, timeout=15):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode()


def _post_form(url, fields, auth, timeout=15):
    from urllib.parse import urlencode
    from base64 import b64encode
    data = urlencode(fields).encode()
    token = b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={"Authorization": f"Basic {token}",
                 "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode()


def send_whatsapp(to_phone: str, text: str) -> str:
    provider = getattr(dj, "WHATSAPP_PROVIDER", "link")
    to = to_phone or getattr(dj, "WHATSAPP_ADMIN_TO", "")

    if provider == "none":
        return "skipped"
    if provider == "link":
        return "link"                       # frontend renders the wa.me action
    if not _digits(to):
        return "skipped"

    try:
        if provider == "cloud":
            token = dj.WHATSAPP_TOKEN
            phone_id = dj.WHATSAPP_PHONE_ID
            if not (token and phone_id):
                return "skipped"
            url = f"https://graph.facebook.com/{dj.WHATSAPP_API_VERSION}/{phone_id}/messages"
            payload = {
                "messaging_product": "whatsapp",
                "to": _digits(to),
                "type": "text",
                "text": {"preview_url": False, "body": text[:4096]},
            }
            headers = {"Authorization": f"Bearer {token}",
                       "Content-Type": "application/json"}
            status, _ = _post_json(url, payload, headers)
            return "sent" if 200 <= status < 300 else "failed"

        if provider == "twilio":
            sid = dj.TWILIO_ACCOUNT_SID
            tok = dj.TWILIO_AUTH_TOKEN
            frm = dj.TWILIO_WHATSAPP_FROM
            if not (sid and tok and frm):
                return "skipped"
            url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
            to_fmt = to if to.startswith("whatsapp:") else f"whatsapp:+{_digits(to)}"
            fields = {"From": frm, "To": to_fmt, "Body": text[:1600]}
            status, _ = _post_form(url, fields, (sid, tok))
            return "sent" if 200 <= status < 300 else "failed"
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError):
        return "failed"

    return "skipped"
