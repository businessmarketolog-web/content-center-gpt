# Brand DNA visibility fix — 13 October 2026

Reported by owner: could not find «Бренд-ДНК клиента» on iPhone after the V2 feature was released.

## Root cause / UX gap
- First Brand DNA implementation presented a section only *inside the V2 dashboard*. There was no separately named control in the sidebar or beside the selected client.
- When the owner had Calendar, Production or another tab open, Brand DNA was out of view. The existing legacy URL intentionally does not enable V2.
- Older iPhone PWA versions may still use cached HTML or scripts; static deployment cannot forcibly clear their active tab. No claim that a particular iPhone cache was proven stale.

## Fix
- New button «✦ Бренд-ДНК» directly after owner «Настройки клиента» in the top header, including mobile layout.
- New sidebar navigation item «Бренд-ДНК» after «Главная» in the V2 workspace.
- Both buttons open the existing V2 dashboard, re-render the selected client Brand DNA summary, focus the section and scroll it into view. They do not make new cards or perform network/DB writes.
- Repeated sidebar renders do not duplicate controls. Legacy URL without workspace=v2 retains previous UI.
- Change the V2 Brand DNA CSS+JS asset version and service-worker cache version, so the next fresh navigation installs the new assets. Do not clear owner storage, local drafts, browser site data, or owner session.
- If the owner opens a former home-screen shortcut that loads the legacy URL, use the explicit main V2 link: https://businessmarketolog-web.github.io/content-center-gpt/?workspace=v2

## Verification
- Automated tests: header/sidebar entries on desktop/mobile Chromium and WebKit, click from Calendar and Production to focus Brand DNA, no duplicate controls, unchanged legacy behavior, 55 Node regressions, PWA update check, database dump/restore in disposable PostgreSQL.
- Release only after CI success on dedicated feature branch and PR, with exact approved SHA.
- Backup branch created at known-good live main: backup/main-before-brand-navigation-20261013.
- Production Supabase untouched; no account settings, client rules or posts automatically modified.

## Owner action after release
Open V2 using the explicit link (not an older home-screen icon), then look alongside «Настройки клиента» for «✦ Бренд-ДНК». On tapping it the selected client's Brand DNA is brought into view. To change actual rules tap «Изменить правила» inside the section and save the existing owner form.
