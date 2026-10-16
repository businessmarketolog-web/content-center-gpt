# Virale Studio beta — isolated Content Center V2 feature (16 October 2026)

## Purpose
Original, free, client-scoped short-video reference analyzer. It runs in existing Content Center V2, uses clients.brand_rules via CCV2BrandDNA, reuses assets Ideas and the existing content editor. No duplicate database, subscription, API key or scraping.

## Workflow
1. Choose a client and open Virale Studio in navigation.
2. Enter a topic, optional Instagram Reel/Post, TikTok Video or YouTube Short link, observations and manually verified metrics.
3. Click Разобрать: inspect engagement and comparisons (only when supplied). No predictions of virality or retention.
4. Choose one of three original Reels scripts and create a draft prefilled in the existing editor; review and save manually.
5. Save the canonical source URL to existing client-scoped Ideas if useful.
6. Copy an AI brief with Brand DNA of ONLY selected client to ChatGPT on explicit click. No background data sharing.

## Data, ethics, and cost
- No automatic fetching of links or claiming the source video was watched. Do not reproduce media.
- Existing account authentication and asset RLS remain unchanged.
- HTTPS URL allowlist strips referral tracking and avoids HTML injection.
- No automation or guaranteed outcomes; no paid API, no secrets, no posts made automatically.

## Safety
Separate branch based on prechange main. Keep original release gate in docs/CONTENT_CENTER_V2_RELEASE_GATE_20261013.md. Do not merge until controlled browser/WebKit/PWA and live owner-data checks and production backup/restore requirements are satisfied. This implementation only adds static app files and reuses the current database schema.

## Limitations
Automatic trends, frame analysis, transcripts and up-to-date competitor statistics are not available in the free manual mode. Metrics must be supplied by a human.
