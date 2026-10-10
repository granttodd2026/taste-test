# App QA request: Taste Test 1.0.2 (local tag v1.0.2). NOT deployed
- App: Taste Test, /workspace/taste-test. Owner: App Builder 2. Build: 1.0.2+202610102208 (dist/ on the box). Code commit c800048.
- Live test site still serves 1.0.1 (https://granttodd2026.github.io/taste-test/). 1.0.2 deploys only after this QA pass.
- To test locally: `cd /workspace/taste-test && npm run build && node tests/serve.mjs dist 8850`, then open http://localhost:8850/ and create a NEW throwaway space with fake names.

## Changes
1. [Med] No nameless logs. Until this phone has picked a name, Home shows "Finding your family…" (while the first sync loads, up to 6 s), then "Who's on this phone?", with a "Choose my name" button instead of the drink buttons. Every logging action (drink, bite, rate, trip, crown, add person, archive) opens the name picker instead of saving. As a backstop, the data layer refuses non-person records without a name. New test (relays that never answer): the state shows, no drink buttons, Add a bite opens the picker, 0 records saved; after picking a name, a drink saves with who=p-… and by set.
2. check-secrets.sh now greps the CONTENT of every commit on every ref (git grep across git rev-list --all) and prints commit:file:line only, never the value. Proof: a throwaway branch that committed and then removed a fake nsec1… string was caught ("Secret-like strings in git history: <commit>:probe.js:1", FAIL); the branch was deleted and pruned afterward. Current repo: history scanned (9 commits), PASS.
3. Lighthouse makes no relay traffic: Chrome resolves only localhost (--host-resolver-rules), and lighthouse-setup.cjs gives every Lighthouse page a quiet offline WebSocket stub. Result: 0 console errors in all runs (1.0.1 had a relay 503 that dropped Best Practices to 96).

## Gate evidence (Oct 10 ~3:10 PM PT)
- npx playwright test: 75 passed / 0 failed / 0 skipped / 0 retries (25 tests x iPhone 15 WebKit, WebKit dark, Pixel 7 Chromium).
- Lighthouse mobile, 3 runs each: landing 100/100/100, LCP 1.2-1.4 s, CLS 0, TBT 0 ms; Home 100/100/100, LCP 1.3-1.4 s, CLS 0, TBT 0 ms; 0 console errors.
- secrets PASS (files, dist, history content). JS 24.4 KB gzip. axe 0 serious/critical (light + dark).
