#!/usr/bin/env bash
# Nightly backup of database + uploaded files. Add to cron:
#   0 2 * * * bash /opt/arudhya-erp/deploy/backup.sh
set -e
APP=/opt/arudhya-erp
DEST=$APP/backups
mkdir -p $DEST
STAMP=$(date +%F)
sqlite3 $APP/backend/db.sqlite3 ".backup '$DEST/db-$STAMP.sqlite3'"
tar czf $DEST/media-$STAMP.tar.gz -C $APP/backend media
find $DEST -mtime +30 -delete          # keep 30 days
