# Content Center V2 — recovery preflight (13 October 2026)

## Confirmed

- A real iPhone Safari user confirmed that the **duplicate warning appears** in the mock-only preview after the preview was fixed to automatically opt in to V2 on the bare `/review/` URL (demo commit `86a5b7902561fa6d86c6cfb1dde93c3afe33d527`).
- Chromium/WebKit browser checks use fake data and enforce no outgoing production connections. Automated tests now cover cancel **and** deliberate approval of a same-client/title/format/channel duplicate.
- Five synthetic, purely in-memory Node checks validate export/import JSON roundtrip, missing data rejection, foreign client references, SHA-256 checksum mismatch and duplicate IDs. These are tests of the safety-check approach, **not** evidence that a real database backup can be restored.
- Git production `main` remains frozen; rollback branch `backup/main-before-v2-20261013` references the pre-V2 version.

## Mandatory gate for a REAL backup and restore

1. Obtain explicit approval and check Supabase branch or staging-project costs before provisioning resources. Never create a paid resource without approval.
2. Obtain a private, encrypted **complete** database backup using Supabase's supported backup/export workflow, including schema, SQL functions, policies, triggers and rows. Do not commit dumps, JWTs, owner codes or other secrets to GitHub.
3. Separately inventory Auth identities, Storage buckets/objects and external integrations; a `content_backups` table snapshot is not a full physical database backup.
4. Restore into a **different, isolated database**, with no production credentials, webhooks, social publishing or live endpoints. Prevent accidental external notifications and duplicate posts.
5. Verify record counts by table, relationships, Auth and RLS behavior, brand rules, media links and on-device drafts (where relevant); confirm a safe rollback path and record a human-readable test report.
6. Perform a separate owner-authenticated iPhone Safari smoke test and an installed PWA cache/session/draft test before any production release. Preserve the old version until all checks pass.

## Explicitly NOT done

- No production SQL executed or data exported.
- No staging database provisioned; therefore no actual physical restore tested.
- No release or schema migration applied; no verified ChatGPT ↔ app server-side synchronization.

**Release decision: BLOCKED** until genuine isolated Supabase restoration, authenticated device checks and explicit cutover approval are completed.
