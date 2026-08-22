#!/usr/bin/env bash
set -e

echo "=== Python dependencies ==="
pip install -r requirements.txt

echo "=== Frontend ==="
cd frontend
npm ci
npm run build

echo "=== Checking frontend ==="
if [ ! -f dist/index.html ]; then
    echo "ERROR: frontend/dist/index.html was not created"
    exit 1
fi

cd ..

echo "=== Django migrations ==="
python manage.py migrate --noinput

echo "=== Static files ==="
python manage.py collectstatic --noinput

echo "=== BUILD SUCCESS ==="