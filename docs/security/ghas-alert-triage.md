# GHAS alert triage — sprint 2026-11

Open alerts from the sprint export. Nothing in this document dismisses an alert on GitHub; dismissal stays with the repo owner.

| Alert | Rule / package | Path | Disposition | Reason | GitHub dismissal reason |
| --- | --- | --- | --- | --- | --- |
| code-scanning #1 | `js/clear-text-storage-of-sensitive-data` | `src/storage/trust.ts:28` | accept: false positive | `saveTrustList` writes public key ids, public P-256 JWKs, reader-chosen labels, and dates; the private key is stored only as an AES-GCM envelope by `saveSigningKey`. | False positive |
| dependabot #1 | zod (npm), GHSA-mrhx-c7xc-m3w5 | `package.json` (`zod` 3.25.76) | needs owner decision | The advisory's first patched release is 4.6.6, a major bump this sprint cannot take; the issue-accumulation walk is reachable from an opted-in remote provider response. | Leave open. If the residual risk is accepted: Risk is tolerable to this project (`tolerable_risk`) |

Alert URLs:

- https://github.com/fleethacker-data-crucible/Shellback/security/code-scanning/1
- https://github.com/fleethacker-data-crucible/Shellback/security/dependabot/1

No workflow files were changed. All three workflows already declare a `permissions:` block and stay on self-hosted runners.

## code-scanning #1 — clear-text storage

CodeQL reports that `saveTrustList` stores, as clear text, the value returned by `addTrusted` and by `removeTrusted`. That value is a `TrustedKey[]`. Each record is `keyId` (first 16 hex characters of SHA-256 over the public JWK), `label` (the name the reader typed, trimmed to 70 characters), `publicKey` (`kty`, `crv`, `x`, `y` only), and `added` (a calendar date). `addTrusted` re-parses the key with `publicKeySchema` before it returns, and a Zod object keeps only those four fields, so a private scalar `d` on an input JWK is dropped. The same public key is already copied into the detached signature file a teammate sends with a card.

The private half of a signing key is sealed with AES-GCM (PBKDF2-SHA-256) inside `createSigningKey` and written by `saveSigningKey` under `shellback-signing-key-v1`. This alert does not cite that function. The existing unit test `sign and verify: untrusted until the reader adds the key, then trusted` already asserts the serialized signing key contains no `"d"`.

Encrypting the trust list would change the product: the reader would need a passphrase to see labels they themselves chose, and the list is designed to live only in this browser (`shellback-trust-list-v1`, excluded from workspace export). The code is unchanged.

## dependabot #1 — zod GHSA-mrhx-c7xc-m3w5

`package.json` pins `zod` at `3.25.76`. [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) (CVE-2023-54404) is a reviewed GitHub advisory, not withdrawn, with vulnerable range `< 4.6.6` and first patched version `4.6.6`. The description says an oversized array makes `$ZodArray`'s `handleArrayResult` keep one issue per failing element, with no cap, until the process runs out of memory (CWE-770, availability). The 4.6.6 change ([zod#6652](https://github.com/colinhacks/zod/pull/6652), commit `a0ebf970f2d752e5f58527cd2942ff48be4f46bd`) rejects an oversized array, set, or map before parsing elements when `.max()`, `.length()`, or `.size()` is the leading check. Unbounded collections are unchanged. Moving this repo from 3.25.76 to 4.6.6 is a major-version bump, which this sprint does not do. Every `import` is `from 'zod'` (the 3.x entry). Nothing imports `zod/v4`.

### What 3.25.76 actually does

`ZodArray._parse` in the installed 3.25.76 records `too_big` when `.max()` fails and then still parses every element. A local check against that install:

| Schema | Input | Issues |
| --- | --- | --- |
| `z.array(z.string()).max(10)` | 2,000 numbers | 2,001 (`too_big` plus one `invalid_type` per element) |
| `z.array(z.string())` | 500 numbers | 500 |
| `z.array(z.unknown()).max(104)` | 5,000 numbers | 1 (`too_big` only; `z.unknown()` accepts each element) |

The zod 4 sources shipped inside the 3.25.76 package walk every index in `$ZodArray` before any size check. They are not the 4.6.6 fix, and the app does not load them.

### Where that walk can see data

Reachable, and only after someone opts in. `createRemoteProvider` and `createOpenAIProvider` (`src/core/intelligence.ts`) `res.json()` the response with no byte cap, then `safeParse` it. The default provider is `local-rules`, which never parses a network body. The caller is the person who configured the endpoint (https, or http limited to `127.0.0.1` / `localhost`) and then ran ping, list models, scan, map, or a team brief. A response from that endpoint can be the oversized array.

| Schema | Bound | What a failing oversized array does on 3.25.76 |
| --- | --- | --- |
| `skillIdList` `z.array(z.string()).max(104)` | `.max(104)` after the walk | one issue per bad element, then `too_big` |
| `credentialList` | `.max(50)` | same |
| `mapResult.mapped` | `.max(500)` | same |
| `modelsResult.models` | `.max(500)` | same |
| `openaiModels.data` | `.max(1000)` | same |
| `openaiChat.choices` | `.min(1)`, no upper bound | one issue per bad element; 4.6.6 does not change an unbounded array |

`tools/intel-adapter.mjs` does not import zod. It caps the inbound request body at 2,000,000 bytes. The browser schemas above are what perform the walk.

These paths do not hit the issue-accumulation walk:

- Workspace collections go through `arrayOf` in `src/core/schema.ts`, which slices to a fixed maximum and then `safeParse`s each kept element. Dropped items are counted as warnings.
- File picks are capped before `JSON.parse`: 256 KB for peer cards, drafts, and signatures; 2 MB for a workspace import.
- `peerCardSchema.skills` is `z.array(z.unknown()).max(104)`. A too-long array produces a single `too_big` issue.
- `parseGoldSet` uses bounded `z.array` schemas, and its production caller is the bundled `examples/evaluation/gold-resumes.json`. The evaluation screen does not upload a replacement set.
- `parseTrustList` (slice 500) and `parseLedger` (slice 100,000, tests and the ledger helper) `safeParse` objects one at a time. `parseLedger` is not wired to the UI.
- The PowerShell loopback server serves the static build. It does not run zod.

The effect, if a configured provider returns a huge array of failing elements, is memory use in that person's browser tab, on top of the array `JSON.parse` already allocated. There is no Shellback server process parsing these schemas.

### Decision for Jeremy Gerdes

1. Accept zod 3.25.76 for this app and dismiss Dependabot alert 1 as **Risk is tolerable to this project**, or
2. Authorize a separate upgrade to zod `>= 4.6.6`, with a full pass over every schema (Zod 4 changes parsing and error behavior). That upgrade is outside this sprint. It would short-circuit the `.max()` arrays in `intelligence.ts`. It would leave `openaiChat.choices` on the full walk, because that array has no upper bound.

This sprint leaves `package.json` on `3.25.76` and leaves the alert open.
