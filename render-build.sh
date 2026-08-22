#!/usr/bin/env bash
# Render build command for the single-service full-stack app.
# Installs backend deps, BUILDS the React frontend, collects static, migrates.
# Fails loudly if the frontend build is missing (the usual "root shows JSON" bug).
set -o errexit
set -o pipefail

echo "==================================================================="
echo " Arudhya ERP — Render build"
echo "==================================================================="

echo "== [1/4] Python dependencies =="
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "== [2/4] Build React frontend =="
node --version || { echo "ERROR: Node not found. Set NODE_VERSION=20 in Render env."; exit 1; }
cd frontend
npm ci
npm run build
cd ..

# Verify the build actually produced the SPA entry point.
if [ ! -f frontend/dist/index.html ]; then
  echo "ERROR: frontend/dist/index.html was not created — the React build failed."
  echo "The site would show only the API JSON. Aborting deploy."
  exit 1
fi
echo "   ✓ frontend/dist/index.html present"
ls -la frontend/dist/assets | head -5

echo "== [3/4] Collect static (admin assets) =="
cd backend
python manage.py collectstatic --noinput

echo "== [4/4] Database migrations =="
if [ -z "$DATABASE_URL" ]; then
  echo "   WARNING: DATABASE_URL is not set — using ephemeral SQLite."
  echo "   Add a PostgreSQL database on Render and set DATABASE_URL so data persists."
fi
python manage.py migrate --noinput
cd ..

echo "==================================================================="
echo " Build complete — Django will serve the React app at /, API at /api/"
echo "==================================================================="
