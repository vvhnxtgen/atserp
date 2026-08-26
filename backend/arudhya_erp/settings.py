"""Django settings for the Arudhya ERP backend."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env(path):
    """Minimal .env loader (no extra dependency). KEY=VALUE per line, # comments."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        os.environ.setdefault(key, val)


# Load backend/.env then project-root/.env (root wins only for unset keys).
_load_env(BASE_DIR / ".env")
_load_env(BASE_DIR.parent / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-change-me-in-production")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = [host.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", 'localhost,127.0.0.1').split(",") if host.strip()]
# Render provides the external hostname automatically — always trust it.
_render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if _render_host and _render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_render_host)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "arudhya_erp.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR.parent / "frontend" / "dist"],   # built React index.html
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

WSGI_APPLICATION = "arudhya_erp.wsgi.application"

# ---- Database -------------------------------------------------------------
# Uses DATABASE_URL when present (PostgreSQL on Render/managed hosts), else a
# local SQLite file for development. dj-database-url handles every URL form:
#   postgres://…  postgresql://…  with URL-encoded passwords and query params.
import dj_database_url

_DB_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:AdpZhruezLcxLOtMMoXBCYiCxQEFCpAE@postgres.railway.internal:5432/railway").strip()
if _DB_URL:
    # Managed Postgres (e.g. Render) requires SSL. conn_health_checks keeps
    # long-lived connections healthy; conn_max_age reuses them across requests.
    _ssl_require = os.environ.get("DB_SSL", "1") == "1"
    DATABASES = {
        "default": dj_database_url.parse(
            _DB_URL,
            conn_max_age=600,
            conn_health_checks=True,
            ssl_require=_ssl_require,
        )
    }
else:
    # Local / no-DB fallback. NOTE: on Render the disk is ephemeral, so SQLite
    # data is wiped on every deploy/restart — always set DATABASE_URL there.
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "core.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 6}},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}

# CORS — not needed in the default single-service setup (frontend + API share
# one origin). Only relevant if you host the React app on a SEPARATE domain:
# set FRONTEND_ORIGINS="https://app.example.com,https://www.example.com".
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
] + [o.strip() for o in os.environ.get("FRONTEND_ORIGINS", "").split(",") if o.strip()]
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"          # `manage.py collectstatic` target (admin assets)
# Also serve the built React assets (frontend/dist) directly via WhiteNoise so
# /assets/*.js and /assets/*.css resolve on the same origin as the API.
_FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
WHITENOISE_ROOT = str(_FRONTEND_DIST) if _FRONTEND_DIST.exists() else None
WHITENOISE_INDEX_FILE = True
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("DJANGO_MEDIA_ROOT", BASE_DIR / "media"))

# ---- Production hardening (active when DJANGO_DEBUG=0) --------------------
CSRF_TRUSTED_ORIGINS = [o for o in os.environ.get("DJANGO_CSRF_TRUSTED", "").split(",") if o]
# Trust the Render external host for CSRF (needed for the Django admin login).
if _render_host:
    CSRF_TRUSTED_ORIGINS.append(f"https://{_render_host}")
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---- Email notifications (Gmail SMTP) ------------------------------------
# Default: console backend (emails print in the runserver terminal).
# Set EMAIL_HOST_USER + EMAIL_HOST_PASSWORD in .env for real Gmail delivery.
# Gmail requires an App Password (myaccount.google.com/apppasswords), not your
# normal password, and 2-Step Verification must be ON.
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "1") == "1"
EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "0") == "1"
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "15"))
if EMAIL_HOST_USER and EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "erp@arudhya.local")

# ---- WhatsApp notifications ----------------------------------------------
# WHATSAPP_PROVIDER: "none" | "link" | "cloud" | "twilio"
#   none   – no WhatsApp at all
#   link   – no credentials; the app offers a one-tap wa.me message (default)
#   cloud  – Meta WhatsApp Cloud API (real automatic delivery)
#   twilio – Twilio WhatsApp API (real automatic delivery)
WHATSAPP_PROVIDER = os.environ.get("WHATSAPP_PROVIDER", "link").strip().lower()
# Meta WhatsApp Cloud API
WHATSAPP_TOKEN = os.environ.get("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_ID = os.environ.get("WHATSAPP_PHONE_ID", "")
WHATSAPP_API_VERSION = os.environ.get("WHATSAPP_API_VERSION", "v21.0")
# Twilio WhatsApp
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.environ.get("TWILIO_WHATSAPP_FROM", "")  # e.g. whatsapp:+14155238886
# Recipient fallback if LabSettings.admin_whatsapp is blank (E.164, e.g. +9198...)
WHATSAPP_ADMIN_TO = os.environ.get("WHATSAPP_ADMIN_TO", "")

FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
