# SYNAPSE: local development

## On a workstation (no CAC, no install)

Run `Launch-Synapse.bat` on your **personal Windows PC**. Don't run it on a managed system to get around organizational security controls.

- **Prerequisites:** Windows PowerShell 5.1 (built into Windows) and Edge or Chrome.
- **What happens:** `Launch-Synapse.bat` runs `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\Serve-Synapse.ps1`. That script serves `dist\` on `http://127.0.0.1:8765/` and opens your default browser. Keep the port the same between runs, because the browser stores workspace data per origin (including the port). If 8765 is busy, the script tries the next 10 ports and warns you. Press Ctrl+C in the console window to stop it.
  - The server only accepts loopback connections and only handles GET/HEAD requests.
  - It serves files inside `dist\` only, with no directory listings and no path traversal.
  - It sends `nosniff`, `no-referrer`, COOP/CORP, a `frame-ancestors 'none'` CSP and `no-store` headers.
- **Options:** `Launch-Synapse.bat -Port 8765 -NoBrowser`. Arguments are passed through to the PowerShell script.
- **No PowerShell?** The launcher falls back to opening `dist\Synapse-Standalone.html` directly.
- **Boundaries:** there is no real login or CAC in this MVP, and browser storage is not an enterprise authorization boundary. Don't enter CUI, classified material, real credentials or real personnel information.

## On a build machine

```powershell
git fetch origin
git switch <branch>
npm install
npm run build        # regenerate dist\
npm test             # typecheck, unit, dist freshness, browser smoke
npm run serve        # Node loopback server equivalent to Serve-Synapse.ps1
```

Commit the regenerated `dist\` together with the source change. CI rejects a PR whose `dist\` doesn't match its source.

## Release

Ship `Launch-Synapse.bat`, `tools\Serve-Synapse.ps1` and `dist\`. Nothing else is needed on the workstation. Real deployments must keep requiring approved credentials and authorization.
