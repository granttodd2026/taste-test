# Taste Test v1.0.0 (Chug Check + No Bad Bites)
**Job story:** When the family is together (or apart), I want to log a drink or rate a bite in seconds, so we get fun boards and trip memories without anyone keeping score by hand.
**Users:** adults in the family, each on their own iPhone, added in-app (names live only in the encrypted space). Babies are not users.

## Acceptance (Given/When/Then)
1. Given the Home screen, when I tap a drink, then it logs for the selected person in 1 tap (2 with a person switch), shows Undo, and survives an immediate reload.
2. Given a bite exists, when anyone taps Rate and a score 1–10 (optional one-liner), then the average, Top/Bottom bites, Snack Champ, Most Generous and Harshest Critic update on every phone.
3. Given an open trip whose dates cover today, when anything is logged, then it is tagged to the trip and counts toward daily boards, trip boards and awards.
4. Given the trip's last day, when I open Final-night wrap-up and archive, then the trip moves to the Trip Catalog (Undo available) and stays browsable.
5. Given airplane mode, when I cold-open and log, then the app works and syncs later.
6. Given the usage switch is Off on a phone, then that phone records no usage totals.

## 3am / beach version
Open → tap 💧 Water → done (1 tap). For someone else: tap their name → tap the drink (2 taps).

## States
Empty (every list has a friendly empty line), offline (pill: "Saved on this phone · N to share"), error (calm banner, entries safe), first-run (Who are you? sheet), many items (lists sort newest first; boards top 5).

## Privacy
New data: names, drinks, bites, scores, one-liners, trip names/dates. All E2E encrypted (AES-256-GCM, key from the URL fragment); relays see ciphertext only. No photos. No third-party scripts. Usage totals hold event names/counts only.

## Not doing (v1)
Photos, push reminders, per-person logins, location, nutrition/alcohol tracking or limits, comments threads, kids as users.
