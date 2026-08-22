> **Deploying on Render?** See `RENDER_DEPLOY.md` — one service serves the React app **and** the API, with PostgreSQL. `render.yaml` provisions everything.

> **Notifications:** copy `.env.example` to `.env` and fill in Gmail + WhatsApp credentials. Test with `python manage.py test_notify`.

> **Going live?** See `DEPLOYMENT.md` for the full server setup (Nginx + Gunicorn + HTTPS + backups).

# Arudhya Test Solutions — Laboratory ERP (Django + React + Bootstrap)

Full-stack ERP for an NABL-accredited environmental testing laboratory.

| Layer    | Stack |
|----------|-------|
| Backend  | Django 5 + Django REST Framework (token auth, SQLite, media uploads, email notifications) |
| Frontend | React 18 (Vite) + Bootstrap 5 / react-bootstrap, Arudhya navy-gold theme |
| PDFs     | Generated in the browser (letterheaded TRF, Quotation, Tax Invoice, Internal PO → print / Save as PDF) |

**Modules:** TRF workflow (register → chamber allocation → test operation → result → report upload, with a
fixed TRF number throughout). The operation stage is one-click for technicians: **Start Test** auto-records the
start time + technician name, **Capture Image** stores starting/ending photos (JPG/JPEG/PNG), and
**Complete Test** auto-records the end time, status and completed-by. Witnesses (name/designation/organization)
can be added per TRF and print on both the official **Test Request Form** (format ATS/QF/7.1/A/TRF, REV 00
AUG'24) and the printable **Test Witness Form**. Also: Quality documents + full traceability matrix (sample,
technician, method, instrument + calibration status, batch, witnesses, images) · **Equipment List** ·
**Calibration Certificates** (permanent uploads) · **Upload Reports** register with search ·
**Dispatch Information** (auto-numbered, Pending/Dispatched/Delivered) · **Delivery Challan** (auto-numbered,
printable) · Quotations · Customer POs · Indent
approvals · TRF-linked GST invoices · Internal POs · Monthly/FY finance dashboard · Settings (lab profile,
masters, numbering, notifications, passwords).

**Roles:** `admin` (everything) · `tech` (Test, Quality, Equipment, Calibration, Reports, Dispatch, Challan, Indents). Permissions are enforced server-side.

---

## 1 · Run the backend (Django API on :8000)

Prerequisite: Python 3.10+

**Windows**
```bat
cd backend
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**macOS / Linux**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

`migrate` also creates the default logins and lab settings automatically:

| Login | Username | Password |
|-------|----------|----------|
| Administrator | `admin` | `admin@123` |
| Technician | `tech` | `tech@123` |

Change both under **Settings → Users & security** after first login.
The Django admin is available at `http://127.0.0.1:8000/admin/` (admin login works there too).

## 2 · Run the frontend (React on :5173)

Prerequisite: Node 18+

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — the dev server proxies `/api` and `/media` to Django, so no extra config is needed.
Tip: in **Settings → Data → Load sample data** you can populate demo TRFs, an invoice, quality docs, etc.

## 3 · Email + WhatsApp notifications

Every workflow event (TRF registered, chamber allocated, test started/completed, result, report, indent,
customer PO, invoice) notifies the admin:

- **WhatsApp** — each notification toast has a one-tap *WhatsApp admin* button (`wa.me` link with the message
  pre-filled). Set the admin number in **Settings → Notifications**.
- **Email** — sent by Django. Without SMTP configuration, emails print in the backend terminal (console
  backend). For real delivery, set these environment variables before `runserver`:

| Variable | Example |
|----------|---------|
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_HOST_USER` | `lab@yourdomain.com` |
| `EMAIL_HOST_PASSWORD` | app password |
| `EMAIL_USE_TLS` | `1` |
| `DEFAULT_FROM_EMAIL` | `erp@yourdomain.com` |

Also set the **Admin email** in Settings → Notifications.

## 4 · Project structure

```
backend/
  arudhya_erp/        Django project (settings, urls)
  core/               models · serializers · views · permissions · seed · migrations
  requirements.txt
frontend/
  src/
    pages/            Login, Dashboard, Test, TrfDetail, Quality, Equipment, Calibration, Reports,
                      Dispatch, Challan, Business, Accounts, Indents, Settings
    components/       Layout, ItemsEditor, MoneyChart, Indents, shared bits
    lib/              format helpers · printable document templates
    api.js · ctx.jsx · theme.css
```

## 5 · Production notes

- Backend: set `DJANGO_DEBUG=0`, a strong `DJANGO_SECRET_KEY`, and `DJANGO_ALLOWED_HOSTS`; run behind
  gunicorn/Nginx; serve `media/` from the web server; for multi-user scale swap SQLite for PostgreSQL in
  `settings.py` (`DATABASES`).
- Frontend: `npm run build`, host `frontend/dist/` on any static server (or Nginx), and set
  `VITE_API_URL=https://api.yourdomain.com` at build time so the app calls the deployed API.
- Back up `backend/db.sqlite3` and `backend/media/` — that is all the ERP data.


## Customer auto-fill, numbering & printing
- **GST auto-fill:** on the TRF form, type a 15-digit **GSTIN** — if that customer was entered before, their company, contact, phone, email and address auto-fill; otherwise the GST **state** is detected. The customer directory (Settings → data / `/api/customers/`) builds itself as TRFs are registered.
- **Auto-print off by default:** registering a TRF no longer opens a print dialog. Turn it back on in **Settings → Preferences** if you prefer. Print any TRF anytime from its page. Challan has explicit *Generate* vs *Generate & print* buttons.
- **Customized numbering (no fixed prefixes):** in **Settings → Numbering** you compose a single **number format** with placeholders — `{ORG}` (your acronym), `{CODE}` (per-document code like INV/TRF), `{NUM}` (serial, padded 1–6 digits), `{FY}`/`{YYYY}`/`{YY}`, `{MM}`, `{DD}` — plus any literal separators. Each document type has its own editable `{CODE}`. Optional **yearly reset** restarts serials each calendar or financial year. A live preview shows every series as you type. Example: `{ORG}/{CODE}/{FY}/{NUM}` → `ATS/INV/2025-26/001`; or `{CODE}-{YY}{MM}-{NUM}` → `INV-2608-001`.


## In-app camera for test images
In a TRF's **Test Operation** stage, the Starting and Ending test images can now be captured with a live in-app camera (**Open camera** → Capture → review/Retake → Use photo), in addition to choosing a file. The rear camera is used by default with a **Flip camera** option; selfies are auto-un-mirrored; the photo is saved as JPEG.

> **Note:** Browsers only allow live camera access over **HTTPS** (or `localhost`). On a deployed server this works once you've enabled HTTPS (see DEPLOYMENT.md → certbot). Over plain http on a phone the app falls back to **Choose file**, which still opens the phone camera via the OS picker.
