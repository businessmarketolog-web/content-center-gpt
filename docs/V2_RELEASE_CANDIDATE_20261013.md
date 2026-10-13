# Content Center V2 — production release candidate
Date: 2026-10-13.
Candidate branch: release/v2-candidate-20261013; descendant of original production main.
Production main SHA: 815cd608c74c560e8056b3397fcdb713e5e52a32.
Rollback branch: backup/main-before-v2-20261013.
Development PR #2 is DRAFT and targets V2 foundation rather than production main.

## Owner-confirmed authenticated Safari checks
- Owner successfully logged into actual Supabase through independent real-auth review.
- Owner created one [V2 QA] client and Reels.
- Read-only SQL counted 1 QA client + 1 linked draft. Clients total 3, materials total 9.
- QA client has one owner member. Draft has no scheduled_at or published_at.
- Verified server RLS: client/material SELECT requires membership; content INSERT/UPDATE owner/editor; UPDATE includes USING and WITH CHECK.
- On Den, anonymous GET requests using only public publishable key returned HTTP 200 but zero accessible rows for clients and content_items.
- Owner create/update SECURITY DEFINER RPCs check auth.uid and appropriate owner membership; warnings remain to be assessed with a second real user.
- Existing production Supabase database was NOT modified by the audit (read-only queries).

## Automated safety tests
- 48 Node tests + 8 Python offline export integrity tests (synthetic).
- Chromium and WebKit desktop/mobile full-flow simulated-owner tests.
- Actual PostgreSQL 17 pg_dump and pg_restore against separate disposable fictional databases, including FK, index, RLS and client isolation.
- In the independent auth-review site: seven client guard tests and mocked-network browser tests in Chromium/WebKit.
- No real social publishing, notification dispatch, or external integration write was tested.

## Before actual production merge
1. Confirm reload in real signed-in Safari preserves both new QA client and saved Reels, and verify a text edit persists across another reload. SQL read-only persistence was confirmed, not full Safari/PWA behavior.
2. Test installed production PWA service-worker update without session or unsaved local-draft loss. Do not log out before local drafts are safe.
3. Test RLS between two different authenticated users if multi-user operation is planned; anonymous isolation is verified, cross-authenticated not yet.
4. Confirm no backend destructive migration or schema change is needed. Production Supabase Free has no physical backup or PITR. User stated existing data are not important, but no wipe was performed.
5. Obtain explicit authorization to merge the release-candidate pull request into production main.

## Release and rollback
Keep main unchanged during review. Run complete CI on candidate branch and draft PR targeting main.
After authorized merge, test owner code login, V2 workspace, client creation, content editor and Safari PWA.
On failure, revert deployment to backup/main-before-v2-20261013 while leaving Supabase data untouched.
Status: RELEASE CANDIDATE DRAFT; PRODUCTION MAIN UNCHANGED.

## Verified Safari draft edit on 13 October 2026
- The owner explicitly confirmed that edits to the existing Reels remained after saving and reloading the authenticated iPhone Safari review page.
- Independent, read-only production SQL corroborated one linked `[V2 QA]` material, `status=draft`, a nonempty caption, `updated_at > created_at` and no scheduled/published state. The source still contained exactly 3 clients and 9 content items. The caption was NOT retrieved or copied to CI.
- This completes the specific real-iPhone authenticated client creation → Reels creation → text edit → save → reload verification gate.
- The auth-review client-side mutation guard is an accident-prevention feature, NOT a substitute for server RLS. Read-only policy inspection found membership-based SELECT and owner/editor INSERT+UPDATE, including UPDATE WITH CHECK. Anonymous requests returned no client or content rows.
- Unresolved: an authenticated two-user isolation test, installation/update of the *actual* iPhone PWA (only Chromium synthetic PWA cache update was checked), and full physical Supabase recovery on Free. No social publishing was tested.
- Production release remains DRAFT pending explicit cutover decision. Existing production site and data remain unchanged by these audits.
