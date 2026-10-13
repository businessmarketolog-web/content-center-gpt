# Client Brand DNA V2

The existing public.clients.brand_rules JSONB is the sole canonical record. Existing owner-only owner_update_client RPC persists structured brand constraints. No new schema or client copy.

Client settings wizard has six steps, now including audience interests, objections, positioning, writing rules, taboo phrases, CTA, exact font names, brand colours, visual style, Stories overlays, format rules, content mix, and owner-approved examples. The V2 dashboard displays a profile only for the selected client, offers editing through the existing owner settings, and copies allowlisted client-specific instructions for ChatGPT. Manual ChatGPT handoff to an existing card uses the same brand context.

Legacy dashboard remains default: V2 is enabled via ?workspace=v2. New browser tests assert client isolation on switching. No external publishing and no automatic ChatGPT sync are claimed. No production credentials are copied; exact visual font rendering still requires licensed fonts and visual review. Approved examples are owner-entered; edits are not automatically learned. Empty brand rules must not be invented by AI.

Supabase is unchanged; rollback branch backup/main-before-brand-dna-20261013 points to 16122da02c1059031ff3d9aa28434ed8dd241efa. Validate saving the test client's brand profile and reloading on the actual iPhone before filling profiles of all clients.
