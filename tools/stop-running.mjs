/**
 * TechStack "Lifecycle rules" — build/serve scripts stop the app first and say what they stopped.
 * On Windows this runs tools/Stop-Shellback.ps1 -ThisCopyOnly (servers started from this checkout only).
 * Elsewhere there is no PowerShell server to stop, so it does nothing.
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function stopRunningShellback(root, label) {
  if (process.platform !== 'win32') return;
  const script = path.join(root, 'tools', 'Stop-Shellback.ps1');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Quiet', '-ThisCopyOnly'], { encoding: 'utf8', timeout: 30_000 });
  if (r.error) { console.warn(`${label}: could not run Stop-Shellback.ps1 (${r.error.message}); continuing.`); return; }
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  if (out) console.log(`${label}: stopped the running Shellback server first.\n${out}`);
}
