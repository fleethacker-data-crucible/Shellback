# Peer card contract (version 1)

A peer card is the file an employee exports to share an opt-in capability summary with a teammate. It is a plain JSON object. The format id is still `synapse-peer-card`: the name predates the rename to Shellback, and existing cards must keep importing. Tests in `tests/unit/peer-card-contract.test.ts` check this document against the importer, the exporter and the example files.

## Fields

| Field | Type and limits | Required | Notes |
|---|---|---|---|
| `format` | the text `synapse-peer-card` | yes | Anything else is refused. |
| `version` | the number `1` | yes | Anything else is refused. |
| `id` | 8 to 70 characters: letters, digits, `-` | yes | Stable per person, so a new export replaces the earlier card. `self-current` and `demo-<number>` are reserved and refused. |
| `name` | text, trimmed, at most 70 characters | yes | Shown to the team. |
| `consent` | the boolean `true` | yes | A card with `false` or no consent is refused. |
| `issued` | text, up to 10 characters | no | Kept as written. Known gap: the importer does not check that it is a date. |
| `skills` | list of skill ids | yes | At least one is expected. Unknown ids are dropped, not refused. Up to 104. |
| `surveys` | object keyed by skill id | no | Each value has `confidence` (integer 0 to 4) and `method`. Entries for skills not in `skills` are ignored. |
| `method` (in `surveys`) | `none`, `independent`, `guided` or `ai` | yes, inside `surveys` | How the task was done. |
| `mentorOptIn` | boolean | no | Whether the person offers mentoring. |
| `mentorTopics` | list of skill ids | no | Up to 30. |
| `availability` | `unknown`, `available`, `limited` or `unavailable` | no | Anything else is read as `unknown`. |
| `mentorIntro` | text, at most 500 characters | no | |
| `qualificationClaims` | list of text, each at most 160 characters | no | Up to 100. Employee-entered and unverified. |
| `qualificationDisclaimer` | text | no | Written by the exporter for people reading the file. The importer does not read it. |
| `orgCode` | organisation code | no | Normalised on import (`src/core/org.ts`). |
| `orgTitle` | text, at most 80 characters | no | |
| `contribution` | object, see below | no | Work-stage preferences. |
| `syntheticExample` | boolean | no | Marks the fictional example files. The importer ignores it, and imported members are never marked synthetic. |

### `contribution`

- `stages`: object. Keys are stage ids (`question`, `ideate`, `evaluate`, `rally`, `support`, `finish`). Values are `energizing`, `neutral` or `draining`.
- `source`: text, at most 160 characters.
- `detail`: object keyed by stage id. Each value has `energy` (integer −2 to 2), `fluency` (integer 0 to 3, or null), `tags` (up to 7 of `high-stakes`, `under-deadline`, `small-team`, `large-group`, `people-i-know`, `new-people`, `working-alone`) and `example` (text, at most 160 characters).

## What the importer does

- Refuses the card when `format`, `version`, `consent` or `name` is wrong, or when `id` is malformed or reserved.
- Drops, without refusing the card: unknown skill ids, survey entries that are invalid or for skills the card does not list, and fields it does not know (including `qualificationDisclaimer` and `syntheticExample`).
- Never trusts the card's claim about itself. An imported card is a member that the employee has not attested, and it is labelled as unverified.

## Encryption

A card may be wrapped in an encrypted envelope (`format: synapse-encrypted`, AES-256-GCM with a passphrase). The importer asks for the passphrase and then reads the card as above. The envelope is optional and does not change the card.

## Versioning

Version 1 changes must be additive: new optional fields, never a changed meaning or a new requirement. A breaking change becomes `version: 2`, and version 1 cards keep importing.

## Examples

`examples/employees/*-peer-card.json` are fictional and match this contract. They are used in the tests and in the in-app personas.

