# Content Center — full backup and isolated recovery plan
**Date:** 2026-10-13. **Status:** PREPARED; REAL DUMP AND RESTORE HAVE NOT RUN.

## Read-only inventory of the live project
- Single organization: `businessmarketolog-web's Org`; project `content-center-gpt`, PostgreSQL 17, Supabase Free, ACTIVE_HEALTHY.
- Exactly **34 tables in public**; all have RLS switched on, although that does **not** prove the policies are correct. There are 36 recorded application migrations, 11 Edge Functions, and 1 Storage bucket with 0 database-listed objects (these are metadata estimates, not data export).
- Installed extensions include **pg_cron** and **pg_net**. The system also contains active notification/owner/publishing functions. Accidentally cloning active jobs can send duplicate messages or make external calls.
- Database backups provided automatically by Supabase are not available on Free. Entries in `content_backups` represent application snapshots and do not cover the full PostgreSQL database.
- The connected Supabase backup inventory explicitly returned **zero available backups** (`backups: []`) and **PITR disabled**; no restorable physical backup currently exists in the dashboard for this Free project.
- Read-only additional scope: 27 tables in `auth`, 2 in `private`, 3 in `control`, plus 8 Supabase-managed `storage` tables. A credible full restore must audit all applicable schemas and Auth, not just the 34 `public` tables.
- Supabase project-creation cost quoted by the connector: **$0/month** for the current organization. Branch cost: **$0.01344/hour** and ordinary branches do **not** automatically copy production row data. Before creating anything the owner must explicitly confirm the cost and destination.
- A dedicated **Free** staging project was subsequently created in the SAME organization/region for recovery testing: `content-center-v2-recovery-staging-20261013`, project ref **`ozmajlqkjvgfsjmrcimg`**, ACTIVE_HEALTHY. Read-only verification showed **0 public tables** there immediately after creation. This is a separate project, not a clone, and it contains **none** of the production client data. Creation cost confirmed by Supabase: $0/month (Free).
- Production is **`kywxggukoqalzhuykhmx`** and must never be a restore target. Source had 34 public tables on the same verification pass. Never transpose the two project references.
- The remote PC “Den” is now reachable, but PostgreSQL command-line tools, Supabase CLI, Docker and WSL distributions were **not installed** at inspection. No authorized password or real SQL dump was fetched. Do not invent a database password or copy it to GitHub. Obtain DB credentials privately on that device before conducting an actual export, then install/verify compatible official tools with the owner's permission.

## 1. Create the real backup privately (once authorized)
Use the Supabase-supported three-part *logical backup* from https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore :
- `roles.sql`: `supabase db dump --db-url <PRIVATE_DATABASE_CONNECTION> -f roles.sql --role-only`
- `schema.sql`: `supabase db dump --db-url <PRIVATE_DATABASE_CONNECTION> -f schema.sql`
- `data.sql`: `supabase db dump --db-url <PRIVATE_DATABASE_CONNECTION> -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"`

The connection and password are **secrets**. They must come from the authorized Supabase Dashboard or secured local credential store, and must never appear in chat, public scripts, GitHub logs or commits. The export must be created in a private, access-controlled folder on an authorized computer. Run only after reviewing CLI flags and current documentation. A Supabase logical export may include sensitive Auth data, hashed credentials, private integration settings or application secrets.

Verify file integrity OFFLINE before packaging:

```bash
python tools/cc_backup_guard.py create --directory PRIVATE_BACKUP_DIR --project-ref kywxggukoqalzhuykhmx
python tools/cc_backup_guard.py verify --directory PRIVATE_BACKUP_DIR --project-ref kywxggukoqalzhuykhmx
```

The verifier requires all three files, rejects empty/symlinked files, records SHA-256 checksums and sizes, refuses to overwrite an existing manifest and rejects corrupted or wrong-project exports. It NEVER connects to Supabase. Checksums **are not** proof of successful restoration. Archive and encrypt the dump before leaving the private machine; never upload plaintext SQL dumps or passwords to a public repo.

## 2. Restore to an isolated destination, NEVER the production DB
1. Prepare an independent disposable local Supabase/PostgreSQL environment with network egress disabled for cron, webhooks, pg_net and social notifications. Alternatively create a separate free staging Supabase project only after explicit owner cost confirmation. A remote project must be isolated from integrations BEFORE restoring any live records.
2. Manually confirm that destination project ref, database host and project name all differ from production. The following restores may be destructive **only to the staging target**, so require explicit destination confirmation. Never use `kywxggukoqalzhuykhmx` as a restoration target.
3. Follow the official Supabase logical restore instructions for the destination: restore role declarations, schema, and data, adjusting compatibility and ownership as specified in the version-specific guide. Do not perform a binary `Restore to a new project` clone while pg_cron / pg_net jobs may execute; Supabase documents they can start as soon as cloning completes.
4. Leave all Edge Functions, webhooks, notification dispatchers, publishing queues, integrations and external APIs disabled for the entire test. Storage **object bytes** require a separate backup; database backups include only storage metadata.
5. Compare restored table schema/counts/constraints against a fresh read-only source inventory; include all 34 public tables, Auth, application-specific private schemas, policies, role grants, indexes, triggers, migration history and storage metadata. Test cross-client isolation, owner login on a staging-only account and rejection of unauthorized access.
6. Produce a sealed report showing export timestamp, manifest hash, source/target refs, per-table row-count deltas, RLS and API checks, missing objects, and either PASS or BLOCKED. Destroy/reset staging only after verifying the source remains intact; preserve the sealed encrypted backup and report for rollback.

## 3. Known additional security gates
- Security advisor returned two **WARN** items for `SECURITY DEFINER` RPC functions `owner_create_client` and `owner_update_client`. These may be intentional for the owner workflow, but permissions and explicit ownership checks must be audited before release. **Do not blindly revoke these RPCs** (they are used by the product).
- Another **WARN**: leaked-password protection disabled in Supabase Auth. Account configuration should be reviewed without changing owner credentials during release testing.
- Thirteen **INFO** items were RLS-enabled/no-policy tables; some are intentionally private. Avoid adding broad access just to silence a lint warning. Review intended access per table.

References:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/clone-project
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## Release gate
The work is **NOT READY TO MERGE** into production until a real full logical dump and separate successful restoration are demonstrated, plus owner-authenticated iPhone checks and PWA cache/draft tests. Existing production `main` and backup branches remain untouched.
