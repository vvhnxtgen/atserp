#!/usr/bin/env bash
set -o errexit

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Installing frontend dependencies..."
cd frontend
npm ci

echo "Building React frontend..."
npm run build

echo "Frontend build completed."
cd ..

echo "Running Django migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput