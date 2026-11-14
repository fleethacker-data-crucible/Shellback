# Owner and review date

Design note for https://github.com/fleethacker-data-crucible/Shellback/issues/60. This file is the contract. It does not add the screen. Wording here is Shellback's own. It does not copy an unlicensed toolkit.

Every onboarding path (issue 56) and every task card (issue 58) names an owner and a review-by date. Overdue items are marked on screen and in exports. The date rule is the one the Credential desk already uses.

## Fields

Add these to the path file and to each task card. Older files that omit them still import. The screen then says "No review date".

| Field | Limits | Required | Notes |
|---|---|---|---|
| `owner` | text, at most 160 characters | no | A name the file carries. Shellback has no accounts, so this is a label, not a login. |
| `reviewBy` | `YYYY-MM-DD` or empty | no | Anything else is stored as empty and reported as a warning. |

## The date rule

Use `renewalState` in `src/core/analytics.ts`, passing `reviewBy` where a credential passes `expiry`.

| State | Meaning on a path or card |
|---|---|
| `none` | No review date. |
| `future` | Review date is more than 90 days away. |
| `soon` | Review date is within 90 days, including today. |
| `past` | Overdue. |

`renewalLabel` stays the credential wording. Paths and cards use their own sentences: "Review by {date}", "Review within {days} days", and "Review date has passed".

## Who sees overdue

The library is in this browser. Growth lists every overdue path and card in that library. When `profile.displayName` matches `owner` after trimming and ignoring case, the row also says "you own this". There is no mail and no other person's session to notify.

## Exports

The source file keeps `owner` and `reviewBy` only. It does not store a status word, so a file cannot claim it is current.

When the person exports the path or the card library, the exported copy adds `reviewState` computed that day: `none`, `future`, `soon`, or `past`. The Credential desk export of the workspace follows the same rule for these objects. `past` is the overdue mark.

Printing a card (issue 58) includes the owner, the review-by date, and the word "Overdue" when the state is `past`.
