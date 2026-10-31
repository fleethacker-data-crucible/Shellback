# Intelligence providers

Shellback works completely without a model. **Local rules** (deterministic keyword and certification matching in the browser) is the default provider and the fallback for everything. An organization that runs an authorized AI platform can expose it to Shellback as a **remote HTTP provider** by implementing the small contract below. Shellback does not ship, and will not ship, any vendor-specific adapter: the platform team owns the server side.

## What the user sees

Program → **Intelligence** — Local rules (default) or a remote provider set up in four steps:

1. **Where is it?** Kind of endpoint — *OpenAI-compatible gateway* (the API base, usually `…/v1`; Shellback calls `/models` and `/chat/completions` itself) or *Shellback contract endpoint* (a platform-side implementation of the contract below) — plus display name and URL.
2. **Which key?** The API key / bearer token, sealed with a passphrase (AES-256-GCM), unlocked per browser session, never exported.
3. **Which model?** *Load models* lists what the key can use; pick one (or type it).
4. **Does it work?** *Test connection*, then *Save connection* and select the provider at the top.

Advanced: an optional **data-handling notice** — the one-sentence statement employees see wherever the provider is used (intake, team brief, Trust & data). Generated from host + model by default; an approved platform statement (retention, ATO, PII approval) can replace it verbatim.

For an OpenAI-compatible gateway the browser talks to it directly, so the gateway must allow CORS from the Shellback origin **and** the build must allow the host. If either is missing, run the loopback adapter below instead (it also implements `list-models`).

- A provider choice: Local rules (default) or Remote provider.
- Connection settings: display name, endpoint (HTTPS, POST), optional model/deployment string, optional disclosure text.
- A bearer token, stored only as an AES-256-GCM envelope sealed with a passphrase the user types; unlocked into memory per browser session; never exported or backed up.
- **Test connection** (sends a `ping`).
- A per-task table of exactly what is sent and what is never sent. The same table is mirrored on Program → Trust & data whenever a remote provider is selected, and every screen that uses the provider (résumé intake, team brief) links to it.

## Network boundary

The shipped build's Content-Security-Policy is `connect-src 'self'`. A browser will refuse any request to another origin regardless of what is configured in the UI. To allow a provider host, build with:

```powershell
$env:SHELLBACK_INTEL_HOST = "https://ai.example.com"   # comma-separate several origins
npm run build
```

The origins are written into `dist/build-manifest.json` (`intelHosts`) and shown in the Intelligence tab ("Allowed by this build"). A build with no `SHELLBACK_INTEL_HOST` is network-silent by construction.

## Quickest way to try it: the loopback adapter

`tools/intel-adapter.mjs` is a zero-dependency Node bridge that implements contract v1 on `http://127.0.0.1:8790` and forwards each task as a chat-completion request to any **OpenAI-compatible** endpoint (most enterprise gateways are), using an API key that never leaves your workstation.

```powershell
# 1. Build an edition that is allowed to talk to the adapter (not the committed dist/)
$env:SHELLBACK_INTEL_HOST = "http://127.0.0.1:8790"
npm run build:intel                      # → dist-intel
# 2. Start the adapter (keep this window open)
$env:INTEL_UPSTREAM_URL = "https://<your-gateway>/v1/chat/completions"
$env:INTEL_API_KEY      = "<your key>"
$env:INTEL_MODEL        = "<model or deployment name>"   # optional
$env:INTEL_TOKEN        = "pick-a-shared-secret"         # optional; Shellback presents it as the bearer token
npm run intel:adapter

# 3. Serve that edition in a second window
npm run serve:intel                      # or: .	ools\Start-Shellback.ps1 -Root .\dist-intel
```

Then in Shellback: Program → Intelligence → endpoint `http://127.0.0.1:8790`, *Add bearer token…* = the `INTEL_TOKEN` you chose, *Test connection*, select *Remote provider*. If the gateway is not OpenAI-shaped, the adapter is ~80 lines; change `upstream()` and the three prompts.

The adapter is a development convenience. For production the platform team should implement the contract server-side so the browser talks to the accredited service directly over HTTPS.

## Contract (version 1)

One endpoint, `POST`, JSON in and out, `Authorization: Bearer <token>` when a token is configured. Requests are sent with `credentials: 'omit'` and `referrerPolicy: 'no-referrer'`.

```jsonc
// request
{ "contract": 1, "model": "optional-deployment-name", "payload": { "task": "...", ... } }

// response
{ "ok": true,  "result": { ... } }
{ "ok": false, "error": "human-readable reason (≤ 400 chars)" }
```

Shellback times out after 30 s (15 s for the connection test) and treats a non-2xx status, non-JSON body, or a `result` that fails validation as a failure. Failures fall back to local rules and are reported to the user; partial results are never used.

### `ping`

```jsonc
{ "task": "ping" }                      →  { "detail": "optional text" }
```

### `list-models`

```jsonc
{ "task": "list-models" }               →  { "models": ["deployment-a", "deployment-b"] }
```

### `scan-resume`

```jsonc
{
  "task": "scan-resume",
  "text": "résumé text, ≤ 100,000 chars",
  "confirmed": ["skill-ids the employee already confirmed"],
  "taxonomy": [{ "id": "sql-pipelines", "name": "SQL Pipelines", "domain": "Data Engineering" }, ...]   // all 104
}
→
{
  "skills": ["taxonomy ids only; unknown ids are dropped"],
  "credentials": [{ "name": "Security+", "authority": "CompTIA", "matched": "phrase in the text" }]   // optional
}
```

Everything returned becomes an **amber suggestion** the employee confirms or dismisses; nothing is auto-added. Skills already confirmed are removed client-side.

### `map-skills`

```jsonc
{ "task": "map-skills", "names": ["free-text skill names"], "taxonomy": [ ... ] }
→
{ "mapped": [{ "input": "k8s", "skillId": "container-platforms", "score": 0.9 }] }   // skillId may be null
```

Local fuzzy mapping always runs too; a valid remote mapping overrides it per input.

### `team-brief`

```jsonc
{
  "task": "team-brief",
  "input": {
    "teamName": "Code 9911",
    "people": 6,
    "domainCounts": [4, 4, 4, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],   // people per domain, DOMAINS order
    "thinSkills": ["Threat Modeling"],                        // skills held by exactly one person
    "priorities": [{ "skill": "Forecasting", "covered": 0 }],
    "stages": [{ "stage": "Finish", "energized": 0, "drained": 4 }],   // omitted below the aggregate minimum
    "renewalsSoon": 2
  }
}
→
{ "text": "plain text, paragraphs separated by blank lines, ≤ 6,000 chars" }
```

The input is **aggregate-only by construction**: it has no names, no per-person rows, no org codes and no free text from anyone. The UI shows the exact input to the supervisor before the brief is requested.

## Evaluation set

`examples/evaluation/gold-resumes.json` holds fictional résumé snippets with the skills and credential keys a careful reader expects (including a negation trap, a credential still being pursued, a paraphrase case and a no-evidence case). Program → Intelligence → *Evaluation set* runs the active provider over it and reports precision and recall for skills and credentials, plus what each case missed or added. A remote provider is asked to confirm first, because the snippets are sent to it (they are synthetic and say nothing about the user).

`src/core/evaluation.ts` is the same logic without the UI (`evaluateProvider`, `compareReports`), and `tests/unit/evaluation.test.ts` pins the Local rules baseline. The scores describe a provider on fictional text. They are never computed for a person.

Not done: running the set against a real model. That needs a configured provider and key, so there is no recorded remote baseline yet.

## Rules a provider must keep

1. Outputs are suggestions for the employee to confirm or dismiss, never conclusions.
2. No provider scores, ranks or profiles a person. Shellback never sends enough to do so, and a brief that tries is still shown with the "self-reported, aggregate, not an assessment" footer.
3. State what you retain, for how long, and under which authority in the disclosure text; Shellback shows it verbatim wherever the provider is used.
4. Idempotent, stateless requests. Shellback keeps no conversation and sends no identifiers.

## Authoritative sources (design note, not implemented)

Credential truth ultimately lives in systems of record (for example an enterprise analytics platform fed by training and certification systems). The planned shape is a **read-only credential adapter**:

- `GET /credentials?subject=<opaque id the user pastes>` → `[{ name, authority, issued, expiry, verifier, verifiedOn }]`
- Shellback would import rows as credentials with provenance `verified` and show the verifier; the user can still hide or annotate them but not edit verified fields.
- Same network boundary (`SHELLBACK_INTEL_HOST`), same token handling, same disclosure table row.
- Until such an adapter exists, every credential in Shellback is `claimed` or `reviewed` (employee-reviewed résumé suggestion), and the UI says so.
