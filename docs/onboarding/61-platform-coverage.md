# Platform coverage, aggregate only

Design note for https://github.com/fleethacker-data-crucible/Shellback/issues/61. This file is the contract. It does not add the screen. Wording here is Shellback's own. It does not copy an unlicensed toolkit.

Team coverage can say, for a path task, how many people who opted in have each sign-off level. The example shape is "3 of 8 analysts can run the weekly metrics pipeline on their own." The sentence names the task. It does not name, rank, or score a person.

## Who is counted

Same people as Team → Coverage today (`src/core/analytics.ts`):

- Confirmed skills are counted only when the person opted in to team coverage.
- A sign-off level is counted only when they also granted `signoff` (issue 59). A hidden sign-off, including one hidden because the skill was withdrawn, counts as no sign-off.
- Drafts stay out unless the team includes drafts, and drafts have no sign-off.
- Counts are shown only when at least `MIN_AGGREGATE` (3) people are in the set. Below that, the page says the count is hidden, as coverage already does.

Levels, from issue 59: `with-help`, `on-their-own`, `common-variations`. A person is in at most one current level per skill. The task's count for a level is the number of opted-in people whose current sign-off on every skill the task lists is that level or a stronger one, with this order: `with-help` < `on-their-own` < `common-variations`. "On their own" therefore includes people recorded at `common-variations`. The screen says that in the column heading, not as a score.

The denominator is the number of opted-in people in the set, not a headcount from outside Shellback.

## Roll-up

Organisation codes already nest by prefix (`src/core/org.ts`). Platform coverage uses that tree. A unit's count is the opted-in people in that unit and its children, still subject to the minimum of 3. Selecting a unit the person cannot fill to 3 shows the parent, the same way domain coverage does.

## Supervisor brief

`src/app/views/TeamBriefPanel.tsx` builds the brief from aggregate numbers only. When the minimum is met, the brief may add one sentence per path task that has zero people at `on-their-own` (including the stronger level). The sentence names the platform, the task title, and the zero count. It does not list names, org codes of one person, or a ranking of tasks by person.

The inputs disclosed before generation gain one row: "platform tasks with no on-their-own sign-off (task titles and counts)". That row is aggregate. It is omitted when the minimum is not met.

## Not a readiness system

These counts are self-reported sign-offs among people who opted in. They are not a staffing decision, a qualification, or a judgement of anyone who is absent from the count.
