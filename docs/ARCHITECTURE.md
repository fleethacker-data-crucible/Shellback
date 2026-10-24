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
| PowerShell 5.1 + `TcpListener` on 127.0.0.1 | **Done** | `tools/Serve-Synapse.ps1`. It was written for PS 5.1 but couldn't be run in the cloud build environment, so CI exercises the equivalent Node server instead. A Windows self-hosted runner job can be added to run the PS server directly. |
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
