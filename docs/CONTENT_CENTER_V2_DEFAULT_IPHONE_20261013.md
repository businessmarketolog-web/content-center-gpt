# Content Center V2 — default mode for existing iPhone home-screen icon

Issue: an existing PWA icon opens `./` because the old manifest `start_url` was `./`, but V2 modules had an explicit `?workspace=v2` guard. Thus an owner could see Brand DNA via a Safari link and still not see it through their installed icon.

## Patch
- Bare normal address `https://businessmarketolog-web.github.io/content-center-gpt/` now runs V2. Existing iOS home-screen icons that open `./` can use the same app without reinstalling.
- New PWA manifest `start_url: ./?workspace=v2`, keeping scope unchanged.
- Existing explicit link `?workspace=v2` continues to work.
- `?workspace=v1` or `?workspace=legacy` explicitly disables V2 modules and exposes the previous interface in the same database. This is an emergency UI fallback, not a separate database.
- Original owner authentication, RLS, client IDs, `content_items`, saved drafts, cards, settings and server schema unchanged. No automatic writes or logout required.
- V2 client onboarding wizard, duplicate checks, ChatGPT handoff and Brand DNA now activate on the bare root too.
- Versioned PWA script/manifest assets and a new service-worker cache name prompt online clients to download the revised frontend.
- Service-worker activation cleans *only older versioned* caches beginning with `content-center-v`, never unrelated same-origin caches or non-versioned user caches. No code deletes localStorage, sessionStorage or IndexedDB.
- IMPORTANT: An already-open offline iPhone PWA cannot receive a code update without an online navigation, and an existing installed app may keep an old manifest start URL; bare URL now activates V2 once new HTML/JS loads. Real iOS installed-icon persistence still needs owner confirmation.

## Evidence and release gates
- Node model regression suite, isolated desktop/mobile Chromium and WebKit browser tests for `?workspace=v1`, bare launch and explicit V2 deep link.
- Real Chromium synthetic service-worker install/update checks retention of localStorage, sessionStorage and other caches. It does NOT guarantee actual user iPhone PWA storage.
- Synthetic PostgreSQL 17 backup/restore and Python export-integrity guard remain in CI.
- Preserve backup/main-before-v2-default-20261013 at current live main 5ccdfaa16e6f79f6a1e4cf8b8edf7ec46b29839c. Do not run production database migrations, delete client data or clear iPhone storage.

## Next user verification
1. Open the *existing* Content Center icon from the iPhone home screen while online. If it was already open in the app switcher, close only its window and relaunch (do not delete app).
2. Check both the Brand DNA sidebar item and top button and open the selected client's profile.
3. Confirm a preexisting client and Reels are still present. If old UI remains, compare a fresh Safari `/?workspace=v2` link. Never clear browser history/site data or uninstall the app before local drafts are safe.
