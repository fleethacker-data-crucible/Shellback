# Fictional employee exchange lab

Every person below is **completely fictional**. Names, experience, credentials, confidence answers, availability, and training claims are invented for testing. None represents an actual Navy employee, qualification record, background check, or validated competency.

| Fictional employee | Scenario | Confirmed skills | Workspace files |
| --- | --- | ---: | --- |
| Morgan Vale | Shipyard maintenance and work-package planning | 11 | `morgan-vale-workspace.json`, `morgan-vale-peer-card.json` |
| Riley Chen | Cybersecurity, identity, defensive risk work | 11 | `riley-chen-workspace.json`, `riley-chen-peer-card.json` |
| Jordan Brooks | Data engineering, cloud, BI, automation | 12 | `jordan-brooks-workspace.json`, `jordan-brooks-peer-card.json` |
| Casey Rivera | Training, mentoring, knowledge transfer | 12 | `casey-rivera-workspace.json`, `casey-rivera-peer-card.json` |

## Try the visualizations

Open Synapse (`Launch-Synapse.bat`, or `dist/Synapse-Standalone.html`). Go to **My capability profile** → **Try a different fictional employee**. Choose a person and select **Load fictional profile**. The app replaces the local workspace after you confirm in the dialog, then opens their **skills spider web**. Different attested capabilities create different web shapes. The included self-reported confidence answers change individual web-node brightness and size; unanswered but attested skills remain visible. The **skills galaxy** now displays only domains relevant to that employee by default, with an explicit **All 13 domains** option.

Switch employees to compare their self-reports. The selector is for a **local simulation only** and is not an authenticated personnel account switcher.

## Simulate full workspace import/export

You can also export a backup from **Trust & governance** → **Export JSON backup** (optionally passphrase-encrypted), then click **Import data** in the top toolbar and select a `*-workspace.json` example from this directory. This **replaces** the local workspace after confirmation, so back up any work you wish to preserve. A full workspace includes confirmed skills, self-reported task confidence, unverified self-entered credential examples, and optional résumé suggestions.

## Simulate consent-based peer-card exchange

1. Open **Teams & sharing** and create a new team.
2. Use **Import peer card** to select the `*-peer-card.json` for Morgan, Riley, Jordan, or Casey.
3. Import at least three distinct fictional cards to unlock minimum-size team coverage views.
4. Click a peer to see what was shared, and inspect Team composer and the workforce planning tools.
5. Optionally select a fictional profile under **My capability profile**, go back to **Teams & sharing**, set a display name, choose any *additional sharing* checkboxes intentionally, and click **Export peer card**. The exported JSON is a separate, employee-controlled card that can be imported into another team.

The provided peer-card fixtures **explicitly simulate** consent to share competence mentions, optional self-report data, mentor opt-in, and unverified credentials. Real profiles must never have these fields released by default. No imported profile establishes actual qualification status, identity, readiness, or availability.

> These workspace files use the original v1 format on purpose. Synapse upgrades them to the v2 schema on import, so they also serve as the migration test fixtures (`tests/unit/schema.test.ts`). The app bundles these same files as its in-app personas, so the two can't drift apart.
