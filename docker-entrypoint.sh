#!/bin/sh
# docker-entrypoint.sh
# Runs once each time the app container starts:
#   1. Wait for the database to accept connections.
#   2. Sync the Prisma schema into it (idempotent — safe on every boot).
#   3. Hand off to the CMD (node server.js).
#
# `prisma db push` creates/updates tables to match schema.prisma without
# migration files — matches how this project has been developed. It does NOT
# drop columns unless --accept-data-loss is passed, so existing data is safe.
set -e

echo "[entrypoint] waiting for database at ${DB_HOST:-db}:${DB_PORT:-3306} ..."
i=0
until node -e "const m=require('mysql2/promise');m.createConnection({host:process.env.DB_HOST,port:+process.env.DB_PORT||3306,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME}).then(c=>c.end()).then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; do
  i=$((i+1))
  if [ "$i" -ge 60 ]; then
    echo "[entrypoint] database not reachable after 60 tries — giving up." >&2
    exit 1
  fi
  sleep 2
done
echo "[entrypoint] database is up."

echo "[entrypoint] syncing schema (prisma db push) ..."
# Note: Prisma 7 removed the --skip-generate flag; the client is already
# generated into the image at build time, so a plain push is correct.
#
# `||` is NOT optional, for the same reason as the permission sync below.
# This runs under `set -e`, so a push that refuses to apply would abort the
# script before `exec "$@"` and the container would never start the app — every
# request 502s. That has already happened once: adding a @unique to a brand-new,
# all-NULL column made push demand --accept-data-loss, and the whole site went
# down over a warning about nothing.
#
# --accept-data-loss is deliberately NOT used. It would let a future schema edit
# silently drop a column and its data; a refused sync is a feature that does not
# work yet, which is recoverable, while deleted rows are not.
#
# So: try to sync, and if it refuses, say so loudly and start anyway. The app
# then runs against the older schema — some new feature may error, but the site
# is up, the logs name the problem, and it can be applied by hand.
npx prisma db push || {
    echo "[entrypoint] ---------------------------------------------------------"
    echo "[entrypoint] SCHEMA SYNC FAILED — starting the app on the OLD schema."
    echo "[entrypoint] Anything relying on the new columns will error until this"
    echo "[entrypoint] is applied by hand. Scroll up for what prisma refused."
    echo "[entrypoint] ---------------------------------------------------------"
}

# Create any permission rows the code enforces but the database is missing.
# The full seed (prisma/seed.ts) can't run here — it needs ts-node, which is a
# dev dependency — and it would also insert demo content, which must never
# happen on a live site. This script only fills in missing permissions.
#
# `|| true` is NOT optional. This file runs under `set -e`, so any failure here
# — a missing file, a module that won't load, a database hiccup — would abort
# the script before `exec "$@"` and the site would never start at all. A
# permission that could not be created is a small, recoverable problem; a site
# that will not boot is not. It must never be able to take the site down.
echo "[entrypoint] syncing permissions ..."
node scripts/sync-permissions.js || echo "[entrypoint] permission sync failed — continuing anyway."

echo "[entrypoint] starting app: $*"
exec "$@"
