# Content Center V2 — release gate (13 October 2026)

## Proven implementation

- Owner already confirmed successful six-step client creation on the real iPhone Safari in the isolated demo.
- A standalone mock-only review exists at https://businessmarketolog-web.github.io/content-center-v2-visual-demo/review/ . It cannot access or update real production Supabase data.
- New browser coverage in Chromium and Safari/WebKit checks first material creation, owner-intended duplicate cancellation, correct per-client isolation and preservation of locally unsaved editor deadline. The test session and database are entirely mock data.
- Safari/WebKit engine and Chromium browser checks passed for the corrected feature branch at commit `64e8fa06ea83eff05b51512aeeeeeebbbcc103fa` (GitHub Actions https://github.com/businessmarketolog-web/content-center-gpt/actions/runs/38357919264).
- Standalone preview browser matrix passed at commit `922bb4afb9e2a7b3efd97574c671bbc62cea757f` (https://github.com/businessmarketolog-web/content-center-v2-visual-demo/actions/runs/38357943491); GitHub Pages deploy succeeded (https://github.com/businessmarketolog-web/content-center-v2-visual-demo/actions/runs/38357942819).
- The real `saveAdd.onclick` binding is now guarded in V2. Prior unit tests erroneously invoked only the wrapped function directly; this defect was found by browser checks and corrected. PWA cache bumped to `content-center-v19-20261013-v2g`.

## DO NOT merge until these remaining gates are satisfied

1. **Restorable database backup**: Production contains client and content rows plus entries in `content_backups`, but snapshot rows are not proof of a full database restore. No Supabase development branch currently exists. Validate a full database backup and restore in an isolated environment before any backend/schema migration or destructive operation. A new Supabase paid branch/project requires explicit user cost confirmation.
2. **Live-session mobile check**: On an authenticated real owner account, verify brand rules load, material creation/editing works, and content remains client-scoped. The mock demo cannot prove real RLS, JWT or storage access.
3. **Real Safari PWA cache verification**: Check installed home-screen PWA for correct script updates without losing sessions or on-device drafts. Avoid logout until drafts are backed up.
4. **Human confirmation on production cutover**: Record current `main`, preserve backup refs, deploy only after 1–3, then test owner login and rollback immediately on errors.

## Non-negotiable rollback refs

- Production: `backup/main-before-v2-20261013` -> `815cd608c74c560e8056b3397fcdb713e5e52a32`
- Initial feature: `backup/v2-foundation-before-safety-20261013` -> `8b047fb2ff1b730980b501a42a4c5735e1c09b2b`
- V2 review branch: `feat/content-center-v2-safety-20261013` (latest verified fix above).
- Draft review: https://github.com/businessmarketolog-web/content-center-gpt/pull/2 . It targets the V2 foundation branch, not production main.

No production table was written to, no owner login code was changed and no real social-media publication was attempted during these tests.
