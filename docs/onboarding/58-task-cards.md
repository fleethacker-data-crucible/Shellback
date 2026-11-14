# Task cards

Design note for https://github.com/fleethacker-data-crucible/Shellback/issues/58. This file is the contract. It does not add the screen. Wording here is Shellback's own. It does not copy an unlicensed toolkit.

A task card replaces a bare learning link. The same card can be attached to a skill and to tasks on more than one onboarding path (issue 56). Cards print with the team workshop sheet.

## File

`format` is `shellback-task-card`. `version` is `1`. A library file holds up to 200 cards. One card may also be imported alone.

| Field | Limits | Required | Notes |
|---|---|---|---|
| `id` | 1 to 64 characters: letters, digits, `-` | yes | Stable. Re-importing the same id replaces that card. |
| `title` | text, at most 160 characters | yes | |
| `skillIds` | list of skill ids, at most 12 | yes | Ids from `src/core/taxonomy.ts`. Unknown ids are dropped. At least one known id must remain. |
| `prerequisites` | list of text, at most 12 items, each at most 200 characters | yes | Access, data, or permission the person needs before they start. May be empty. |
| `steps` | list of text, 1 to 20 items, each at most 400 characters | yes | |
| `expectedResult` | text, at most 600 characters | yes | What finished looks like. |
| `qualityCheck` | text, at most 600 characters | yes | How they can tell the result is good enough. |
| `whenItGoesWrong` | text, at most 600 characters | yes | What to try, or who to ask, when a step fails. |

A path task's `cardId` (issue 56) points at `id`. Several paths may use the same id. A card with no path is still shown from the skill, on My profile → Growth and from the skill drawer, as "How to practise".

Cards are local workspace data. They are not sent to a provider. Card text is about the task, not about a person.

## Print

Team → Coverage already prints the workshop sheet with `printSheet('workshopSheet')` in `src/app/views/TeamInsightPanels.tsx`. When that sheet prints, append the cards whose `skillIds` intersect the skills named on the sheet. The printed card is the task text only. It does not name who has the skill.

My profile → Growth can print the cards for the tasks still on the person's path, with the same `printSheet` helper (`src/app/lib/print.ts`).

## Not in this note

Owner and review date (issue 60) are extra fields on this card, specified in that note. This file stays valid without them.
