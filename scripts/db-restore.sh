#!/usr/bin/env bash
#
# db-restore.sh — decrypt an age-encrypted backup and load it into a target Supabase database.
#
# See OWNER-RUNBOOK Part Q for the two restore tiers:
#   • Tier 1 (same project): TARGET_DB_URL points at the live project — UUIDs unchanged, data reappears.
#   • Tier 2 (project recreated): create a NEW project, `supabase db push` (schema + reseed), then run
#     this BEFORE the first sign-in so auth.users/auth.identities load with their original UUIDs and the
#     Google identity re-links to the same user.
#
# ALWAYS dry-run a restore into a throwaway DB first (`supabase start` → local) and compare row counts
# before trusting a backup.
#
# Required env:
#   TARGET_DB_URL        Session-pooler URI of the database to restore INTO (incl. password).
#   AGE_KEY_FILE         Path to your age PRIVATE key file (kept offline; never in any repo).
# Arg:
#   $1                   Path to the .sql.age backup to restore.
#
# Requires on PATH: age, psql.

set -euo pipefail

: "${TARGET_DB_URL:?set TARGET_DB_URL (session-pooler URI of the DB to restore into)}"
: "${AGE_KEY_FILE:?set AGE_KEY_FILE (path to your age private key)}"
backup="${1:?usage: db-restore.sh <backup.sql.age>}"

[ -f "$backup" ] || { echo "No such backup file: $backup" >&2; exit 1; }
[ -f "$AGE_KEY_FILE" ] || { echo "No such age key file: $AGE_KEY_FILE" >&2; exit 1; }

echo "Restoring $backup into the target database…"
echo "(decrypting in-memory and piping straight to psql — no plaintext touches disk)"

# ON_ERROR_STOP so a failed statement aborts loudly instead of leaving a half-restore.
age -d -i "$AGE_KEY_FILE" "$backup" \
  | psql "$TARGET_DB_URL" --set ON_ERROR_STOP=on --single-transaction

echo "Restore complete. Verify row counts, then sign in and confirm your data is visible."
