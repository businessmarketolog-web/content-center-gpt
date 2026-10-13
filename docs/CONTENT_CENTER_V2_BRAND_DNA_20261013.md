# Content Center V2 — Brand DNA / клиентские правила
Implemented: 2026-10-13, branch feat/content-center-v2-brand-dna-20261013.

## One canonical data source
- All Brand DNA fields extend the existing protected clients.brand_rules JSONB object; NO table migration, second client ID, storage bucket or duplicate CRM.
- Client creation and edit continue through owner_create_client / owner_update_client with existing owner/member ACL, preserving unknown preexisting brand_rules keys.
- The 6-step owner wizard includes optional profile fields: audiences and interests, customer pains, positioning, writing rules, tone, forbidden phrases, CTA preferences, approved examples, exact fonts, brand colors, visual style, typography, Instagram Stories overlay/darkening rules, per-format rules, content pillars and publishing mix.
- Blank optional rules are explicitly unknown, not automatically invented. No default SMM style is applied to every client.
- Existing baseline fields remain intact. No production Supabase write is performed by this branch.

## V2 dashboard
- A client-scoped Brand DNA summary shows the current selected client's audience, voice, fonts, visual, overlays and content pillars/mix. Other clients' profiles are not shown.
- Edit via existing owner settings. The Brand DNA panel is read-only and does not write automatically.
- Explicit copy of curated client profile instructions for ChatGPT. No owner code, access token, API secrets, unknown JSON keys, integrations or unrelated clients leave the browser by this control.
- One owner may maintain separate brand profiles for different customers, including media/reels versus Telegram editorial style.

## ChatGPT handoff
- Existing manual handoff into the same content_items ID now includes format and channel and only selected client's approved audience interests, tone, rules for copy/CTA, required typography, visual text, overlays, mix and examples.
- No autonomous ChatGPT sync, saving, background learning, client creation, or publishing. The user reviews a JSON diff, applies changes to the existing editor and must press Save.
- Updating a client brand profile is a deliberate owner action. Revisions are not implicitly learned from unrelated chat sessions.
- Brand field values are length-limited and whitelisted; unrelated JSON metadata or unknown keys are not copied.
- The font names are instructions, not font binaries. Correct rendering on image requires permission to use the actual font files and manual/output validation.

## Release QA
- Node model and ACL tests ensure field completeness, scoping to explicit client_id, rejection on mismatch, unknown secret suppression, no automatic DB write.
- Chromium and WebKit desktop/mobile network-isolated browser tests verify client brand onboarding through the six-step owner wizard, update in the existing client record, no duplicates, and no cross-brand data after client switch.
- Full existing tests, a true PostgreSQL disposable backup/restore test, and a real Chromium service-worker cache-update smoke run in GitHub Actions.
- No real user profile was pre-filled without approval. Existing clients and materials remain unchanged.

## How owner uses this
1. Open V2 and select exact client in dropdown.
2. Open Brand DNA -> Изменить правила. Enter known fonts and visuals as written in brandbook. Leave unknowns blank.
3. Save via existing owner-only form. Confirm dashboard shows current client rules after reload.
4. Copy tailored brand instructions to ChatGPT, or open an existing draft -> ChatGPT -> карточка.
5. Review fact claims, design, actual font rendering and approved text before saving.
