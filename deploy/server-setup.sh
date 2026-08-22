#!/usr/bin/env bash
# One-time setup on a fresh Ubuntu 22.04 / 24.04 server. Run as root:
#   bash deploy/server-setup.sh erp.yourdomain.com
set -e
DOMAIN=${1:?Usage: bash deploy/server-setup.sh erp.yourdomain.com}
APP=/opt/arudhya-erp

apt update && apt install -y python3-venv python3-pip nginx nodejs npm ufw
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable

mkdir -p $APP && cp -r . $APP && cd $APP
python3 -m venv venv && ./venv/bin/pip install -q -r backend/requirements.txt

# environment file
if [ ! -f .env ]; then
  cp deploy/env.example .env
  KEY=$(python3 -c "import secrets;print(secrets.token_urlsafe(48))")
  sed -i "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$KEY|" .env
  sed -i "s|erp.yourdomain.com|$DOMAIN|g" .env
  echo ">> Edit $APP/.env to add your EMAIL_* settings."
fi

# backend: DB + static
set -a; source .env; set +a
cd backend
../venv/bin/python manage.py migrate
../venv/bin/python manage.py collectstatic --noinput
cd ..

# frontend build
cd frontend && npm ci --no-audit --no-fund && npm run build && cd ..

# permissions, services
chown -R www-data:www-data $APP
cp deploy/gunicorn.service /etc/systemd/system/arudhya-erp.service
systemctl daemon-reload && systemctl enable --now arudhya-erp

sed "s/erp.yourdomain.com/$DOMAIN/" deploy/nginx.conf > /etc/nginx/sites-available/arudhya-erp
ln -sf /etc/nginx/sites-available/arudhya-erp /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "------------------------------------------------------------"
echo " Arudhya ERP is up:  http://$DOMAIN"
echo " Next: 1) HTTPS  ->  apt install -y certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN"
echo "       2) Login admin/admin@123 and tech/tech@123 -> CHANGE BOTH PASSWORDS (Settings)"
echo "------------------------------------------------------------"
