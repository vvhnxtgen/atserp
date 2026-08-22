# Deploying Arudhya ERP on Render (single service: API + React app)

Your current live URL returns `{"status":"...API is running"}` at the root.
That means an **older build is deployed** — one where `/` returned the API status
and the **React frontend was never bundled**. This repo already serves BOTH the
API and the React app from one Django service; you just need to redeploy it with
the frontend build step. Follow either path below.

--------------------------------------------------------------------------------
## Fastest fix — redeploy with the correct Build Command
If your Render service already exists (the one at
`arudhya-erp-fullstack.onrender.com`):

1. Push this code to the GitHub repo Render is connected to (see "Push" below).
2. In Render → your Web Service → **Settings**:
   - **Build Command:**
     ```
     ./render-build.sh
     ```
     (This installs Python deps, **builds the React frontend**, runs
     `collectstatic`, and applies migrations. The missing frontend build is the
     whole problem — this command fixes it.)
   - **Start Command:**
     ```
     cd backend && gunicorn arudhya_erp.wsgi --bind 0.0.0.0:$PORT
     ```
   - **Environment** (Settings → Environment):
     | Key | Value |
     |-----|-------|
     | `DJANGO_DEBUG` | `0` |
     | `DJANGO_ALLOWED_HOSTS` | `.onrender.com` |
     | `DJANGO_SECRET_KEY` | click **Generate** |
     | `PYTHON_VERSION` | `3.12.4` |
     | `NODE_VERSION` | `20` |
     | `DATABASE_URL` | *(see Database note below)* |
3. Make `render-build.sh` executable once (already is in this zip, but if git
   dropped the bit): `git update-index --chmod=+x render-build.sh`.
4. **Manual Deploy → Deploy latest commit.**
5. Open the URL — you should now see the **login screen**, not JSON.
   Health check stays at `/api/health/`.

--------------------------------------------------------------------------------
## Clean setup — Blueprint (provisions DB automatically)
If you'd rather start fresh, this repo ships `render.yaml`:

1. Push the code to GitHub.
2. Render → **New → Blueprint** → pick the repo → **Apply**.
   It creates the web service **and a free PostgreSQL database**, wiring
   `DATABASE_URL` automatically, and uses `render-build.sh` as the build.
3. After the first deploy, open the URL → login screen.

--------------------------------------------------------------------------------
## Database note (IMPORTANT on Render)
Render's disk is **ephemeral** — a SQLite file is wiped on every deploy/restart,
so you'd lose all TRFs, customers and settings. Use Postgres:

- **Blueprint path** does this for you.
- **Manual path:** Render → New → **PostgreSQL** (free) → copy its
  **Internal Database URL** → set it as `DATABASE_URL` on the web service.
  The app auto-detects `DATABASE_URL` and uses Postgres; without it, it falls
  back to SQLite (fine only for a quick demo).

`psycopg2-binary` and `dj-database-url` are already in requirements; the app enables SSL automatically and reuses connections. Migrations run in the build. For uploaded files, `render.yaml` also mounts a **persistent disk** at `/var/data/media` so reports/images survive deploys.

--------------------------------------------------------------------------------
## First login & lockdown
After the app loads:
1. Log in `admin / admin@123` (and `tech / tech@123`).
2. **Settings → change both passwords** (defaults are public).
3. **Settings → Notifications:** set admin email + WhatsApp; fill
   `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` (Gmail App Password) in Render
   Environment for real email. WhatsApp works in one-tap `link` mode by default.
4. The in-app **camera** for TRF test images needs HTTPS — Render provides it,
   so the camera works out of the box.

--------------------------------------------------------------------------------
## Push this code to GitHub (from Windows)
```powershell
cd <this-unzipped-folder>
git init
git add .
git commit -m "Arudhya ERP — full app (API + React served together)"
git branch -M main
git remote add origin https://github.com/<you>/arudhya-erp-fullstack.git
git push -u origin main
```
`.gitignore` already excludes `.env`, `node_modules/` and `dist/`. Render builds
`dist/` itself via `render-build.sh`, so it does not need to be committed.


--------------------------------------------------------------------------------
## Self-diagnose your live deployment
Open **`https://<your-app>.onrender.com/api/health/`** — it now reports exactly
what's wrong:

```json
{
  "database": { "engine": "postgresql", "connected": true, "migrated": true },
  "frontend_built": true,
  "hint": "All good — open / for the app."
}
```

Read it like this:
- `"engine": "sqlite3"` → you did **not** set `DATABASE_URL`; add a Postgres DB
  (your data is being wiped on each deploy until you do).
- `"connected": false` → the `DATABASE_URL` is wrong, or SSL is off. The app
  requires SSL by default; use Render's **Internal Database URL** exactly.
- `"migrated": false` → migrations didn't run; the build command isn't
  `./render-build.sh` (which runs migrate), or it failed earlier.
- `"frontend_built": false` → the React build step didn't run → the root URL
  can't show the app. Set Build Command to `./render-build.sh` and redeploy.
  (The build now **fails loudly** if the frontend didn't compile, so a broken
  build won't deploy silently anymore.)

When all three are true and `frontend_built` is true, open `/` for the app.

--------------------------------------------------------------------------------
## How to tell it worked
| Check | Old (broken) | Fixed |
|-------|--------------|-------|
| `GET /` | JSON `API is running` | **React login screen (HTML)** |
| `GET /api/health/` | 404 or same JSON | JSON `API is running` |
| `POST /api/auth/login/` | — | `{ "token": … }` |
| `/assets/*.js` | 404 | 200 (served) |

The root serving HTML instead of JSON is the signal the frontend is now bundled
and connected to the API on the same origin (so there are no CORS issues).
