# SYNAPSE — local development (no CAC)

Run `Launch-LocalDev.bat` on your **personal Windows PC** after checking out the feature branch. Do not run on a managed system to evade organization security controls.

## What it does

- Prerequisite: Any modern local browser.
- Startup: Starts the single-file offline demo with synthetic personas and no backend installation.
- Boundary: No real login or CAC is implemented in this MVP. Browser storage is not an enterprise authorization boundary.
- Diagnostics / manual check: `Open Synapse-Standalone.html`.

## Workflow

```powershell
git fetch origin
git switch feature/local-dev-no-cac-launcher
.\Launch-LocalDev.bat
```

Normal launchers and production authentication remain unchanged. This is **not** an authenticated Navy session. Do not enter CUI, classified material, real credentials or real personnel information during personal-computer testing.

For release, delete the local development launcher from the release branch or leave it out of the release package. Real connections must continue to require approved credentials and authorization.
