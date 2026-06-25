#!/usr/bin/env bash
#
# db-backup.sh — encrypted logical backup of the WellWorth Supabase database.
#
# Dumps only the IRREPLACEABLE user data (the schema lives in supabase/migrations/, and the
# reference tables `nutrient` + `medical_lab_test` are reseeded by migrations 02/11), plus the
# `auth.users` / `auth.identities` rows needed to keep each user's UUID + OAuth identity stable across
# a project recreation (see OWNER-RUNBOOK Part Q). The plaintext dump is encrypted to an age public
# key so the machine running this script can ENCRYPT but never DECRYPT — only the offline age private
# key can read it. Used both by .github/workflows/backup.yml and for ad-hoc local backups.
#
# Required env:
#   SUPABASE_DB_URL   Session-mode pooler connection URI incl. password (NOT the IPv6-only direct host,
#                     and NOT the transaction pooler on :6543 — pg_dump needs a session connection).
#                     e.g. postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres
#   AGE_PUBLIC_KEY    age recipient public key (starts `age1…`). Public — safe to expose.
# Optional env:
#   OUT_DIR           Directory for the .age output (default: ./backups).
#
# Requires on PATH: pg_dump (>= the server major version, currently 17), age.

set -euo pipefail

: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL (session-pooler URI incl. password)}"
: "${AGE_PUBLIC_KEY:?set AGE_PUBLIC_KEY (age recipient public key, age1…)}"
OUT_DIR="${OUT_DIR:-backups}"

mkdir -p "$OUT_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
plain="$(mktemp)"
trap 'rm -f "$plain"' EXIT  # never leave plaintext behind, even on error

# Common pg_dump flags: data only (schema comes from git migrations), and strip ownership/ACLs so the
# dump restores cleanly into a fresh project where roles differ.
common=(--data-only --no-owner --no-privileges)

echo "Dumping public user data (excluding git-seeded reference tables)…"
pg_dump "$SUPABASE_DB_URL" "${common[@]}" \
  --schema=public \
  --exclude-table=public.nutrient \
  --exclude-table=public.medical_lab_test \
  >"$plain"

echo "Dumping auth identities (auth.users + auth.identities) for UUID/identity preservation…"
pg_dump "$SUPABASE_DB_URL" "${common[@]}" \
  --table=auth.users \
  --table=auth.identities \
  >>"$plain"

out="$OUT_DIR/wellworth-$stamp.sql.age"
echo "Encrypting to $out…"
age -r "$AGE_PUBLIC_KEY" -o "$out" "$plain"

echo "Backup written: $out ($(wc -c <"$out") bytes encrypted)"
