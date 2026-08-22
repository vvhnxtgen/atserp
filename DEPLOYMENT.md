# Deploying Arudhya ERP to a Live Server

Recommended target: **one small Ubuntu VPS** (2 GB RAM is plenty) — DigitalOcean,
Hetzner, AWS Lightsail, or Hostinger VPS (~₹400–700/month). The app needs a
persistent disk because reports, calibration certificates and test images are
stored as files, so a VPS beats free PaaS tiers here.

Architecture on the server:
`Nginx (HTTPS, static frontend, /media files)` → `Gunicorn (systemd)` → `Django + SQLite`.
SQLite is fine for this ERP's two-user internal workload; back it up nightly
(script included). Move to PostgreSQL later only if you add many concurrent users.

## Step 1 — Buy the server & point the domain
1. Create an Ubuntu 24.04 VPS; note its public IP.
2. In your domain DNS (e.g. GoDaddy/Cloudflare), add an **A record**:
   `erp.yourdomain.com → <server IP>`. Wait for it to resolve (`ping erp.yourdomain.com`).

## Step 2 — Upload the project
From Windows PowerShell (in the folder containing this project):
```powershell
scp -r . root@<server-ip>:/root/arudhya-erp-src
```
(or use WinSCP / FileZilla). Then SSH in: `ssh root@<server-ip>`.

## Step 3 — Run the one-shot setup
```bash
cd /root/arudhya-erp-src
bash deploy/server-setup.sh erp.yourdomain.com
```
This installs Python/Node/Nginx, creates a virtualenv, generates a strong
SECRET_KEY into `/opt/arudhya-erp/.env`, migrates the database (seeding the
admin/tech logins and numbering series), builds the React frontend, and starts
the `arudhya-erp` systemd service behind Nginx. The site is now live on **http://**.

## Step 4 — Enable HTTPS (2 minutes)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d erp.yourdomain.com
```
Choose "redirect". Certificates auto-renew.

## Step 5 — Configure email notifications
```bash
nano /opt/arudhya-erp/.env      # fill EMAIL_HOST_USER / EMAIL_HOST_PASSWORD
systemctl restart arudhya-erp
```
For Gmail, create an **App Password** (Google Account → Security → 2-Step
Verification → App passwords) — the normal password will not work.

## Step 6 — First login & lockdown  (IMPORTANT)
1. Open `https://erp.yourdomain.com`, log in as `admin / admin@123`.
2. **Settings → Security: change the admin and technician passwords immediately** —
   the defaults are public knowledge from this README.
3. Settings → Lab profile: confirm name, address, phone, email, GST — these print
   on every TRF, invoice, challan and witness form.
4. Register a test TRF end-to-end (allocate → start test → images → complete →
   result → report) to confirm uploads and email/WhatsApp notifications.

## Step 7 — Nightly backups
```bash
apt install -y sqlite3
crontab -e     # add:
0 2 * * * bash /opt/arudhya-erp/deploy/backup.sh
```
Backups (DB + media, 30-day retention) land in `/opt/arudhya-erp/backups/`.
Periodically copy them off-server (Google Drive / rclone / scp to office PC).

## Updating the app later
When I send you a new zip:
```bash
scp -r . root@<server-ip>:/root/arudhya-erp-src        # from Windows
ssh root@<server-ip>
cd /root/arudhya-erp-src
cp -r backend/core /opt/arudhya-erp/backend/
cp -r frontend/src frontend/public /opt/arudhya-erp/frontend/
cd /opt/arudhya-erp
set -a; source .env; set +a
./venv/bin/python backend/manage.py migrate
./venv/bin/python backend/manage.py collectstatic --noinput
cd frontend && npm run build && cd ..
chown -R www-data:www-data /opt/arudhya-erp
systemctl restart arudhya-erp
```

## Troubleshooting
| Symptom | Check |
|---|---|
| 502 Bad Gateway | `systemctl status arudhya-erp` and `journalctl -u arudhya-erp -n 50` |
| Blank page / old UI | Rebuild frontend (`npm run build`), hard-refresh (Ctrl+F5) |
| Uploads fail > 25 MB | Raise `client_max_body_size` in the nginx site file |
| No emails | `.env` EMAIL_* values; Gmail App Password; `journalctl -u arudhya-erp` |
| Admin CSS missing | Re-run `collectstatic`; confirm whitenoise in requirements installed |

## Alternative: office LAN only (no internet exposure)
On any always-on office PC/mini-PC with Ubuntu, run the same script with the
machine's LAN IP instead of a domain (skip certbot). Staff reach it at
`http://192.168.x.x`. Combine with the nightly backup + an off-machine copy.
