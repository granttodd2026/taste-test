# App QA request: Taste Test 1.0.0 (tag v1.0.0, commit d67a57b)
- App: Taste Test (Chug Check + No Bad Bites), /workspace/taste-test. Owner: App Builder 2.
- Version: 1.0.0 (first release). Pages test build: NOT deployed yet (waiting on Grant's direct OK for repo + Pages).
- What changed: new app. 1-tap drink logging (Water, Diet Coke, Coffee, Beer, Margarita, custom), 2 taps for someone else; No Bad Bites add + rate 1-10 with one-liner; Home glance; all-time/monthly boards (Water Champ, Diet Coke King/Queen/Royalty, Snack Champ, Most Generous / Harshest Critic, Top/Bottom bites); Trip Mode (dated trip, auto-tagging, daily + trip boards, awards, final-night wrap-up, archive to Trip Catalog with Undo); E2E Nostr sync; usage totals with off switch; prompted SW update.
- Test space: make a NEW throwaway space from the landing page ("Start a brand-new family space") with fake names. Never a family link.
- Evidence: npx playwright test 53 passed / 0 failed / 4 skipped (WebKit SW offline/update skips, same as starter), 0 retries; Lighthouse 99/100/100, LCP 1.3 s, CLS 0, TBT 130-140 ms; secrets PASS; rollback.sh v1.0.0 dry-run OK.
