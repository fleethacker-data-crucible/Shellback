# Demo walkthrough (synthetic data only)

A script for a short demo video. Every person in it is fictional, and every file is in `examples/`. Do not use a real résumé, real peer card or real HR data for a recording.

## Before you record

1. Build or open the app. Either `Launch-Shellback.bat` (served edition, opens at `127.0.0.1`) or `dist/Shellback-Standalone.html` in a browser (standalone edition, no server).
2. Start from an empty browser profile, or use *Program → Trust & data* to see where the data lives and clear it.
3. Have these files ready: `examples/resumes/*.pdf` (five fictional résumés), and `examples/employees/*-peer-card.json` (four fictional cards).

## 1. What the app is (30 s)

Home shows a journey with the steps still to do. It says what it does not do: nothing is scored, ranked or certified, and nothing leaves the workstation unless you export a file or configure a provider on purpose.

## 2. A fictional employee (60 s)

Choose **Try a fictional employee**. The app loads one of four synthetic workspaces: Morgan Vale (shipyard maintenance planner), Riley Chen (compliance analyst), Jordan Brooks (data and cloud engineer), Casey Rivera (training lead). Show the Home journey and the capability web.

## 3. Intake: from résumé to confirmed skills (90 s)

1. My profile → Intake. Import one of the sample PDFs. Text is read in the browser and is not stored.
2. Suggestions appear as amber items. Confirm one, dismiss one. Point out that nothing becomes a skill until the employee confirms it.
3. Credentials: a held credential is suggested; one being pursued is not.

## 4. Confidence, without a score (45 s)

Open a confirmed skill's confidence drawer. Confidence is the employee's own answer, not a grade. The summary counts skills and domains and says it is self-reported.

## 5. Explore (45 s)

Explore → the spider web (domains as spokes, confirmed skills as shape), then the galaxy. Use the arrow keys to move between stars.

## 6. Team, with consent (90 s)

1. Team → Roster & sharing. Import the four peer cards from `examples/employees/`. Show that each card lists only what its owner chose to share.
2. Coverage appears once at least three people have shared. It is aggregate. Show the supervisor brief and the line "Written from the aggregate numbers below and nothing else".
3. Missions and Mentors show the same consent rule.

## 7. Program: what leaves the workstation (45 s)

Program → Trust & data lists every task and what it sends. Program → Intelligence: Local rules is the default and sends nothing. Say that a remote provider is set up in four steps and is shown in the same table before anything is sent.

## 8. Export and import (45 s)

Export my workspace: plain JSON, or encrypted with a passphrase. Say that an export is the employee's file to protect. Import it back to show the round trip.

## Close (15 s)

Repeat the three limits: no scores or rankings, no certification, and no data leaves unless the person exports it or configures a provider.

## Features in open pull requests

Do not show these in the recording until their PRs are merged, because they are not on `main` yet: voice summary and dictation (#42), HR feed import (#43), role switching in the Team view (#46), signed peer cards (#32), the Fairlead router preset (#38), and the evaluation set (#31). Check the current `docs/ROADMAP.md` before recording.
