# Synapse — end-to-end product and technical audit

**Date:** 2026-10-22  
**Scope:** source, workflows, local persistence, privacy model, interaction design, offline packaging and browser tests.  
**Status:** practical implementation review of the current local-first MVP; **not** an independent security assessment, approved operational deployment, or authoritative qualification audit.

## Executive assessment

Synapse has a coherent foundation: employee-controlled experience attestation, an attested-skills spider web, explicit potential learning pathways, a simple local-first exchange model and five planning/development modules. But it is still a broad feature prototype rather than a validated enterprise system. The main risk is **interpreting employee-created signals as proof of readiness or qualification**. The largest design problem is navigation fragmentation: people must bounce across résumé intake, confirmed skills, a separate spider web, confidence pulse, credential desk, team lab, and overlapping FLEETHACKER workflows.

The recommended organizing principle is one traceable employee journey:

**Experience intake → Pending suggestions → Employee attestation → Optional confidence reflection → Credential review → Share by explicit consent → Team planning / learning.**

Each signal needs clear source, status, correction and consent boundaries.

## Implemented in this review branch

| Area | Prior behavior | Change |
| --- | --- | --- |
| Credential extraction | Résumé keyword scan looked exclusively for taxonomy skills | Local recognition of a conservative catalog of common IT, cloud, project and military warfare qualification terms; canonicalized suggestions, not automatic credentials |
| Credential correction | New entries were entirely manual | Matched résumé phrase is shown; employee must open **Review & edit** and explicitly save or dismiss; avoids duplicates, no invented expiry |
| Credential privacy | Intake did not expose credential extraction status | Only matched phrase and canonical reference are stored, never a résumé paragraph; raw résumé text stays in the input field, not in workspace JSON |
| Confidence pulse placement | Multi-field pulse was wedged beside résumé entry | Moved to contextual sidebar on the **Skills spider web**, with a direct action from each confirmed skill and an option to progress to the next unrated skill |
| Visualization connection | Skill detail opened the old profile survey location | Spider-web and galaxy reflection shortcuts open the new contextual pulse |
| Import/export | Only credentials already added manually were persisted | Sanitized pending credential suggestions and dismissals participate in local workspace backup |
| Test coverage | No credential review flow or pulse-context regression | Browser tests cover detection → human review → save, duplicate rejection, dismissed suggestions, and spider-web reflection |

**Important limitations of the new extractor:** it works on pasted or uploaded **plain text only**, uses a deterministic catalog (not a complete credential ontology), can miss aliases and can produce ambiguous suggestions. Future/pursuing phrases are filtered only heuristically. Suggested credentials are neither verified nor assumed to be currently held. No issue or expiration date is derived from the résumé.

## Detailed findings and roadmap

### P0 — must address before use with real personnel data

1. **Authentication and data protection.** The standalone app does not have authentication, server roles, revocation, device encryption, or secure multiuser separation. `localStorage` is readable by other users of the same browser profile. Never represent the offline demo as a protected personnel system. For a real pilot, design an approved identity/smart card/SSO path, encryption, authorization, audit, retention, controlled backups and deployment approval.
2. **Evidence integrity.** Confirmed skills, self-rated confidence and self-entered credentials are not independently verified. Create evidence objects with `asserted_by`, `source`, `reviewed_by`, dates, status, revocation, and verifiable authority. Distinguish **claimed / reviewed / verified / expired** at every layer; do not use a single readiness score for personnel actions.
3. **Consent / secondary use.** Explicitly define what an export reveals, who is allowed to re-share it, whether colleagues can refuse participation, and how corrections/withdrawals are handled. Current files can be retained indefinitely after export and cannot be remotely recalled.
4. **Approved data boundary.** Text field + JSON export are unencrypted data paths. Do not import sensitive operational records or other sensitive or regulated data until the hosting, authorization and storage design is approved.

### P1 — high-value product changes

1. **Improve résumé import coverage.** Current experience and credential detection accept only `.txt`/pasted text. Add offline, locally bundled, audited PDF/DOCX text extraction with testable parsing and a preview of what was extracted. Avoid OCR and AI-based guesses by default; never silently promote extracted text into evidence. Provide a clearly bounded confidence/ambiguity warning and user correction.
2. **Credential inventory lifecycle.** Add edit-in-place, validation of issuing organization and date, issue date, renewal status, attachment/reference pointer, verifier and source provenance. Extend aliases with an approval-reviewed versioned catalog. Do not infer expiration or certification solely from training attendance.
3. **Consolidate onboarding.** A single guided workflow should show current stage, pending suggestions, confirmed skills, unrated confirmations, and credentials awaiting review. Move employee actions close to the visualization; avoid proliferating new navigation tabs.
4. **Simplify navigation and FLEETHACKER overlap.** The main navigation has nine top-level destinations. The five workforce tools overlap with older Team Intelligence composer/mentor/relay widgets. Provide a task-first home, use shared data and one canonical implementation for each workflow, and avoid duplicate controls with subtly different semantics.
5. **Credible team planning.** TEAMFORGE currently compares self-declared skill mentions, optional availability and unverified credential names; it does not know staffing authority, task eligibility, rosters, clearance/safety constraints, or authoritative qualifications. A real team plan needs explicit constraints, source confidence and a person-in-the-loop approval step.
6. **Accessibility.** Keyboard navigation needs independent regression testing for SVG skill selection, focus visibility, menus, forms, hover tooltips, reduced motion, contrast, browser zoom and phone widths. The graph currently offers pointer dragging and keyboard selection, but not accessible alternatives for all layout manipulations.
7. **Data interoperability.** Define a portable Synapse JSON schema and version migrations rather than relying on a large ad hoc `safeStateImport` sanitizer; keep strict bounds, dates, deduplicated IDs, content encoding and transparent import conflicts. Add adapters for approved external credential and training systems instead of scraping.

### P2 — quality, maintainability and scale

1. **Break up the monolithic client.** `src/app.js` is responsible for taxonomy, view routing, surveys, résumé rules, state, credentials, ROI and more. Extract testable pure modules and a stable UI controller with shared schemas. Retain a generated single-file offline distribution for constrained workstations.
2. **Create realistic multi-user simulations.** The four fictional workspaces are useful, but add edge cases: no attested skills, 3 skills in one domain, conflicting candidate evidence, duplicate/expired self-entered credential, withdrawn consent, mentor opt-out, malicious JSON and corrupted backup.
3. **Expand tests.** Add parser unit tests, schema migration tests, import/export round-trips, keyboard-only flows, visual screenshots for spider/galaxy, browser storage quota failures, and performance budgets. PR browser CI is a strong start, not a complete quality gate.
4. **Improve ROI credibility.** The model correctly distinguishes cash avoidance from the monetized value of reclaimed time, but its assumptions lack evidence receipts and uncertainty bounds. Add per-assumption source, baseline measurement, owner, realization method, and scenario notes before presenting organizational savings.
5. **Visual brand consistency.** A new Synapse mark has not been selected; do not ship an arbitrary replacement. Once the owner chooses a direction, create a small, scalable SVG with a one-color fallback and tested dark/light accessibility.
6. **Knowledge Relay governance.** Local owner-marked review does not establish publication approval. Add content ownership, retention, disposition, approval workflow and source-specific access restrictions; keep potentially sensitive shipyard/watchstander records out of the uncontrolled MVP.
7. **Enterprise integration architecture.** Arc / credential stores, LogHawk, MailHawk, training and work item systems should connect via explicit permissioned adapters, not implicit cross-app localStorage access. Design a permission contract, data classification label, consent and logging for each integration.

## Suggested next implementation sequence

**Phase 1 — complete employee onboarding:** robust supported-file intake; unified review queue; credential edit/dedup; contextual pulse actions and data import round-trip. Validate with the fictional employee fixtures and volunteer usability sessions.

**Phase 2 — evidence model and controlled sharing:** standardized event/evidence schema, migration, provenance statuses, stricter privacy controls and a separate demo persona context.

**Phase 3 — unified workforce experience:** consolidate redundant team/mentor/knowledge modules; use one task-first workflow; explain constraints and data coverage; add a review-friendly intelligence report.

**Phase 4 — authorized enterprise pilot:** approved identity integration, actual secure storage, role-based access, immutable audit, synchronization/conflict behavior, and source-of-truth qualification verification. Do not skip governance or authority boundaries.

## Acceptance checks for this branch

- A pasted synthetic résumé containing AWS Solutions Architect Professional, CompTIA Security+ and PMP produces **three pending suggestions** and **zero new saved credentials**.
- Mention of **pursuing CISSP** is not automatically suggested as a credential held.
- The employee reviews a pending suggestion, may modify the name/issuer/date, and explicitly saves it; the originating suggestion is then removed.
- Exact duplicate credentials are rejected; dismissal survives a same-workspace rescan.
- Confidence pulse no longer occupies the résumé-intake column; selecting a confirmed skill from the profile, spider web, or galaxy navigates to the contextual pulse.
- The existing confirmed-only galaxy, Pathways switch, spider web, teams, FLEETHACKER tools, ROI and standalone distribution continue to work.

## Explicit non-claims

A text match is not proof of credential possession. User approval is not independent verification. A task confidence response is not demonstrated proficiency. "Owner reviewed" is not publication authority. A staffing gap derived from opt-in peer cards is not a verified personnel shortage. Dollar-valued regained time is not necessarily cash savings. These boundaries must remain legible to users and reviewers.
