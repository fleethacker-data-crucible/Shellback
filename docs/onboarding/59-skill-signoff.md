# Skill sign-off

Design note for https://github.com/fleethacker-data-crucible/Shellback/issues/59. This file is the contract. It does not add the screen. Wording here is Shellback's own. It does not copy an unlicensed toolkit.

A sign-off records that a person has shown they can do a skill they have already confirmed. It is not a credential, and it does not change credential provenance (`claimed`, `reviewed`, `verified` on `src/core/schema.ts`). It is a separate list on the Credential desk, beside those words, so the person sees it in the same place.

## Record

Stored on the workspace, one row per skill:

| Field | Limits | Required | Notes |
|---|---|---|---|
| `skillId` | a skill id | yes | Must be in `profile.confirmed` at the time it is saved. Otherwise the save is refused. |
| `level` | `with-help`, `on-their-own`, or `common-variations` | yes | Completed with help, completed on their own, or can handle common variations. |
| `by` | text, at most 160 characters | yes | The name the subject-matter expert typed. Shellback does not check who they are. There is no login. |
| `at` | `YYYY-MM-DD` | yes | The day it was recorded. |

A second sign-off for the same skill replaces the row the person can see. The consent ledger keeps the earlier event.

## Consent ledger and audit trail

`src/core/consent-ledger.ts` is append-only. Today an event is `type`, `personId`, `field`, `teamId`, and `at`. Add a consent field `signoff` next to `skills`, `confidence`, `mentoring`, `credentials`, `org`, and `contribution`, and add an optional `detail` object on the event so a sign-off can be told apart from a plain grant.

- `detail` holds `skillId`, `level`, `by`, and `at` (the calendar day). Other consent fields omit it. A grant or revoke without `detail` stays valid.
- Recording a sign-off appends a grant event for `signoff` with that `detail`.
- The person can withdraw the sign-off without withdrawing the skill. That appends a revoke for `signoff` with the same `skillId`. The row disappears from every view. The ledger keeps both events.
- `auditTrail` already lists every event for the person, oldest first. The Credential desk shows that list for sign-off events: who, when, level, grant or revoke.

Sharing a sign-off with this browser's team tools is off until the person grants `signoff`, the same way credential names wait for their own switch.

## Hiding

Withdrawing the skill (`profile.confirmed` no longer contains `skillId`) hides its sign-off in every view: Credential desk, Growth, path, team counts, exports the person can see. The ledger is not rewritten. If they confirm the skill again, the sign-off stays hidden until they grant it again. A revoked or skill-withdrawn sign-off is not a current level.

Views must not show a sign-off as proof of readiness, a rank, or a score. The label is the level words above, plus "recorded by {by} on {at}, not an independent qualification".
