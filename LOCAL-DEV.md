# Shellback: local development

## On a workstation (no smart card, no install)

Run `Launch-Shellback.bat` on your **personal Windows PC**. Don't run it on a managed system to get around organizational security controls.

- **Prerequisites:** Windows PowerShell 5.1 (built into Windows) and Edge or Chrome.
- **What happens:** `Launch-Shellback.bat` runs `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\Start-Shellback.ps1`. That script serves `dist\` on `http://127.0.0.1:8765/` and opens your default browser. Keep the port the same between runs, because the browser stores workspace data per origin (including the port). If 8765 is busy, the script tries the next 10 ports and warns you. Press Ctrl+C in the console window to stop it.
- **Stopping:** the browser tab owns the server. It stops by itself about 20 s after the last Shellback tab closes (5 s after the tab signals it is leaving; a reload does not stop it). **End session** in the left navigation stops it at once. `tools\Stop-Shellback.ps1` stops every running Shellback server without needing a PID. Your workspace is in the browser, so stopping never loses work.
- **One instance:** if a Shellback server is already running, the launcher asks *Stop it and start fresh?*. `--replace` answers yes; `--stay` keeps the server running after the tab closes. `SHELLBACK_AUTO_STOP=0` (environment variable) turns auto-stop off for every launch. The former name `SYNAPSE_AUTO_STOP` is still read when `SHELLBACK_AUTO_STOP` is not set.
- **Runtime file:** while it runs, the server writes `logs\shellback-server-<pid>.json` (pid, port, url, start time) next to the launcher and deletes it on stop. Stale files are removed on sight.
  - The server only accepts loopback connections and only handles GET/HEAD requests, plus two lifecycle POSTs (`/api/heartbeat`, `/api/session/stop`) that it accepts only from its own Origin/Host.
  - It serves files inside `dist\` only, with no directory listings and no path traversal.
  - It sends `nosniff`, `no-referrer`, COOP/CORP, a `frame-ancestors 'none'` CSP and `no-store` headers.
- **Options:** `Launch-Shellback.bat -Port 8765 -NoBrowser --stay --replace`. Arguments are passed through to the PowerShell script.
- **No PowerShell?** The launcher falls back to opening `dist\Shellback-Standalone.html` directly.
- **Boundaries:** there is no real login or smart card in this MVP, and browser storage is not an enterprise authorization boundary. Don't enter sensitive or regulated data, real credentials or real personnel information.

## On a build machine

```powershell
git fetch origin
git switch <branch>
npm install
npm run build        # regenerate dist\
npm test             # typecheck, unit, dist freshness, browser smoke
npm run serve        # Node loopback server equivalent to Start-Shellback.ps1
```

On Windows, `npm run build` and `npm run serve` first stop any Shellback server started from this checkout (`tools\Stop-Shellback.ps1 -ThisCopyOnly`) and say what they stopped.

Commit the regenerated `dist\` together with the source change. CI rejects a PR whose `dist\` doesn't match its source.

### Allowing a remote intelligence provider

The default build is network-silent (`connect-src 'self'`). To let Program → Intelligence talk to an authorized AI platform, set the origin(s) before building; the browser blocks every other host no matter what is typed into the UI.

```powershell
$env:SHELLBACK_INTEL_HOST = "https://ai.example.com"   # comma-separate several
npm run build
```

`SYNAPSE_INTEL_HOST` (the former name) is still read when `SHELLBACK_INTEL_HOST` is not set.

The contract the platform must implement is in `docs/INTELLIGENCE_PROVIDERS.md`, along with a loopback adapter (`npm run intel:adapter`) that bridges to any OpenAI-compatible gateway with your own API key. Use `npm run build:intel` (writes `dist-intel\`, git-ignored) so the committed `dist\` stays network-silent. Note that `npm run build:check` compares against the committed `dist\`, so a host-specific build should be produced on the deployment branch (or passed to CI as a secret) rather than committed to `main`.

## Release

Ship `Launch-Shellback.bat`, `tools\Start-Shellback.ps1`, `tools\Shellback-Process.ps1`, `tools\Stop-Shellback.ps1` and `dist\`. Nothing else is needed on the workstation. Real deployments must keep requiring approved credentials and authorization.

### Upgrading a copy from before the rename (Synapse)

Copy the new files over the old folder. `Launch-Synapse.bat` remains as a one-line stub that runs `Launch-Shellback.bat`, so existing shortcuts keep working; the old `tools\Serve-Synapse.ps1`, `tools\Stop-Synapse.ps1`, `tools\Synapse-Process.ps1` and `dist\Synapse-Standalone.html` can be deleted. `Stop-Shellback.ps1` also finds and stops a server that was started from the old `Serve-Synapse.ps1`. Keep port 8765: the workspace stays where it was in the browser, because the IndexedDB and localStorage names are unchanged.
