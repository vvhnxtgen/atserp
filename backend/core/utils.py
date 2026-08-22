"""Shared helpers: activity log + admin notifications (email + WhatsApp)."""
from django.conf import settings as dj
from django.core.mail import send_mail

from .models import Activity, LabSettings
from .whatsapp import send_whatsapp, wa_link


def log(user_name: str, text: str):
    Activity.objects.create(user=user_name or "System", text=text[:300])


def _compose(title: str, lines, actor: str):
    s = LabSettings.get()
    body = "\n".join([l for l in lines if l])
    text = f"[{s.name} ERP]\n{title}\n{body}"
    if actor:
        text += f"\nBy: {actor}"
    return s, text


def send_email(title: str, text: str, s) -> str:
    """Returns 'sent' | 'skipped' | 'failed'."""
    if not (s.email_notifications and s.admin_email):
        return "skipped"
    try:
        send_mail(subject=f"[{s.name} ERP] {title}", message=text,
                  from_email=dj.DEFAULT_FROM_EMAIL, recipient_list=[s.admin_email],
                  fail_silently=False)
        return "sent"
    except Exception:
        return "failed"


def notify_admin(title: str, lines, actor: str = ""):
    """Notify the admin of a workflow event via email and WhatsApp.

    Returns a dict: {"email": <status>, "whatsapp": <status>, "wa_link": <url|"">}.
    Backwards compatible: the dict stringifies and compares like the old status
    where callers stored it as `email`; the frontend reads .email / .whatsapp / .wa_link.
    """
    s, text = _compose(title, lines, actor)

    email_status = send_email(title, text, s)

    wa_status = send_whatsapp(s.admin_whatsapp, text)
    link = ""
    if wa_status == "link" and s.admin_whatsapp:
        link = wa_link(s.admin_whatsapp, text)      # frontend one-tap fallback

    return {"email": email_status, "whatsapp": wa_status, "wa_link": link}
