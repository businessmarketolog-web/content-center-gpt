# Content Center V2: Free Cloudflare Workers AI text generation

## Hard zero-billing requirement
- Text generation uses the officially supported Workers Free model @cf/google/gemma-4-26b-a4b-it (as checked 2026-10-13).
- Cloudflare Workers Free includes 10,000 Neurons/day. Exceeding its quota fails without a bill.
- Must NOT connect a Workers Paid plan, paid-only model or prepaid AI Gateway, which can result in charges.
- Server Edge Function disabled until ALL secure secrets are configured: CONTENT_AI_ENABLED=true; CLOUDFLARE_WORKERS_FREE_CONFIRMED=true; CLOUDFLARE_ACCOUNT_ID; CLOUDFLARE_AI_TOKEN. Owner must verify account is Workers Free before enabling.
- All secrets live only in Supabase Edge Secret store, not GitHub, HTML or a user message. No payment info should be entered.
- Supabase and GitHub Pages stay on existing free tiers; their own usage caps remain separate.

## iPhone workflow
1. Select current client and open existing draft or production card on V2 dashboard.
2. Click ChatGPT → карточка; then use ✦ Создать с ИИ, with destination title, brief or caption.
3. Supabase authenticates with user JWT, verifies selected client and owner/editor membership via existing RLS, checks status and snapshot, then reads only selected client Brand DNA and current card.
4. Free Cloudflare Workers AI processes a bounded text-only prompt and returns a text proposal (max 800 output tokens).
5. Browser checks matching request/client/card/field/baseline again, previews before/after, and requires explicit Перенести в редактор followed by Сохранить. No automatic content insert, save, publish or workflow status change.
6. Without free account credentials, show an understandable not-configured message and keep Copy → ChatGPT → Paste workflow intact, free of charge.

## Cost and privacy controls
- Server-side DB quota reserves max 8 attempts per user per UTC day with at least 30 seconds between attempts. Workers Free 10,000 daily Neurons is a second platform cap.
- Cloudflare claims no use of customer content for training AI or improving services without explicit consent. Text of the client material is still shared with Cloudflare to generate content.
- Do not send sensitive client customer records, payment details or authentication tokens. Prices, tourist entry rules, promotions and hotel specifications require human verification.
- Brand font instructions are included in the prompt but no image/font rendering is claimed.

## Rollback and deployment
- Exact pre-change main: d1d34386ecc892257268c03b69e2e3ee908fe5ee saved in backup/main-before-server-ai-20261013.
- Manual mode never requires Cloudflare credentials. Production AI only enabled after owner Free-plan confirmation and non-sensitive end-to-end verification.
- New quota table and restricted RPC do not change existing client or material tables.
- Disable server AI at any time with CONTENT_AI_ENABLED=false.

Cloudflare reference:
https://developers.cloudflare.com/workers-ai/platform/pricing/
https://developers.cloudflare.com/workers-ai/platform/data-usage/
https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/
https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/
