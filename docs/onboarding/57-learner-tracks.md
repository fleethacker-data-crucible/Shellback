# Learner tracks

Design note for https://github.com/fleethacker-data-crucible/Shellback/issues/57. This file is the contract. It does not add the screen. Wording here is Shellback's own. It does not copy an unlicensed toolkit.

A person can pick a track for a platform path: guided starter, independent contributor, supervisor or approver, or administrator. Shellback suggests one of the first two from the 0–4 confidence ratings they already entered. They confirm or change the suggestion. Nothing is assigned to them. The track only changes the order and depth of that path (issue 56).

## Stored with the workspace

On the workspace, next to the imported path, keep:

| Field | Values | Notes |
|---|---|---|
| `pathId` | the path's `id` | One track choice per path. |
| `track` | `guided-starter`, `independent`, `supervisor-approver`, `administrator` | The person's choice. |
| `suggested` | `guided-starter` or `independent` | The latest suggestion. Never `supervisor-approver` or `administrator`. |
| `chosenAt` | `YYYY-MM-DD` | The day they last confirmed or changed it. |

They can change `track` at any time. Clearing it returns the path to the full four groups in issue 56.

Confidence is the optional 0–4 rating on a confirmed skill (`profile.surveys[skillId].confidence`). Withdrawing a skill removes it from `profile.confirmed` and from the rating map, and the suggestion is computed again from what remains.

## How the suggestion is chosen

Use only skills on that path that the person has confirmed and rated. Missing ratings are unknown, not low.

- If they have rated fewer than half of the path's skill ids, suggest `guided-starter`.
- Otherwise take the median of those ratings. Median 0 or 1 suggests `guided-starter`. Median 2, 3, or 4 suggests `independent`.
- Supervisor or approver, and administrator, are choices the person makes because that is the work they do. A rating does not suggest them.

The screen shows the suggestion in a sentence ("Suggested from the ratings you entered: guided starter") and asks them to keep it or pick another track. It does not call the suggestion a score.

## What the track changes

Depth, using the groups from issue 56:

| Track | Groups shown |
|---|---|
| `guided-starter` | **Now** only. When every Now task is hidden because its skills are confirmed, show **Next**. |
| `independent` | **Now** and **Next**. |
| `supervisor-approver` | **Now**, **Next**, and **Later**. |
| `administrator` | All four groups. **Restricted** stays labelled restricted. |

Order inside a group: tasks that are still gaps (a listed skill is not confirmed) come first. Among those, a task whose rated skills have a lower median comes first. Unrated skills do not count as low. Confirmed-only tasks are already hidden by issue 56.

The path file is not rewritten. The track is presentation.

## Not in this note

Sign-off levels, owners, and team counts are issues 59, 60, and 61.
