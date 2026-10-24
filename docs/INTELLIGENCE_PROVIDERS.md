# Intelligence providers

Synapse works completely without a model. **Local rules** (deterministic keyword and certification matching in the browser) is the default provider and the fallback for everything. An organization that runs an authorized AI platform can expose it to Synapse as a **remote HTTP provider** by implementing the small contract below. Synapse does not ship, and will not ship, any vendor-specific adapter: the platform team owns the server side.

## What the user sees

Program → **Intelligence**

- A provider choice: Local rules (default) or Remote provider.
- Connection settings: display name, endpoint (HTTPS, POST), optional model/deployment string, optional disclosure text.
- A bearer token, stored only as an AES-256-GCM envelope sealed with a passphrase the user types; unlocked into memory per browser session; never exported or backed up.
- **Test connection** (sends a `ping`).
- A per-task table of exactly what is sent and what is never sent. The same table is mirrored on Program → Trust & data whenever a remote provider is selected, and every screen that uses the provider (résumé intake, team brief) links to it.

## Network boundary

The shipped build's Content-Security-Policy is `connect-src 'self'`. A browser will refuse any request to another origin regardless of what is configured in the UI. To allow a provider host, build with:

```powershell
$env:SYNAPSE_INTEL_HOST = "https://ai.example.mil"   # comma-separate several origins
npm run build
```

The origins are written into `dist/build-manifest.json` (`intelHosts`) and shown in the Intelligence tab ("Allowed by this build"). A build with no `SYNAPSE_INTEL_HOST` is network-silent by construction.

## Quickest way to try it: the loopback adapter

`tools/intel-adapter.mjs` is a zero-dependency Node bridge that implements contract v1 on `http://127.0.0.1:8790` and forwards each task as a chat-completion request to any **OpenAI-compatible** endpoint (most enterprise gateways are), using an API key that never leaves your workstation.

```powershell
# 1. Build an edition that is allowed to talk to the adapter (not the committed dist/)
$env:SYNAPSE_INTEL_HOST = "http://127.0.0.1:8790"
npm run build:intel                      # → dist-intel
# 2. Start the adapter (keep this window open)
$env:INTEL_UPSTREAM_URL = "https://<your-gateway>/v1/chat/completions"
$env:INTEL_API_KEY      = "<your key>"
$env:INTEL_MODEL        = "<model or deployment name>"   # optional
$env:INTEL_TOKEN        = "pick-a-shared-secret"         # optional; Synapse presents it as the bearer token
npm run intel:adapter

# 3. Serve that edition in a second window
npm run serve:intel                      # or: .	ools\Serve-Synapse.ps1 -Root .\dist-intel
```

Then in Synapse: Program → Intelligence → endpoint `http://127.0.0.1:8790`, *Add bearer token…* = the `INTEL_TOKEN` you chose, *Test connection*, select *Remote provider*. If the gateway is not OpenAI-shaped, the adapter is ~80 lines; change `upstream()` and the three prompts.

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

Synapse times out after 30 s (15 s for the connection test) and treats a non-2xx status, non-JSON body, or a `result` that fails validation as a failure. Failures fall back to local rules and are reported to the user; partial results are never used.

### `ping`

```jsonc
{ "task": "ping" }                      →  { "detail": "optional text" }
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
    "teamName": "Code 1513",
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

## Rules a provider must keep

1. Outputs are suggestions for the employee to confirm or dismiss, never conclusions.
2. No provider scores, ranks or profiles a person. Synapse never sends enough to do so, and a brief that tries is still shown with the "self-reported, aggregate, not an assessment" footer.
3. State what you retain, for how long, and under which authority in the disclosure text; Synapse shows it verbatim wherever the provider is used.
4. Idempotent, stateless requests. Synapse keeps no conversation and sends no identifiers.

## Authoritative sources (design note, not implemented)

Credential truth ultimately lives in systems of record (for example an enterprise analytics platform fed by training and certification systems). The planned shape is a **read-only credential adapter**:

- `GET /credentials?subject=<opaque id the user pastes>` → `[{ name, authority, issued, expiry, verifier, verifiedOn }]`
- Synapse would import rows as credentials with provenance `verified` and show the verifier; the user can still hide or annotate them but not edit verified fields.
- Same network boundary (`SYNAPSE_INTEL_HOST`), same token handling, same disclosure table row.
- Until such an adapter exists, every credential in Synapse is `claimed` or `reviewed` (employee-reviewed résumé suggestion), and the UI says so.
