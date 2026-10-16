# Content Center V2: iPhone accessible back buttons and contextual edge swipe

## User experience
- All existing Назад buttons in the full-screen iPhone material editor, new material, media picker, search, tools modal and owner/client settings sit below the iPhone safe-area inset, including Dynamic Island. Back buttons have >=48px tap targets.
- On the main page, after opening another section, a top Назад button appears. Its activation returns one section back. Main bottom navigation remains intact.
- In the installed iPhone PWA, swipe from the leftmost 76 CSS pixels to the right by 82+ pixels (vertical drift <=44px) returns one step; in browser tabs, start between 24 and 64 pixels to avoid competing with native Safari browser-back.
- Swipe priority: owner client wizard previous step, top modal/dialog, open material editor, new material/media, search, V2 ChatGPT handoff, previous main section.
- Vertical scrolling, typing, carousel/horizontally scrollable elements and right-to-left swipes do not activate back.
- Unsaved changes: material editor (title, brief, caption, status, scheduled date, assignee, deadline, tags, media), new-material local drafts/uploads, owner client form and media picker require explicit confirmation before exiting. Cancelling preserves the form.
- The six-step owner client form swipe goes back one wizard step. At step 1 it closes only after checking for unsaved edits.
- Existing content, clients, statuses, Supabase schema, API credentials and material publication workflow are untouched. No data writes or external APIs from navigation JS.
- Explicit ?workspace=v1 legacy rollback mode does not install the swipe handler.

## Technical and rollback
- New files: v2/mobile-navigation.js and v2/mobile-navigation.css, loaded last.
- Main-screen in-memory history bounded to 20 and reset when selected client changes. No change to browser history or persistent storage.
- Touch listeners passive; they never prevent default Safari scroll and native gestures.
- Tested with Node contract tests, Chromium/WebKit mock database desktop/mobile browser smoke, safe-area hit targets, unsaved changes, PWA storage and PostgreSQL restore.
- Service-worker cache version content-center-v25-20261016-iosnav1. No reinstall, cache clearing, localStorage deletion or reauthentication.
- GitHub rollback: backup/main-before-ios-nav-fix-20261016 at b2d4ff241039e415e6f5efe797ab03e175c23fc3.

## Physical iPhone QA
- Browser-simulated mobile/WebKit tests do not precisely reproduce every iPhone safe inset or Safari-native navigation gesture. Test on installed icon after release.
- If old code persists, open live URL and reopen existing icon. Do not delete icon or Safari storage.
