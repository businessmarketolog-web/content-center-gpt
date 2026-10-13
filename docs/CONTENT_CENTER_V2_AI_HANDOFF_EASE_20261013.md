# Content Center V2 — AI editor: plain ChatGPT text into existing content card

Release target: one canonical client, one canonical draft, less manual conversion.

## Implemented workflow
1. Select the specific client in Content Center V2. Its Brand DNA defines audience interests, tone of voice, font instructions, visual texts, content mix, prohibited promises and examples.
2. Find an existing draft/work-in-progress material in the V2 dashboard queue. Tap ChatGPT → карточка.
3. New ИИ-редактор материала panel defaults to Обычный текст, with destination Текст публикации. Other destinations: Бриф or Заголовок. Prompt changes for destination and includes only selected client's permitted brand rules. No credentials or other clients included.
4. Press Скопировать задание, optionally Открыть ChatGPT (opens public chatgpt.com homepage; never sends a message or guarantees a new conversation), paste the prompt into the chosen ChatGPT conversation.
5. Copy the ready caption/brief/title from ChatGPT and paste ordinary text, not JSON, into V2.
6. Проверить ответ → inspect Before/After diff → Перенести в редактор → review and Сохранить in the same card. No status/media/date auto-change.
7. JSON · несколько полей remains available for technical handoffs. Switching formats or target fields clears old reply and invalidates transfer approval.

## Safety guarantees
- Strict handoff parser validates selected client ID, material ID, active request baseline, draft/production status and allowed text keys. Reject archived, approved, published, stale and foreign client cards.
- Unsaved edits never overwritten. Confirm before transfer. Original Save always manual; no new tables or records.
- No paid AI generation or model API deployed; ChatGPT opens in another tab and context is copied only via explicit button. Conversations not created automatically.
- No production Supabase writes, schema migrations, storage changes, account connections or costs.
- PWA CSS/JS/handoff assets versioned. Original V2 backed up in backup/main-before-ai-handoff-ease-20261013.

## Verification
- Node tests cover JSON compatibility, plain text for caption/brief/title, brand whitelists, client binding, archive/status/stale denial, and unsaved editor fields.
- Chromium/WebKit desktop/mobile smoke checks plain text and JSON mode with mock Supabase only.
- Chrome service worker cache update protects localStorage and sessionStorage; synthetic data only.
- Direct server-side AI integration still requires verified API provider key, authentication, rate limits, privacy safeguards and billing approval and a separate production release.
