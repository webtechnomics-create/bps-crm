#!/usr/bin/env bash
# Daily database backup, keeps 30 days.
# crontab -e  ->  30 2 * * * /var/www/bps-crm/deploy/backup.sh
set -euo pipefail
DIR=/var/backups/bps-crm
mkdir -p "$DIR"
pg_dump -U crm -h localhost bps_crm | gzip > "$DIR/bps_crm_$(date +%F).sql.gz"
find "$DIR" -name '*.sql.gz' -mtime +30 -delete
