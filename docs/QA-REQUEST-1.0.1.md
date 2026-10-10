# App QA request: Taste Test 1.0.1 (tag v1.0.1, commit e98d055). Re-test after the 1.0.0 FAIL
- App: Taste Test (Chug Check + No Bad Bites), /workspace/taste-test. Owner: App Builder 2.
- Live test build (QA only, not shared with family): https://granttodd2026.github.io/taste-test/. version.txt = 1.0.1+202610102136 (deployed Sat Oct 10 ~2:36 PM PT).
- Test space: create a NEW throwaway space from the landing page ("Start a brand-new family space") with fake names. Never a family link.

## Fixes, finding by finding
1. [MUST] Removed the test.skip lines from offline.spec and update.spec; both now run and pass on iPhone WebKit (light and dark) and Pixel. 0 skipped.
2. [MUST] Chips are now min 48x48 (Look Auto/Light/Dark measure 48 in WebKit). The target-size test now covers buttons, chips, label chips, role=radio/switch on every tab, AND every sheet (Other drink, Add a bite, Rate, Start a trip, Add a person, Who are you).
3. Fresh-profile join: the first-run picker now waits up to 6 s for the first relay sync and redraws with names as they arrive. New test "fresh profile: opening the share link joins the SAME space": A creates a space from the landing page, and B (new profile) opens A's link, keeps the same #k, sees A's name, and sees A's drinks. Live check on Pages with real relays and a throwaway space: fresh B joined the same space and saw A's name.
4. Typing during sync: input values and caret are kept across redraws (Melody pattern: drafts on input + focus/selection restore). The first-run picker redraw keeps typed text. New test types "Bobby Lee", "Test Tacos" and a one-liner on B while A spams drinks and adds a person; values come through intact and sync to A.
5. Boards order is deterministic: built-in drinks in fixed order (Water, Diet Coke, Coffee, Beer, Margarita), then custom drinks alphabetically; all ties break by name/id. New two-phone test: identical card order on both phones.
6. Plurals: "1 drink", "1 snack added", "1 rating", "1 log" (new test).
7. Usage On/Off is now a full-width standard button (48px), same as other controls.
8. Removed wss://relay.nostr.net from RELAYS (now 6 relays).
9. New tests: two-phone usage totals (A's totals reach B; no entry text inside); export/import through the real Export backup button (download) and the Restore file input (setInputFiles), checking boards and rating after reload; Lighthouse now also runs on the main Home screen (throwaway code, Home with Chug Check buttons verified in the DOM).

## Gate evidence (deploy-gate run, Oct 10 ~2:30 PM PT)
- npx playwright test: 72 passed / 0 failed / 0 skipped / 0 retries (24 tests x iPhone 15 WebKit, iPhone 15 WebKit dark, Pixel 7 Chromium). QA's 57 expected + the new tests.
- Lighthouse mobile (3 runs each): landing 100/100/100, LCP 1.2-1.4 s, CLS 0, TBT 0 ms; Home 100/100/96-100, LCP 1.2-1.3 s, CLS 0, TBT 0 ms. The one 96 Best Practices came from a public relay returning 503 during one run (logged as a console error), not from the app. All assertions passed.
- axe wcag22aa: 0 serious/critical on every screen and sheet, light and dark. secrets PASS. JS 24 KB gzip.
