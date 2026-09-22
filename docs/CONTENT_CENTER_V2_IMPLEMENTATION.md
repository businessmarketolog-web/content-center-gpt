# Content Center V2 — review branch, phase 1

Status: **review / not released**. This branch is intentionally separate from the GitHub Pages `main` branch and does not write to Supabase. It is a working, opt-in client-scoped dashboard built on the existing owner app. Do not claim ChatGPT sync or publishing is already functional.

## Audit of the existing app (2026-09-23)

Source inspected: `index.html`, `app.js`, `app.css`, `clients-v9.js`, `workflow-v7.js`, `ideas-v8.js`, `enhancements-v6.js`, `service-worker.js`, `docs/OWNER_WORKFLOW.md`, `docs/CONTENT_CENTER_NEXT.md`.

- `app.js` is approximately 1,900 lines and contains repeated overrides of `renderDashboard`, `renderAll`, and `loadClientData`. Additional standalone scripts extend it. The first modernization goal is to separate read models and presentation without rewriting authentication or replacing the database.
- Existing: owner-only session, client selector/settings, material cards, ideas, calendar, media library, production, review-by-link, campaigns, templates, content history, backup controls, publishing controls. These should not be recreated as independent shadow records.
- Unverified end-to-end according to the repository's own existing documentation: ChatGPT↔Content Center sync, Instagram/Telegram delivery, media privacy, backup restore, real iPhone upload/PWA, material bin. Their UI must not imply success without evidence.
- Design references: user-approved Planable-style actionable approval queue, Workfront-style production status, Bynder-style media provenance, and the existing Content Center dark graphite/cyan visual language. This branch does not claim identical functionality to those products.

## Implemented in this branch

- `v2/workspace-model.js`: pure, defensive, client-ID-scoped summary model. No network requests or database writes. Missing client ID yields zero items instead of leaking all projects.
- `v2/workspace.js` + `v2/workspace.css`: opt-in dashboard with a prioritized production queue, honest status counts, upcoming week, quick actions that invoke existing editor/approval/calendar functions, responsive graphite layout and encoded user text. Existing owner login and CRUD behavior remain unchanged.
- New assets are loaded from `index.html` and cached under a new service-worker version. **Default URL keeps the existing dashboard**: to see this prototype on a build of the branch, use `?workspace=v2`. This does NOT make the branch accessible on production GitHub Pages, whose source is `main`.
- `tests/workspace.test.cjs`: client isolation, ordering, escape/sanitization, empty/invalid dates, opt-in default, and preview integration smoke checks.

## Implemented next: deterministic preflight (phase 2, same draft PR)

- `v2/preflight.js` adds a pure, read-only checklist for missing title, visual media, Telegram/Instagram text, broken HTTPS media references, an absent scheduled date, placeholder markers and possible factual claims (prices, dates, promotions). It also reminds the owner to verify approval of the current version and provider-confirmed publication, where applicable.
- A **«Проверить»** action in the V2 queue renders findings for the chosen material. The action selects a card by both its existing ID and the active `client_id`; it does not modify any card, change status, verify a price externally, auto-approve, or publish anything.
- **Do not call this a Fact Checker.** The interface explicitly states that real factual accuracy, media usage rights, version-specific approval and actual publishing results need separate evidence. Automated QA only catches deterministic content-preparation omissions.
- Read-only Canva brand-kit lookup returned no kits and Airtable base lookup returned no bases in the currently connected accounts (2026-09-23); neither app was made a second content database. Existing Planable/Workfront integrations were not written to or required for this stage.
- `tests/preflight.test.cjs` and interaction regression in `tests/workspace.test.cjs`: 12/12 tests passing on Node, plus JS syntax checks. A rendered authenticated browser/iPhone end-to-end test is still needed before release.

## Phase 3 — safe manual ChatGPT handoff to an existing card (this review branch)

- `v2/handoff-contract.js`: explicit `content-center-handoff/1` response contract with a fresh request UUID, exact `client_id` and existing `content_item_id`, and a baseline snapshot of title/brief/caption/status/updated_at. Rejects another client/material, stale local version, missing/archived/approved/scheduled/published cards, unknown keys (including status and media URLs), malformed and oversized fields, and no-op responses.
- `v2/handoff-ui.js`: owner-initiated **«ChatGPT → карточка»** button on draft/production materials in V2 queue. Copies a task for the current material, takes a JSON answer, shows field-by-field before/after, then—only after explicit confirmation—fills the existing editor's title/brief/caption fields. This module itself **does not write any data to Supabase, create a material, mark anything approved/published, or silently save**. The owner must review the existing editor and press its ordinary «Сохранить» action.
- Staged updates are limited to an existing card of the active client. Unknown fields cannot change status, client, format, media, scheduling, or publishing credentials. The interface warns that automated ChatGPT↔Content Center synchronization does **not** exist yet.
- The in-browser baseline check guards against changes already loaded into the browser and an unexpected editor selection; **it is not a server-side compare-and-swap or a guarantee against concurrent remote edits**. Before allowing automated server writes, implement an owner-authorized idempotent API with an expected-version check and read-after-write confirmation on an isolated DEV project, then test approval invalidation and retry safety.
- New `tests/handoff.test.cjs` and `tests/handoff-ui.test.cjs` exercise ID/client/nonce isolation, stale and malicious payloads, owner-only opt-in, no duplicate UI controls, and transfer only into the existing editor. All 25 Node tests pass and JS syntax checks pass. Browser/iPhone, real owner login and real database save **remain unverified**.

## Data ownership and contracts (next implementation phases)

- One `clients.id` per client, one `content_items.id` per independent material; child platform variants retain a parent reference. The existing Content Center is the canonical place to create/edit clients. ChatGPT must update an existing ID, not create a duplicate.
- Any write from ChatGPT requires explicit owner authorization, target client+material IDs, request idempotency key, validation and **read-after-write confirmation**. Build and test on an isolated DEV project first. Do not expose service-role keys to the browser.
- Approval always binds to a content-version/hash; changing content invalidates prior approval. Client gets only an expiring link to the exact material, never an owner session.
- Mark a publication delivered only after a provider response supplies an external ID or permalink. Failed attempts, retries and a manual resolution route are separate from a manually set card status.
- QA fact checks produce traceable findings, timestamps and a human review path. Don't present generated copy or scheduled drafts as published, audited facts.

## Release gate (must be completed before touching live `main` or production database)

1. Review this branch with owner and inspect the actual dashboard at iPhone and desktop sizes using an isolated preview. The current branch is **not** a live preview deployment.
2. Repeat actual owner-code login from an unrecognized browser; ensure no login or session behavior changed. Test client switching and confirm cross-client content never appears in the wrong project.
3. Verify that the current backup can actually be restored in a separate environment, including content and media permissions; do not treat a backup button as proof of restorable data.
4. Add read-only test fixtures and API contract tests on a separate DEV project. Test `publish_queue`, approval-version transitions, PWA updates, stale sessions and network failures. All production writes require an explicit deployment decision after review.
5. Merge only after a reviewed diff, rollback plan, mobile browser smoke test, and no regressions in owner access. Keep `main` as a known-good fallback until evidence supports release.

### Important history

The prior Agent OS intake work was mistakenly applied to the live `content-center-gpt` Supabase project rather than a DEV project. It introduced an intake function, changes to Agent OS tables, and test data. This V2 branch does not edit or roll that work back; any reconciliation requires a separate review and explicit approval.
