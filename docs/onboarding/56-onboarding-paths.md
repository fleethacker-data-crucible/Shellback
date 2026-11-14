# Onboarding paths

Design note for https://github.com/fleethacker-data-crucible/Shellback/issues/56. This file is the contract. It does not add the screen. The idea came from a FleetHacker 2026 toolkit that has no license, so this note uses Shellback's own words and does not copy that toolkit's templates.

A path is a local JSON file for one platform (for example a data platform or a learning environment). It lists that platform's tasks in four groups. My profile → Growth shows the path for the platform the person picked, and hides tasks whose skills they have already confirmed. Nothing about the person leaves the browser.

## Where it sits

- Import the file the same way other workspace JSON is imported: read it in the browser, validate it, and keep it on the workspace. A bad task is skipped with a warning. A bad file is refused.
- Confirmed skills are `profile.confirmed` (`src/core/schema.ts`). A task is hidden when every skill id it lists is in that array.
- The 104 skill ids are the ones in `src/core/taxonomy.ts`. Unknown ids are dropped, not refused.
- Storage stays in this browser (IndexedDB). The path is not sent to a provider, and it is not put on a peer card unless a later note says so. This note does not.

## File

`format` is `shellback-onboarding-path`. `version` is `1`.

| Field | Limits | Required | Notes |
|---|---|---|---|
| `format` | the text `shellback-onboarding-path` | yes | Anything else is refused. |
| `version` | the number `1` | yes | |
| `id` | 8 to 70 characters: letters, digits, `-` | yes | Re-importing the same id replaces that path. |
| `platform` | text, at most 80 characters | yes | The name the person sees, such as "Weekly metrics". |
| `summary` | text, at most 400 characters | no | One line about the platform. |
| `tasks` | list, at most 200 | yes | See below. |

Each task:

| Field | Limits | Required | Notes |
|---|---|---|---|
| `id` | 1 to 64 characters | yes | Unique inside the file. |
| `title` | text, at most 160 characters | yes | |
| `group` | `now`, `next`, `later`, or `restricted` | yes | **Now** is first-day work. **Next** and **Later** follow. **Restricted** needs approval, a separate role, or supervision, and the screen says so. |
| `skillIds` | list of skill ids, at most 12 | yes | At least one known id must remain after unknown ids are dropped. |
| `cardId` | text, at most 64 characters | no | Optional link to a task card (issue 58). Ignored until that card exists. |

## What Growth shows

The heading is "Your path", with the platform name. Tasks are grouped Now, Next, Later, Restricted, in that order. A task whose skills are all confirmed is omitted. When every task is omitted, the page says the confirmed skills cover this path. Restricted tasks stay visible until their skills are confirmed, and each one is labelled restricted.

The page does not score the person, rank the tasks they have left, or send the path anywhere.

## Not in this note

Learner tracks (issue 57), task-card text (issue 58), sign-off (issue 59), owner and review date (issue 60), and team counts (issue 61) are separate notes. This file stays valid without them.
