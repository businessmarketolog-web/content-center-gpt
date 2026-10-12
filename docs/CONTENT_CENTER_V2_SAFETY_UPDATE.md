# V2 safety update — 13.10.2026

## Tested implementation

- Opt-in V2 workspace provides one canonical client → content → approval/publication workflow; no shadow records or client duplication.
- ChatGPT handoff never overwrites unsaved text, date, channel, format, status or media in a visible editor; changes are only staged for explicit owner save.
- The new-material save warns of a possible same-client / same-name / same-format / same-channel duplicate. Owner can cancel or explicitly proceed with recurring content. The warning is only enabled for `?workspace=v2`.
- New script references and PWA cache version are updated.
- Six-step client onboarding works on the original owner client form and preserves existing RPC creation/update and brand profile fields.
- After a successful V2-only client creation, owner is offered to open the existing first-material form. Nothing is automatically inserted. Legacy `main` and owner-code login remain unchanged.

## Verification completed

- Baseline: 25/25 Node tests.
- Updated feature: 41/41 Node tests.
- JavaScript syntax checks pass.
- Patch tested with `git apply --check` and `git apply` against the exact foundation SHA.

## Still not completed

- Browser/end-to-end verification on an authorized iPhone and Windows device.
- Backend-confirmed ChatGPT ↔ Content Center synchronization.
- Fact checking against source documents and real social network publish outcomes.
- Restoring a full backup in an isolated staging database.

## Release gate and rollback

Keep changes on a new branch and draft PR until CI checks and device-level smoke tests complete. For rollback, preserve `backup/main-before-v2-20261013` and `backup/v2-foundation-before-safety-20261013` Git refs. Do not modify production Supabase before an isolated backup/restore test.

## Browser validation gate (mock data)

GitHub Actions now contains an isolated Chromium smoke job for desktop and mobile-sized viewports. It loads the *real* V2 HTML and scripts using a fake owner session/client records. The Supabase CDN bundle is replaced with an in-memory mock; all requests to non-local hosts are blocked, and service workers are disabled during this test. This is **not** the same as signed-in Safari testing on a real iPhone or a staging Supabase instance.
