# Shellback roadmap

Status as of 2026-10-24. Phases are ordered by what unblocks the next thing; each one ships as its own PR and leaves `main` green on the Windows self-hosted runner.

Legend: ✅ shipped · 🔧 in progress · ⏳ planned · 🚫 explicitly not in scope for Shellback

## Phase A — Galaxy v2 and visual polish ✅

| Item | Status | Notes |
|---|---|---|
| Deterministic d3-force layout (13 clusters on an ellipse, settled once, never drifts) | ✅ | `src/app/viz/galaxy-model.ts` · same map for every profile |
| Pan / zoom with wheel + drag, **Fit** button, zoom-aware hit testing | ✅ | d3-zoom; star drags still nudge linked neighbours |
| Label plates with halo, density-aware (labels appear as you zoom in or when a cluster is sparse) | ✅ | |
| Stronger encoding: confirmed = solid star + glow, suggestion = amber dashed ring, pathway = faint grey | ✅ | |
| "Show nearby pathways" ghosts (off by default; Confirmed view still shows exactly your attestations) | ✅ | ghosts use `.sky-ghost-node`, never `.sky-skill-node` |
| Arrow-key navigation between stars, Enter/Space selects | ✅ | |
| Domain hubs show confirmed / suggested counts | ✅ | |
| New brand mark (five-star constellation tracing an S) + favicon | ✅ | `src/app/components/ShellbackMark.tsx` |
| Home hero decoration no longer clips off the page | ✅ | |
| Spider web "confirmed floor" ring | ✅ | |
| `TrustChip` ("Self-reported ⓘ" etc.) replacing repeated disclaimers | ✅ | `src/app/components/TrustChip.tsx` |

## Phase B — Configurable intelligence ✅

| Item | Status | Notes |
|---|---|---|
| Program → **Intelligence** tab: provider selector, Local rules default | ✅ | |
| Remote provider settings (endpoint, model, token) stored **encrypted at rest** with a passphrase; never exported | ✅ | AES-GCM via existing `core/crypto` |
| Plain-language "what leaves this workstation" disclosure, mirrored on Trust & data | ✅ | |
| Connection test with a synthetic payload, result shown inline | ✅ | |
| CSP `connect-src` is `'self'` in the shipped build; a remote host must be added at build time (`SHELLBACK_INTEL_HOST`) so a misconfigured browser cannot leak data | ✅ | `tools/build.mjs` |
| Provider contract documented (`docs/INTELLIGENCE_PROVIDERS.md`) | ✅ | |
| Organization AI endpoint / enterprise data-platform adapter implementations | 🚫 | Owned by the program's AI integration lead; Shellback only exposes the seam |

## Phase C — First intelligent features ✅

| Item | Status | Notes |
|---|---|---|
| Résumé extraction v2: `.docx` and `.pdf` text intake in the browser | ✅ | docx via zip+XML, PDF text layer only (no OCR) |
| Model-proposed skills appear as amber suggestions, same confirm/dismiss flow | ✅ | provider `scanResume` → `ScanResponse` |
| Taxonomy mapping of free-text skill names (local fuzzy match; provider may improve) | ✅ | `core/mapping.ts` |
| Supervisor **Team brief**: aggregate-only inputs shown verbatim before anything is sent, never names or ranks a person | ✅ | Local rules writes a deterministic brief; a remote provider can rewrite it |
| Evaluation set for provider quality (gold résumés → expected skills) | ⏳ | after a real provider exists |

## Phase D — Contribution preferences, round two ✅

| Item | Status | Notes |
|---|---|---|
| Vendor-neutral results import (CSV / JSON: stage, energy) | ✅ | no trademarked names anywhere in code or UI |
| Team workshop printable view (stage map + prompts) | ✅ | `window.print()` with print stylesheet |
| Stage-aware suggestions in Missions (who is energized by the stage a requirement needs) | ✅ | aggregate + consent scoped |

## Phase E — Credential lifecycle, accessibility, themes ✅

| Item | Status | Notes |
|---|---|---|
| Edit credentials in place; issue date; verifier; provenance (`claimed` / `reviewed` / `verified`; *expired* derived from dates) | ✅ | additive schema fields, peer cards unchanged |
| An enterprise data platform as an authoritative credential source: adapter design only | ✅ | `docs/INTELLIGENCE_PROVIDERS.md` § Authoritative sources |
| Accessibility pass: names on every control, contrast ≥ 4.5:1 in both themes, keyboard-only e2e | ✅ | |
| Light theme (system or manual) | ✅ | `data-theme` on `<html>` |
| Printable capability summary | ✅ | Profile → Skills → Print summary |

## Phase F — Contribution framework v2 ✅

Replaced the single energizing/neutral/draining answer per stage with two axes — **energy** (drains ↔ energizes) and **fluency** (how practiced) — giving four honest quadrants per stage: Flow, Growth edge, Grind (good at it, costs you), Avoid/pair. Optional context tags and a one-line recent example per stage. Team views read out quadrants, aggregate and consent-scoped. Today's answers map onto the energy axis, so nothing is lost.

## Later

- Multi-workspace / role switching for supervisors who are also employees.
- Signed peer cards (detached signature, local trust list).
- Import from HR systems once an authoritative feed is approved.
- Localisation.

## Guardrails that do not change by phase

- No score, rank or readiness is ever computed for a person.
- Nothing leaves the workstation unless the user exports a file or has knowingly configured a remote provider.
- Suggestions are never shown as skills until the employee confirms them.
- Team views are aggregate-only and respect per-field consent.
