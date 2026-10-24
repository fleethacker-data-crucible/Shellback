# Synapse architecture (v1.0 rebuild)

## Goals

1. Follow the project [TechStack](../TechStack): built off the workstation, shipped as compiled JS/CSS, all dependencies bundled, no CDNs or runtime network calls, and no admin rights, installers or services on the workstation.
2. One validated data model, one implementation of each business rule, and nothing silently lost.
3. Keep every capability and governance boundary the MVP had, plus fixes for the defects found in the 2026-10-24 review.

## Layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│ src/app            React 19 UI                                           │
│   state/store.tsx    single Workspace document + settings, debounced save │
│   state/actions.ts   business rules as pure mutators (unit-tested)       │
│   components/ui      shadcn-style primitives (CVA + clsx + tailwind-merge)│
│   viz/               SpiderWeb (d3-shape), Galaxy (d3-quadtree hit tests) │
│   views/             nine screens                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ src/core           framework-free TypeScript                             │
│   taxonomy  schema (zod, v1→v2 migration)  scanners  analytics  roi      │
│   crypto (Web Crypto AES-GCM)  share (peer card / export builders)       │
├──────────────────────────────────────────────────────────────────────────┤
│ src/storage        IndexedDB repository (+ localStorage fallback, backups)│
│                    settings (localStorage)  scan-client (Worker + fallback)│
│ src/workers        scan.worker.ts                                        │
└──────────────────────────────────────────────────────────────────────────┘
tools/build.mjs     esbuild + Tailwind 4 compile() → dist/ (served + standalone + sw + manifest)
tools/Serve-Synapse.ps1   PowerShell 5.1 TcpListener on 127.0.0.1 (workstation runtime)
tools/serve.mjs     the same server in Node (CI / build machine)
```

### Data flow

- **Load:** IndexedDB → `parseWorkspace()` → store. The fallbacks are tried in order: localStorage v2, then legacy `synapse-mvp-v1` (migrated, original untouched).
- **Save:** every mutation goes through `update(fn)`, which clones the workspace, applies `fn`, and saves to IndexedDB after a 250 ms debounce. A pending save is flushed on `pagehide` or `visibilitychange`.
- **Validation:** every input from storage, imports or peer cards passes through zod schemas. Bad array elements are dropped one at a time and reported as warnings, and bad scalars fall back to safe defaults. If the stored document is unusable as a whole, it is copied to a `backups` store, the user is told, and the raw copy can be downloaded from Trust & governance → Recovery.
- **Résumé scanning** runs in a Web Worker. The worker is bundled separately and inlined as a Blob URL so it also works from `file://`. If a worker can't start, the scan runs on the main thread.

### Editions

| | Served (`dist/index.html`) | Standalone (`dist/Synapse-Standalone.html`) |
| --- | --- | --- |
| Transport | `http://127.0.0.1:<port>` via PowerShell or Node | `file://` |
| JS/CSS | `assets/app.js`, `assets/app.css` | inlined (`<script type="module">`, `<style>`) |
| CSP `script-src` | `'self' blob:` | `'sha256-…' blob:` (hash of the inlined bundle) |
| Service worker | yes (`sw.js`, cache keyed by build id) | no (not available on `file://`) |
| Storage | IndexedDB per origin | IndexedDB per file origin |

Both editions are built from the same bundle in one build run. `build-manifest.json` records the sha256 of each shipped file, and `npm run build:check` fails when the committed `dist/` differs from a fresh build.

## Where this build differs from the TechStack table

| TechStack item | Status | Reason / path forward |
| --- | --- | --- |
| Launcher `.bat` → `powershell.exe -File` | **Done** | `Launch-Synapse.bat` |
| PowerShell 5.1 + `TcpListener` on 127.0.0.1 | **Done** | `tools/Serve-Synapse.ps1`. CI runs on the self-hosted Windows runner and starts the real script, then checks headers, the assets, a 404 and a path-traversal attempt. The Node twin (`tools/serve.mjs`) serves the browser tests. |
| React 19 + TypeScript | **Done** | strict TS with `noUncheckedIndexedAccess` |
| Tailwind CSS 4 + shadcn-style (CVA, Radix, Lucide) | **Partial** | Tailwind 4, CVA, clsx and tailwind-merge are used. **Radix** and **Lucide** weren't available in the offline build environment: dialogs use native `<dialog>` with focus handling, toggles use native inputs with ARIA, and icons are text glyphs. Adding them later is a drop-in change in `components/ui`. |
| ECharts, React Flow, Motion | **Not used** | Unavailable offline. The two visualizations are purpose-built SVG on **d3** (bundled): the radial web uses `d3-shape`, and galaxy hit-testing uses `d3-quadtree`. Motion is CSS transitions that honor `prefers-reduced-motion` and an in-app setting. If ECharts or React Flow are adopted later, the pure `galaxy-model.ts` and `SpiderWeb` data builders keep the data layer independent of the renderer. |
| Rust → WebAssembly | **Not used** | The heaviest computation is regex scanning of ≤100 KB of text, which runs in a Web Worker in milliseconds. A WASM scanner would replace `runScan()` in `src/workers/scan.worker.ts` behind the same message protocol, with no UI changes. |
| IndexedDB (data), localStorage (settings) | **Done** | `src/storage/idb.ts`, `src/storage/settings.ts` |
| Service workers, Web Workers | **Done** | `public/sw.js`, `src/workers/scan.worker.ts` |
| Web Crypto AES-GCM | **Done** | optional encryption of workspace exports and peer cards |
| DPAPI from PowerShell for secrets at rest | **Not applicable yet** | The launcher holds no secrets. If a server-side secret is introduced, protect it with `[System.Security.Cryptography.ProtectedData]` (DPAPI, CurrentUser scope). |
| C# via `Add-Type`, WinForms/WPF | **Not needed** | No native Windows features are required. |
| Build off-workstation; bundle all deps | **Done** | `dist/` is committed; CI verifies it is reproducible. |

## Review defects fixed in this rebuild

| # | Defect (2026-10-24 review) | Fix | Test |
| --- | --- | --- | --- |
| 1 | Apostrophes in peer names corrupted (`OundefinedBrien`) in the fleet lab | React escapes all text; there is no hand-written escape map | e2e: served flow |
| 2 | Withdrawn skill's confidence still shown in Pathways | `signalFor()` / `visibleConfidence()` require a current attestation | unit + e2e |
| 3 | Consent toggle also leaked credentials, mentoring and availability | `selfParticipant()` shares skills only; separate local opt-ins for mentoring and credentials | unit + e2e |
| 4 | CISA/CSM/PSM false positives | case-sensitive acronyms; ambiguous ones need certification context | unit |
| 5 | `CISSP (in progress)` suggested as held | broader future/in-progress detection before and after the match | unit |
| 6 | Negated skills suggested | negation cues in the same clause suppress the match | unit |
| 7 | Radar labels not keyboard-activatable | Enter/Space handlers, `role="button"` | e2e |
| 8 | One bad stored field reset and then overwrote the whole workspace | field-level tolerant parsing; unusable data copied to Recovery, never overwritten silently | unit + e2e |
| 9 | `null` entries made imports fail with a confusing error | element-level parsing with warnings | unit |
| – | Peer card id collision silently replaced someone | import dialog says which card is being replaced | unit + e2e |
| – | Clearing the profile changed the share id (duplicate cards) | share id preserved | unit |
| – | Deleting a team orphaned its plans | plans removed with the team | unit |
| – | Renewal-day math differed between screens (and broke across DST) | one calendar-day function | unit (3 time zones) |
| – | Two different ids for the local profile | single `SELF_ID` in `core/analytics` | – |
| – | Prune workflow crashed when a PR's fork was deleted | `(repo or {})` guard | – |
| – | Standalone file could silently drift from source | generated by the build, verified in CI | CI |
| – | `$&`/`$'` sequences in minified JS could corrupt template insertion | function replacers in `build.mjs` | build |

## Hardening from the independent code review

A separate reviewer (not the author) read the rebuilt code. It found no high-severity issues and confirmed the opt-in privacy rules and XSS/path-traversal safety. These follow-ups were fixed, each with a test where one is practical:

| Finding | Fix |
| --- | --- |
| A malformed percent-encoded URL crashed the Node server | `decodeURIComponent` guarded, returns 400 (e2e) |
| Escape on "Encrypt this export?" downloaded plaintext | three-way choice dialog (Plain / Encrypt / Cancel); Escape aborts (e2e) |
| A newer localStorage fallback save lost to an older IndexedDB record; a failed IndexedDB read could lead to overwriting it | `meta.rev` counter, the newest valid copy wins, and IndexedDB is never written after a failed read in that session |
| Two tabs overwrote each other | `BroadcastChannel` save notices; other tabs adopt the newer revision (e2e) |
| Service worker served the previous build for one load | network-first with cache fallback |
| Idle browser preconnect sockets could stall the single-threaded PowerShell server ~5 s | drop connections that send nothing within 300 ms; trailing-slash `-Root` handled |
| Peer card could use the reserved `self-current` / `demo-N` ids | rejected on import (unit) |
| Missing/null `teams` or `workforce` sections rejected a v2 import; duplicate ids allowed | section-level defaults; first-wins de-duplication by id (unit) |
| Scan worker failure was an unhandled rejection | caught and shown to the user |
| Export was clickable before the workspace loaded | disabled until ready |

## Employee-journey release (v1.1)

Implements audit items P1.3 (one guided onboarding flow) and P1.4 (simpler navigation, no duplicate FLEETHACKER tools):

- **Navigation:** nine top-level destinations became five (Home, My profile, Explore, Team, Program) with sub-tabs. `settings.ts` stores the view and each section's tab; `navigate(route)` takes a `{ view, tab }` route. Settings moved to `synapse-settings-v3`.
- **Home** renders `state/journey.ts`, a pure function of the workspace that reports each journey step's state and its next action; `nextStep()` picks what Home features. Unit-tested.
- **In-context actions:** `components/SkillActions.tsx` is the one set of actions for a skill (confirm / dismiss / add / rate) and `StatusChip` the one evidence-level vocabulary. The spider web, galaxy and lists all use them. The confidence pulse is `components/PulseDrawer.tsx`, a `<dialog>` side sheet opened from the store (`openPulse`), so rating never leaves the current screen.
- **Dismissed suggestions** persist in `profile.candidateDismissed` and are excluded from later scans, mirroring credential dismissals. `profile.lastScan` records the date only.
- **Merged tools:** the Team capability lab (composer / mentors / relay) is gone; `views/WorkforcePanels.tsx` exports `MissionsPanel`, `MentorsPanel`, `KnowledgePanel` (under Team) and `GrowthPanel` (under My profile). The team-level SKILLFLEET heatmap was a duplicate of Team → Coverage and was removed.

## Contribution preferences and organization codes (v1.2)

- **"How I like to contribute"** (`core/contribution.ts`): six generic stages of work grouped into ideation / activation / implementation; each marked energizing, neutral or draining. This is Synapse's own neutral vocabulary and is not an assessment; it reproduces no vendor instrument and uses no vendor name. A free-text `source` lets people note where their answers came from in their own words. Team view: `stageCoverage()` and `stageObservations()` (team-level only, never about an individual). Missions can require a stage.
- **Organization codes** (`core/org.ts`): the hierarchy is derived from the codes people enter, by prefix (`1500 → 1510 → 1513 → 1513.1`; three-digit yards nest `200 → 240 → 246`). No org chart ships; `buildOrgTree()` builds it from shared codes and Team → Coverage rolls skills up through it. Units below the three-person minimum show no numbers of their own.
- **Consent:** both fields are private by default. They join this browser's team tools only via `shareOrgLocally` / `shareContributionLocally`, and go on a peer card only via their own export checkboxes. Peer-card format stays v1 with two optional fields.
- **Intelligence seam** (`core/intelligence.ts`): an `IntelligenceProvider` interface with one registered implementation, `local-rules` (today's offline scanner). A model-backed provider hosted on an authorized platform can be registered against the same interface later; until one is selected nothing leaves the workstation.

## Galaxy v2, intelligence, lifecycle (v1.3)

- **Galaxy** (`app/viz/galaxy-model.ts`, `Galaxy.tsx`): the base layout is a one-time d3-force settle (seeded positions, fixed tick count, cached per session) so every profile sees the same map and nothing moves on its own. The view uses d3-zoom for wheel/pan with a Fit that frames whatever is visible; star drags are handled separately and nudge linked neighbours. Labels are counter-scaled by 1/√k so zooming in separates them. Ghost neighbours render as `.sky-ghost-node` (never `.sky-skill-node`) so "Confirmed shows exactly your attestations" stays literally true.
- **Intelligence** (`core/intelligence.ts`, `storage/intel-settings.ts`, `views/IntelligenceView.tsx`): one built-in provider (`local-rules`) and one configurable remote HTTP provider that speaks contract v1 (`ping`, `scan-resume`, `map-skills`, `team-brief`). Every remote response is validated with zod and clamped (unknown skill ids dropped, lengths bounded); any failure falls back to local rules and is reported. Non-secret settings live in `localStorage['synapse-intel-v1']`; the bearer token is stored only as an AES-GCM envelope sealed with a user passphrase and decrypted into memory per session. The build's CSP `connect-src` is `'self'` plus whatever `SYNAPSE_INTEL_HOST` lists; the UI reads the same list (`__SYNAPSE_INTEL_HOSTS__`) and warns when a configured host is not allowed.
- **Team brief** (`views/TeamBriefPanel.tsx`): `TeamBriefInput` is aggregate-only by type (counts and skill names, no people). The panel shows the exact input before generating. Local rules produce a deterministic brief (`localTeamBrief`).
- **Document text** (`app/lib/document-text.ts`): `.docx` via a minimal zip reader + `DecompressionStream('deflate-raw')`; `.pdf` text layer via content-stream parsing (Tj/TJ) with FlateDecode. No OCR; scanned PDFs are reported as such.
- **Skill mapping** (`core/mapping.ts`): exact → alias → token-Jaccard with a 0.5 floor. Used by manual add, imports and as the local half of `map-skills`.
- **Contribution import** (`core/contribution.ts` `importContribution`): CSV/JSON with plain-English synonyms for stage and energy; unknown rows are listed, never guessed. Printable sheets use `app/lib/print.ts`, which moves the sheet to `<body>` and hides `#root` during print so no blank pages trail.
- **Credentials**: additive schema fields `issued`, `verifier`, `provenance` (`claimed` | `reviewed` | `verified`), `note`. Older records read `provenance` from `source`. Status (`expired`, `renew-soon`, …) is derived at render time, never stored. Peer cards still carry credential names only.
- **Theme**: `settings.theme` (`system` | `dark` | `light`) → `<html data-theme>` applied before first paint in `main.tsx`. Light mode re-points the same semantic tokens; the galaxy canvas stays dark by design.

## Contribution framework v2 (v1.4)

`Contribution` gains `detail: Partial<Record<Stage, StageDetail>>` where `StageDetail = { energy: −2…2, fluency: 0…3 | null, tags: ContextTag[], example }`. The one-axis `stages` summary is kept and is always rewritten from `detail` (in `setStageDetail`, in `importContribution`, and in the schema transform), so peer cards and older data keep working and the two never disagree. `quadrant()` maps energy × fluency to `flow | growth | grind | avoid | steady | unknown`; `stageCoverage()` now also reports names per quadrant and `stageObservations()` calls out two-or-more-in-Grind and natural Flow↔Growth mentoring pairs. Team brief input carries `grind` / `growth` counts per stage (still aggregate-only). Nothing in the model forces a distribution, names a type, or totals anything.

## Drafts, provider setup, ROI v2 (v1.5)

- **Draft teammates** (`views/DraftTeammatePanel.tsx`, `synapse-draft-card` v1 in `core/schema.ts`): a member with `attested: false` and a `draftNote`. `participants()` excludes drafts unless `team.includeDrafts`; the roster always lists them. On the employee side `applyDraftToProfile()` turns the draft into candidates / credential candidates / empty org fields and adopts the draft id as `shareId`, so the person's eventual real card replaces the draft (same id) on re-import.
- **Provider setup**: `RemoteProviderConfig.kind` is `openai` (browser talks to `/models` and `/chat/completions`; `createOpenAIProvider`) or `synapse` (contract endpoint; `createRemoteProvider`). Both expose `listModels()`; the contract adds `list-models`. The sealed token doubles as the API key. Prompts for the OpenAI path live in `core/intelligence.ts` (`PROMPTS`) and are mirrored in `tools/intel-adapter.mjs`.
- **ROI v2** (`core/roi.ts`): lanes as data (`Lane { kind: 'cash' | 'capacity', value, detail }`), `roiBasis` map persisted beside `roi`, legacy `minutesSaved` migrates to `searchMinutes`; everything else from the old model is dropped on load.
