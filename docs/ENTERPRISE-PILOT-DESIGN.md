# Enterprise pilot: design note (not built)

Status: design only. Nothing in this note is implemented, and none of it is counted as done in `ROADMAP.md`. It was written because the pilot needs real accounts, a real identity provider and managed storage, none of which can be tested honestly from this repository.

## What the pilot adds to today's app

Today Shellback is a single-user, local-first app. The workspace lives in the browser (IndexedDB), and the team tools work on files people export and import. The pilot would add:

1. **Authentication.** Each employee signs in with the organisation's identity provider. Supervisors and employees are different roles on the same account.
2. **Server-side consent.** Today consent is a flag in the workspace and a per-field choice on each exported card. In the pilot, consent is a server record: who shared which field with which team, when, and until when. A revocation removes the field from every team view on the next read, not on the next export.
3. **Managed storage.** Workspaces move from browser storage to an organisation-managed store with encryption at rest and backup under the organisation's policy. The local workspace can still be exported and imported, so nobody is locked in.

## Constraints that do not change

- No score, rank or readiness is computed for a person (ROADMAP guardrails). The server stores what people attested, not a derived rating.
- Team views stay aggregate-only and consent-scoped, enforced on the server, not only in the browser.
- The real remote intelligence provider is owned by others. The pilot consumes the existing provider contract (`docs/INTELLIGENCE_PROVIDERS.md`) and does not add one.
- Locked-down Windows: no admin rights, no installs on workstations. The pilot server is hosted by the organisation.

## Proposed shape

| Piece | Proposal | Why |
|---|---|---|
| Sign-in | OpenID Connect with the organisation's IdP, authorisation-code flow with PKCE, short sessions | Standard, no passwords stored by Shellback |
| Roles | Claims from the IdP map to `employee` and `supervisor`; a supervisor sees team views only for teams they are assigned to | Matches the "role switching" item without a second account |
| Consent | Table of `(person, field, team, granted_at, revoked_at)`; team views query it on every read | Revocation takes effect immediately |
| Storage | One encrypted record per workspace, versioned with the same `meta.rev` the app already uses | Reuses the existing validation (`parseWorkspace`) on read |
| Audit | Append-only log of consent changes and team exports | Lets the pilot prove who saw what |
| Local fallback | Export and import of the encrypted workspace file keep working | No lock-in during the pilot |

## How it could be tested without real accounts

- A local mock OIDC provider in the test harness (a fixed key pair and fixed users, all fictional) to exercise sign-in, token expiry and role mapping.
- Consent tests against an in-memory store with the same interface as the real one, including revocation mid-session.
- A contract test that the server rejects a team query for a field the person has not shared, even when the client asks for it.

None of this has been written. Each item needs a decision from the organisation first: which IdP, who hosts storage, and what retention applies.

## Open questions for Anthony

1. Which identity provider and tenant does the pilot use?
2. Who hosts the store, and under what key management?
3. Is supervisor visibility limited to the assigned team, or to a reporting line?
4. What retention applies to consent and audit records?
