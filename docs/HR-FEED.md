# HR feed import

Team → Roster → *Import HR feed (CSV)* reads a CSV from HR and adds each record to the active team as an **unverified draft**. It carries the organisation code, job title and certification names that HR holds. It carries no skills, and the person has not attested to any of it, so a draft stays out of coverage unless a supervisor includes drafts.

## Columns (header row required; order does not matter)

| Column | Use |
|---|---|
| `employee_id` | Required. Becomes the member id as `hr-<id>`. Re-importing the same id replaces that draft. |
| `display_name` | Required, at most 70 characters. |
| `org_code` | Organisation code, normalised on import. |
| `job_title` | At most 80 characters. |
| `certifications` | Semicolon-separated names. Shown as unverified. |

A bad row is skipped with a warning, not fatal. The feed is limited to 500 rows and 512 KB. Quoted fields may contain commas.

## Scope

Only the synthetic feed in `examples/hr/` has been used. Real HR data must not be imported until the organisation approves an authoritative feed and the import is reviewed against it. This PR does not connect to any HR system.
