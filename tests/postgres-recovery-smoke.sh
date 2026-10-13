#!/usr/bin/env bash
# Genuine pg_dump/pg_restore on disposable PostgreSQL 17 service, SYNTHETIC DATA ONLY.
set -euo pipefail
export PGPASSWORD=ci-fictional-password-only
host="${PGHOST:-127.0.0.1}"
user=postgres
base="$(cd "$(dirname "$0")" && pwd)"
source=cc_recovery_source
destination=cc_recovery_destination
run_psql(){ psql -h "$host" -U "$user" -v ON_ERROR_STOP=1 "$@"; }
run_psql -d postgres -c 'CREATE ROLE cc_fixture_reader NOLOGIN;'
createdb -h "$host" -U "$user" "$source"
createdb -h "$host" -U "$user" "$destination"
run_psql -d "$source" -f "$base/fixtures/cc-postgres-recovery-schema.sql"
run_psql -d "$source" -f "$base/fixtures/cc-postgres-recovery-data.sql"
dump="${RUNNER_TEMP:-/tmp}/cc-fixture-recovery.dump"
pg_dump -h "$host" -U "$user" -F c --no-owner --no-privileges -f "$dump" "$source"
test -s "$dump"
sha256sum "$dump" > "$dump.sha256"
sha256sum -c "$dump.sha256"
pg_restore -h "$host" -U "$user" --no-owner --no-privileges --exit-on-error -d "$destination" "$dump"
for relation in clients content_items work_items; do
  a="$(run_psql -d "$source" -tAc "SELECT count(*) FROM cc_fixture.$relation;")"
  b="$(run_psql -d "$destination" -tAc "SELECT count(*) FROM cc_fixture.$relation;")"
  test "$a" = "$b" || { echo "FAIL row-count for $relation"; exit 1; }
  echo "Restored $relation rows=$b"
done
policy_count="$(run_psql -d "$destination" -tAc "SELECT count(*) FROM pg_policies WHERE schemaname='cc_fixture';")"
test "$policy_count" = 3 || { echo "FAIL RLS policy recovery"; exit 1; }
index_count="$(run_psql -d "$destination" -tAc "SELECT count(*) FROM pg_indexes WHERE schemaname='cc_fixture' AND indexname='cc_content_client_idx';")"
test "$index_count" = 1 || { echo "FAIL index recovery"; exit 1; }
run_psql -d "$destination" -c 'GRANT USAGE ON SCHEMA cc_fixture TO cc_fixture_reader; GRANT SELECT ON ALL TABLES IN SCHEMA cc_fixture TO cc_fixture_reader;'
count_for() {
  local client="$1"
  run_psql -d "$destination" -tA -c "SET ROLE cc_fixture_reader; SET cc.client_id='$client'; SELECT count(*) FROM cc_fixture.content_items;" | tail -n 1
}
first="$(count_for 11111111-1111-4111-8111-111111111111)"
second="$(count_for 22222222-2222-4222-8222-222222222222)"
test "$first" = 2 || { echo "FAIL client A row isolation"; exit 1; }
test "$second" = 1 || { echo "FAIL client B row isolation"; exit 1; }
# Never accept records for unknown clients.
if run_psql -d "$destination" -c "INSERT INTO cc_fixture.work_items VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','ffffffff-ffff-4fff-8fff-ffffffffffff','Invalid orphan');" > /dev/null 2>&1; then
  echo "FAIL orphan foreign key"; exit 1
fi
echo 'PASS: PostgreSQL 17 real pg_dump/pg_restore roundtrip, checksums, 3 tables, FK, index, 3 RLS policies and cross-client isolation (100% synthetic).'
