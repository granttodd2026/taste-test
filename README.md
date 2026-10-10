# Taste Test (Chug Check + No Bad Bites)
Private family drink + food scoreboard PWA. Rename the app in `src/config.js` only (build stamps index.html + manifest).

- `src/` app.js (UI), logic.js (boards/trips, unit-tested), sync.js (E2E Nostr sync, melody-tracker pattern, own domain-separated keys `sipbite/v1/`), usage.js (encrypted usage totals with off switch), config.js (name).
- `public/` index.html, tokens.css (design system), app.css, sw.js (cache `tt-<version>`, prompted update banner), manifest.
- `npm run build` → dist/. `npx playwright test` (iPhone 15 WebKit light/dark, Pixel 7 Chromium; local relay for two-phone tests). `npm run lhci`. `npm run secrets`.
- Deploy: `APPROVED=1 DEPLOY_REPO=https://github.com/granttodd2026/taste-test.git scripts/deploy.sh` (refuses without APPROVED=1, a clean tree, and a green gate). Rollback: `scripts/rollback.sh vX.Y.Z` (dry run by default).

## Threat model (plain language)
The family link ends in `#k=<secret>`. The part after `#` never goes to any server. From it each phone derives a signing key and an AES-256-GCM key. Public Nostr relays store only encrypted blobs signed by a family key; they can see that a family key writes small records and when, not what's in them. Anyone holding the link can read and write, so share it only with family adults. GitHub Pages serves only the app code, which contains no names or data.
