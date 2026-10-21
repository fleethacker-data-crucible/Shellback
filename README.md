# SYNAPSE · Workforce Capability Intelligence

**Version 0.1 — functioning, local-first MVP**

Synapse is an employee-centered capability discovery and development prototype. It separates résumé claims, confirmed skill interests, task-level confidence, execution mode, recent voluntary activity, and self-entered credentials. No single hidden proficiency rating is created.

## Run

1. Download/extract this repository, or download `Synapse-MVP.zip` from the chat artifact.
2. Double-click `index.html` in a recent Edge, Firefox, or Chrome browser.
3. On **My capability profile**, select **Use synthetic example** to test résumé matching, explicitly confirm suggestions, and save a confidence pulse. Try the graph, radar, credential planner, team overview, and ROI lab.

**No installation, package manager, internet, PowerShell, server, account, or admin privileges required.** All JavaScript and CSS are local. `index.html` should remain beside the `src` directory. If your browser policy blocks local scripts or localStorage from `file:` pages, serve the directory using an **approved** local hosting mechanism; do not bypass workstation restrictions.

## Features

- 13 capability domains and 104 task-oriented skills
- Radar with domain drill-down and unknown/missing-confidence behavior
- 104-node linked SVG knowledge graph, domain/search filtering, node details
- Plain-text (`.txt`) résumé / experience keyword matching to **unverified suggestions**; manual confirmation and removal
- Task-level survey capturing confidence, prior execution, voluntary activity recency, and independent vs approved-AI-assisted vs guided execution
- Editable, unverified credential inventory with date horizon
- Aggregated synthetic team coverage with minimum-participation threshold and an explicit user opt-in
- ROI scenario calculator with transparent formulas and separation of avoided spend versus recovered non-cash capacity
- Local state persistence, JSON export/import/validation, delete/reset controls, no network calls

## Privacy and data semantics

This is a synthetic demonstration. **Do not enter real Navy personnel records, qualification data, sensitive details, clearance information, or actual résumé PII into this pilot on a shared or unapproved workstation.** Browser `localStorage` is not a secure multi-user data store. A changeable navigation tab is not a role-based authorization boundary.

This prototype is NOT an authoritative readiness, competency, credential, personnel, or performance evaluation system. It does not crawl work activity, ingest email or code, track employees, or infer skill decay. Missing data is **unknown**, not low proficiency. It does not implement real external credential verification or automatic AI résumé parsing.

For production: seek sponsor and employee/labor/privacy consultation; define purpose limitations and retention; obtain security approvals/ATO where appropriate; implement identity federation, granular RBAC/ABAC, consent enforcement **server-side**, encrypted managed storage, structured evidence review, auditable corrections/exports/deletions, secure backups, minimum-size aggregation, abuse monitoring, and explicit trust metrics. Do not treat the synthetic cohort as actual workforce data.

## Data model

`localStorage['synapse-mvp-v1']` is a versioned object:

```json
{
  "version": 1,
  "profile": { "confirmed": [], "surveys": {}, "credentials": [], "consent": false },
  "roi": { "employees": 100, "trainingCost": 2000, "trainingAvoidance": 15 }
}
```

- `confirmed`: employee-selected skill identifiers, not verified proficiency
- `surveys[skillId]`: `{confidence:0..4, performed:'never|before|recent', method:'none|independent|guided|ai', note, updated}`
- `credentials[]`: self-entered `{id,name,authority,expiry,created}`, no credential number
- `consent`: whether the person's affirmed skills contribute to an aggregate demo

## ROI calculation

Annual illustrative benefits: `employees × trainingCost × avoidedTrainingPct` + `employees × trainingHours × loadedHourlyRate × avoidedTrainingPct` + `externalSpend × avoidancePct` + `employees × weeklyMinutes / 60 × workingWeeks × loadedHourlyRate × usableTimePct`. Training time and workflow time must refer to separate nonoverlapping work. The recovered hours represent **capacity** and not cash savings. All percentages are entered as 0–100. Cost is subtracted for the illustrative net-benefit view; the ratio is benefit divided by annual operating cost.

**Review note:** the older proposal's example that listed **55 min/week × 100 people × 46 weeks × $75/hr × 70% = $144,375** does not arithmetically reconcile; this tool computes **$221,375** for those exact inputs. No historical assumption has been silently forced to fit a desired total.

## Development / testing

Tests in `tests/smoke_test.py` exercise navigation, résumé intake/confirmation, survey persistence, radar/graph, team sharing, credentials, import/export, and ROI recalculation. If Python and Playwright are available **on a development workstation** (not required for the end users), run:

```shell
python -m pytest tests/smoke_test.py -v
```

## Next steps for a production pilot

1. Formal governance and data dictionary; opt-in/withdrawal semantics and safety review.
2. Government-approved host, authentication, identity, permissions, encryption, retention, and audit.
3. Reviewable evidence objects, authoritative credential integration, corrections, and stewardship workflow.
4. Cohort-specific, minimum-size aggregation and privacy testing; outcome and trust metrics.
5. Accessibility, reliability, threat modeling, and user acceptance with volunteer pilots.

License: prototype source provided as-is for evaluation. Third-party assets: none.