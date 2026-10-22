# SYNAPSE · Workforce Capability Intelligence

**Version 0.6 — attested-capability spider web, confidence shine, focused galaxy and fictional employee lab**

Synapse is an employee-centered capability discovery and development prototype. It separates résumé claims, confirmed skill interests, task-level confidence, execution mode, recent voluntary activity, and self-entered credentials. No single hidden proficiency rating is created.

## Run

1. **Fastest:** download and double-click `Synapse-Standalone.html` (one file, all code embedded).
2. **Development edition:** download/extract the repository or `Synapse-MVP.zip`, keeping `index.html` beside `src`. Open `index.html` in a recent Edge, Firefox, or Chrome browser.
3. On **My capability profile**, use the synthetic example, explicitly confirm suggested skills and save an optional confidence pulse. Open **Workforce tools** to explore the complete five-module toolkit.

**No installation, package manager, internet, PowerShell, server, account, or admin privileges required.** All JavaScript and CSS are local. `index.html` should remain beside the `src` directory. If your browser policy blocks local scripts or localStorage from `file:` pages, serve the directory using an **approved** local hosting mechanism; do not bypass workstation restrictions.

## Features

- 13 capability domains and 104 task-oriented skills
- **Attested-capability spider web:** confirming a capability adds a visible web spoke; attested breadth controls its extent, while an optional confidence pulse (0–4) increases glow and node prominence. Unanswered attested skills remain visibly unrated.
- **Profile-focused galaxy:** 13 domains and 104 skills are available before onboarding or in Explore-all mode; after attestation, unrelated clusters are hidden by default. Hover only displays labels; click-hold-drag moves nodes and connected neighbors.
- Radar with domain drill-down and unknown/missing-confidence behavior
- 104-node SVG skill graph, domain/search filtering and task details; star luminosity encodes only self-reported confidence (0–4); unanswered tasks remain neutral
- Plain-text résumé upload is scanned automatically. Amber candidates update the radar and galaxy immediately; employee confirmation turns them mint. Confidence remains separately self-reported.
- **Attested-only confidence pulse:** employees can choose only confirmed skills to rate; earlier responses to withdrawn attestations remain local but are hidden from web and confidence counts. Independent, guided and approved-AI-assisted execution stay distinct.
- Editable, unverified credential inventory with date horizon
- Multiple local team workspaces, manual consent-based peer-card JSON export/import, optional survey disclosure, named opt-in roster, priority skills, coverage gaps and self-reported independent bench signals
- **Four fictional employee workspaces and peer cards** in [`examples/employees/`](examples/employees/README.md), plus a one-click persona selector to compare full local spider webs and galactic clusters
- A distinct fictional six-person demonstration team and a minimum-three-person threshold for aggregate displays
- **FLEETHACKER lab:** TEAMFORGE-inspired mission team composer, MENTORLINK opt-in mentor discovery, and KNOWLEDGE RELAY single-contributor knowledge watchlist
- **FLEETHACKER workforce:** five modules with local training guides, study history, capability heatmaps, mission requirements, voluntary mentoring and owner-reviewed knowledge records
- Adoption- and overlap-aware ROI calculator with cash vs noncash separation, cash-only net after cost, and three scenario sensitivity levels
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

## Spider web, confidence, and galaxy — accepted behavior

**Confirmation puts a skill on the spider web.** The web is a connected radial profile of **employee-attested capabilities**, not a confidence-only radar plot. Its spoke extent reflects how many relevant skills have been confirmed in that domain; confirmed skills that have not been rated still have a visible, neutral node. **Confidence makes a skill shine:** separately self-reported 0–4 task confidence increases a node's brightness, glow, stroke and modest radial prominence. Zero confidence stays visible but subdued, and missing confidence is unknown—not low proficiency.

**Only attested skills may be rated.** Before confirming any capability, the confidence task selector and save button are disabled. The dropdown subsequently contains *only* skills in the employee's confirmed list. Removing a skill removes it from the spider web and hides its prior confidence from visualization, without silently deleting the locally retained response.

**Résumé upload updates the visuals immediately.** Amber outlined suggestions show unreviewed keyword matches outside the attested web. Confirming a suggestion changes it to mint and updates spider shape automatically, as does manually adding a skill. The **Refresh spider web** button is a manual redraw for reassurance; no navigation or reload is required.

**The galaxy focuses after onboarding.** Before a profile has experience signals, all 13 domain clusters are available for exploration. With résumé suggestions but no confirmed skills, it initially displays suggested domains. Once the employee has confirmed one or more skills, **only those attested domains are visible by default**, with other skills in those domains retained as exploration opportunities. Use **Visible universe → All 13 domains** to reveal the full taxonomy again. Hover never moves nodes. Only click-hold-and-drag creates mild movement along connected branches.

**Compare fictional employees.** Under **My capability profile**, select Morgan Vale (shipyard planning), Riley Chen (cybersecurity), Jordan Brooks (data/cloud engineering), or Casey Rivera (training/knowledge transfer). They are synthetic, not real accounts. The repository ships full workspace and peer-card JSON for each, with a detailed [import/export guide](examples/employees/README.md). The preexisting generic synthetic profile remains available separately.

## Login and local workspace boundaries

The offline Synapse MVP never had an authenticated login. Local browser storage, employee-owned profile entries and opt-in peer-card exchange are not accounts. The interface explicitly says **Local demo · No login**. True enterprise login would require an approved identity provider (such as an authorized organizational SSO/CAC integration), backend account storage and server-enforced access controls. No fake PIN/password screen is presented as security.

## FLEETHACKER workforce intelligence lab

The earlier **FLEETHACKER 2026** project conversation surfaced several workforce ideas: SKILLFLEET, TEAMFORGE, MENTORLINK, KNOWLEDGE RELAY, and QUALFORGE. Synapse is the common capability-intelligence layer for those ideas, not five separate apps.

The Team Intelligence screen now includes three offline, synthetic-first planning modules:

1. **Team composer (TEAMFORGE):** choose a potential team from voluntarily imported peer cards; set mission-relevant capability needs and see declared coverage, single-source concentrations, and separately disclosed independent task reflections. No hidden individual fitness score.
2. **Mentor discovery (MENTORLINK):** find peers who explicitly shared a relevant skill; show whether they *also* volunteered task-level confidence and execution mode. A match is only a lead for a voluntary mentoring conversation, not an assignment.
3. **Knowledge relay:** review unrepresented and one-person-held priority skills as potential documentation, pairing and cross-training opportunities. No predictions about retirement, attrition, performance, or readiness.

The existing credential desk is an initial QUALFORGE foundation and the team aggregate covers SKILLFLEET's high-level capability mapping. Verified qualifications, mentoring opt-in workflows, real-time team synchronization, and operational staffing eligibility require an approved authenticated enterprise deployment.

## FLEETHACKER workforce suite (all five concepts)

The **FLEETHACKER workforce** navigation section connects the five projects from the original FLEETHACKER 2026 ideas discussion into one local-first workspace:

| Concept | Implemented offline workflow | Data boundaries |
| --- | --- | --- |
| **QUALFORGE** | Local conversion of approved nonsensitive numbered PQS-style outline excerpts into unreviewed draft study cards; employee-authored reference answers required before practice, plus interactive knowledge checks, scenario prompts, practice/review history and revisit counts | Does **not** read classified PQS files, validate practical demonstrations, create qualification sign-offs or use an AI endpoint. Guides must use explicitly authorized, nonsensitive material. |
| **SKILLFLEET** | Aggregate 13-domain capability coverage, single-contributor indicators, voluntary growth goals, credential renewal horizon | Opt-in experience mentions are not verified skills; credential entries are self-declared. Aggregate coverage requires a minimum of three consenting profiles. |
| **TEAMFORGE** | Requirements editor with minimum skill contributors and optional qualification text; mission roster checkboxes; compare coverage, disclosed availability and optional unverified credential claims | No assignment decisions or validated credential matching. Unknown availability remains unknown. A peer must expressly include qualification fields in their exported card. |
| **MENTORLINK** | Mentor opt-in, topics, availability and introduction; searchable willing-mentor directory; contextual outreach draft | A shared skill is **not** mentoring consent. Mentoring fields require additional deliberate peer-card disclosure. |
| **KNOWLEDGE RELAY** | Structured interview/capture (context, practice steps, next handoff and source), searchable drafts, owner-marked review status, knowledge-concentration watchlist and export of reviewed-only records | Owner-marked reviewed is **not** authoritative publication approval or document validation. No hidden scraping, AI interview or unrestricted collection. |

Previous lightweight team-intelligence prototypes remain under **Team intelligence** for comparing candidate rosters, viewing potential mentors, and spotting single-contributor knowledge. The expanded workforce section provides persistence, editable training content, mission constraints, voluntary mentoring disclosures, and controlled transfer records.

### Sharing across machines

No server is needed: coworkers individually opt in, export Synapse peer JSON cards and hand them over through an approved medium. Every card shares only employee-reviewed skill mentions by default. Separate **unchecked** checkboxes allow additional disclosure of task confidence, mentoring offer/topics/availability, and self-entered credential names. These claims are clearly unverified; imports sanitize known fields and the sender cannot revoke already distributed copies.

The workspace JSON backup also preserves guides, study history, mission needs, voluntary mentoring plans, growth goals, draft/owner-reviewed knowledge records, and the imported peer details with field-specific disclosure.

## Create and exchange team profiles

1. Confirm personal experience mentions in My capability profile, and optionally complete task-level confidence pulses.
2. Open Team intelligence and **create a new team**. The default synthetic demonstration cohort is clearly labeled and distinct from new teams.
3. Each peer deliberately exports their own JSON capability card with a chosen display name. Cards include employee-confirmed experience mentions by default; sharing confidence and execution method requires a separate unchecked opt-in and a confirmation prompt.
4. Transfer files outside Synapse using an approved channel. Import each opt-in peer card into the chosen team. Matching peer identifiers refresh existing imported entries.
5. Once a team contains at least three consenting contributors, view aggregate domain coverage, skill concentrations, priority gaps, and optional self-reported independent-execution bench signals (confidence at least 3 and method independent). These are planning prompts, not proof of qualifications.

**Privacy caveat:** This MVP has no live multi-user service, authentication, file recall/revocation, secure sharing, or server-side permissions. Previously shared files remain with the recipients. Identity displayed on a card is self-declared and unverified. Do not use real Navy personnel data, sensitive resumes or CUI in this demonstration.

## ROI calculation: separating cash from recovered capacity

Modeled cash savings: adopting participants × annual duplicate training spend × training avoidance percentage, plus outside specialist spend × external spend avoidance percentage × adoption. Actual avoided expenditure must be independently established; training spend must exclude labor being counted elsewhere.

Modeled training capacity: adopting participants × training hours × loaded hourly rate × training avoidance percentage. Modeled workflow capacity: adopting participants × weekly recovered minutes / 60 × weeks × loaded hourly rate × realized time percentage.

The calculator deducts overlap percentage × the smaller of training and workflow capacity to avoid double-counting time. The **scenario economic potential** is cash plus adjusted noncash capacity; it is not all cash savings. **Cash-only net** = cash savings minus annual operating cost, and the benefit/cost ratio uses cash alone. A three-scenario adoption sensitivity displays cash-only net for lower, base and higher adoption.

Prior proposal audit: 55 minutes × 100 people × 46 weeks × $75/hour × 70% = $221,375 (before adoption and overlap), not the $144,375 quoted in the old draft.

## Development / testing

Tests in `tests/smoke_test.py` exercise navigation, résumé intake/confirmation, survey persistence, attested spider web / profile-focused galaxy, galaxy focus and drag-only navigation, employee-persona loading, local team creation, peer-card exchange, credentials and ROI recalculation. If Python and Playwright are available **on a development workstation** (not required for the end users), run:

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