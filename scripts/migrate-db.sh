#!/usr/bin/env bash
# Move the production database off Render (expired free tier) onto Neon,
# proving row-for-row that nothing was lost on the way.
#
# Run it from Git Bash with the PostgreSQL 17 client tools on PATH:
#
#   export SRC='postgres://...render.com/banker_lapp'   # Render EXTERNAL url
#   export DST='postgres://...neon.tech/neondb?sslmode=require'
#   ./scripts/migrate-db.sh dump      # 1. rescue the data (do this first)
#   ./scripts/migrate-db.sh restore   # 2. load it into Neon
#   ./scripts/migrate-db.sh verify    # 3. compare row counts, table by table
#
# Dumps land OUTSIDE the repo ($HOME/banker-lapp-db-backup by default): they
# contain member emails and live refresh tokens and must never be committed.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/banker-lapp-db-backup}"
STAMP="${STAMP:-$(date +%Y%m%d)}"
ARCHIVE="$BACKUP_DIR/banker_lapp_$STAMP.dump"   # -Fc, what we restore from
PLAIN="$BACKUP_DIR/banker_lapp_$STAMP.sql"      # readable copy, for eyeballing
SRC_COUNTS="$BACKUP_DIR/counts_src_$STAMP.txt"
DST_COUNTS="$BACKUP_DIR/counts_dst_$STAMP.txt"

# Exact per-table counts (not pg_stat estimates — those lag and would hide a
# short restore). query_to_xml runs the count inside the catalog scan.
COUNT_SQL="
SELECT table_name || ' ' ||
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
                           false, true, '')))[1]::text::bigint
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;"

need() { [ -n "${!1:-}" ] || { echo "error: \$$1 is not set" >&2; exit 1; }; }

do_dump() {
  need SRC
  mkdir -p "$BACKUP_DIR"
  echo "==> dumping from source"
  pg_dump "$SRC" --no-owner --no-acl -Fc -f "$ARCHIVE"
  pg_dump "$SRC" --no-owner --no-acl -f "$PLAIN"
  psql "$SRC" -At -c "$COUNT_SQL" > "$SRC_COUNTS"
  echo "==> source row counts"
  cat "$SRC_COUNTS"
  ls -lh "$ARCHIVE" "$PLAIN"
  echo "==> keep $BACKUP_DIR until the app is confirmed working on the new database"
}

do_restore() {
  need DST
  [ -f "$ARCHIVE" ] || { echo "error: $ARCHIVE not found — run 'dump' first" >&2; exit 1; }
  echo "==> target must be empty; current tables:"
  psql "$DST" -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
  echo "==> restoring"
  # --no-owner/--no-acl: the Render role (banker_lapp) does not exist on Neon,
  # and GRANTs referencing it would fail. Ownership falls to the Neon role.
  pg_restore --no-owner --no-acl --exit-on-error -d "$DST" "$ARCHIVE"
  echo "==> restore finished"
}

do_verify() {
  need DST
  psql "$DST" -At -c "$COUNT_SQL" > "$DST_COUNTS"
  echo "==> target row counts"
  cat "$DST_COUNTS"
  if [ -f "$SRC_COUNTS" ]; then
    if diff -u "$SRC_COUNTS" "$DST_COUNTS"; then
      echo "==> OK: every table matches the source row for row"
    else
      echo "==> MISMATCH: do not delete the Render database" >&2
      exit 1
    fi
  else
    echo "==> no source counts on file ($SRC_COUNTS); compare by hand" >&2
  fi
  echo "==> sequences (a wrong value would collide on the next insert):"
  psql "$DST" -c "SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public' ORDER BY 1"
  echo "==> migrations recorded (the backend skips these on boot):"
  psql "$DST" -c "SELECT version FROM schema_migrations ORDER BY version"
}

case "${1:-}" in
  dump)    do_dump ;;
  restore) do_restore ;;
  verify)  do_verify ;;
  all)     do_dump; do_restore; do_verify ;;
  *) sed -n '2,14p' "$0"; exit 1 ;;
esac
