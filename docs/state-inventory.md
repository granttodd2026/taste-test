# State inventory (quality-bar gate 19)
| State | Shared? | Two-device test |
|---|---|---|
| People (names, Diet Coke crown) | Synced | sync.spec "people, drinks, custom drinks, undo, and crowns" |
| Drinks (+ Undo/delete) | Synced | same |
| Custom drink types | Synced | same |
| Bites, ratings, one-liners | Synced | sync.spec "bites and ratings" |
| Trips (start, tagging, archive/catalog) | Synced | sync.spec "trip start, tagging, and archive" |
| Usage totals | Synced (encrypted, per phone/hour) | usage.spec (local); same sync path as all records |

Device-only, on purpose:
- `sb-me` (who this phone is): each phone belongs to one person.
- Selected "drinking as" person, board period, open tab: momentary UI.
- `sb-theme`: per-phone preference.
- `sb-usage-off`: each person opts out on their own phone.
- `sb-code`: the family key; never leaves the phone except in the link a person shares.
