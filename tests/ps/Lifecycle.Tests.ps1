#requires -Version 5.1
<#
.SYNOPSIS
  Lifecycle tests for the PowerShell 5.1 server (TechStack "Lifecycle rules"). Plain PowerShell, no
  Pester needed; exits 1 on the first failure. Run by CI on the Windows runner:
    powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File tests\ps\Lifecycle.Tests.ps1
  Part 1 checks the presence rule with simulated time. Part 2 starts the real Serve-Synapse.ps1 and
  checks the runtime file, the lifecycle routes, auto-stop after a leaving beacon, End session,
  -Replace and Stop-Synapse.ps1.
#>
[CmdletBinding()]
param([int]$Port = 18865)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
if (-not $here) { $here = Split-Path -Parent $MyInvocation.MyCommand.Definition }
$root = [System.IO.Path]::GetFullPath((Join-Path $here '..\..')).TrimEnd('\', '/')
$serve = Join-Path $root 'tools\Serve-Synapse.ps1'
$stop = Join-Path $root 'tools\Stop-Synapse.ps1'
. (Join-Path $root 'tools\Synapse-Process.ps1')

$script:failures = 0
function Check([bool]$ok, [string]$what) {
  if ($ok) { Write-Host ('  ok   ' + $what) }
  else { Write-Host ('  FAIL ' + $what) -ForegroundColor Red; $script:failures++ }
}

# ---------------------------------------------------------------------------- 1. presence rule (simulated time)
Write-Host 'Presence rule'
$t0 = [DateTime]::UtcNow
$s = New-SynapsePresence
Check (-not (Test-SynapseBrowserGone -State $s -Now $t0.AddMinutes(10))) 'never stops before the first heartbeat'
Update-SynapsePresence -State $s -TabId 'a' -Now $t0
Check (-not (Test-SynapseBrowserGone -State $s -Now $t0.AddSeconds(19))) 'alive 19 s after a heartbeat'
Check (Test-SynapseBrowserGone -State $s -Now $t0.AddSeconds(20)) 'gone 20 s after the last heartbeat'

$s = New-SynapsePresence
Update-SynapsePresence -State $s -TabId 'a' -Now $t0
Update-SynapsePresence -State $s -TabId 'a' -Leaving -Now $t0.AddSeconds(1)
Check (-not (Test-SynapseBrowserGone -State $s -Now $t0.AddSeconds(5))) 'leaving: waits the 5 s grace'
Check (Test-SynapseBrowserGone -State $s -Now $t0.AddSeconds(6)) 'leaving: gone 5 s after the beacon'

$s = New-SynapsePresence
Update-SynapsePresence -State $s -TabId 'a' -Now $t0
Update-SynapsePresence -State $s -TabId 'a' -Leaving -Now $t0.AddSeconds(1)
Update-SynapsePresence -State $s -TabId 'b' -Now $t0.AddSeconds(2)   # the reloaded page is a new tab id
Check (-not (Test-SynapseBrowserGone -State $s -Now $t0.AddSeconds(10))) 'reload: a fresh heartbeat cancels the leaving signal'

$s = New-SynapsePresence
Update-SynapsePresence -State $s -TabId 'a' -Now $t0
Update-SynapsePresence -State $s -TabId 'b' -Now $t0
Update-SynapsePresence -State $s -TabId 'a' -Leaving -Now $t0.AddSeconds(1)
Update-SynapsePresence -State $s -TabId 'b' -Now $t0.AddSeconds(5)
Check (-not (Test-SynapseBrowserGone -State $s -Now $t0.AddSeconds(10))) 'two tabs: closing one keeps the server'
Update-SynapsePresence -State $s -TabId 'b' -Leaving -Now $t0.AddSeconds(11)
Check (Test-SynapseBrowserGone -State $s -Now $t0.AddSeconds(16)) 'two tabs: gone after the last one leaves'

$s = New-SynapsePresence
Update-SynapsePresence -State $s -TabId 'a' -Now $t0
$s.Busy = $true
Check (-not (Test-SynapseBrowserGone -State $s -Now $t0.AddMinutes(5))) 'never stops while a job runs'
$s.Busy = $false
Check (Test-SynapseBrowserGone -State $s -Now $t0.AddMinutes(5)) 'stops on the next tick after the job'

$s = New-SynapsePresence -AutoStop $false
Update-SynapsePresence -State $s -TabId 'a' -Now $t0
Check (-not (Test-SynapseBrowserGone -State $s -Now $t0.AddHours(1))) 'AutoStop off (-Stay / SYNAPSE_AUTO_STOP=0) never stops'

# ---------------------------------------------------------------------------- 2. the real server
Write-Host 'Serve-Synapse.ps1 lifecycle'
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$stale = Join-Path $logs 'synapse-server-999999.json'
'{"pid":999999,"port":1,"url":"http://127.0.0.1:1/","startedAt":"2020-01-01T00:00:00Z"}' | Set-Content -Path $stale -Encoding ASCII
[void](Get-SynapseProcesses -Root $root -ThisCopyOnly)
Check (-not (Test-Path $stale)) 'stale runtime file (dead pid) is removed on sight'

$out = Join-Path $env:TEMP ('synapse-life-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $out | Out-Null
$started = New-Object System.Collections.Generic.List[object]

function Start-Server([string[]]$Extra, [hashtable]$EnvVars) {
  $old = @{}
  if ($EnvVars) { foreach ($k in $EnvVars.Keys) { $old[$k] = [Environment]::GetEnvironmentVariable($k); [Environment]::SetEnvironmentVariable($k, $EnvVars[$k]) } }
  try {
    $n = $started.Count
    # A fresh port per server, so a port still closing from the previous one never moves this one.
    $script:port = $Port + $n
    $argsList = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $serve + '"'), '-Port', "$script:port", '-NoBrowser') + $Extra
    $p = Start-Process powershell.exe -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $out "out$n.txt") -RedirectStandardError (Join-Path $out "err$n.txt") -ArgumentList $argsList
  } finally {
    if ($EnvVars) { foreach ($k in $EnvVars.Keys) { [Environment]::SetEnvironmentVariable($k, $old[$k]) } }
  }
  $started.Add($p)
  $file = Join-Path $logs ('synapse-server-' + $p.Id + '.json')
  for ($i = 0; $i -lt 75; $i++) { if ((Test-Path $file) -or $p.HasExited) { break }; Start-Sleep -Milliseconds 200 }
  return $p
}
function Wait-Exit($p, [int]$Seconds) {
  for ($i = 0; $i -lt ($Seconds * 5); $i++) { if ($p.HasExited) { return $true }; Start-Sleep -Milliseconds 200 }
  return $p.HasExited
}
function Post([string]$Path, [string]$Body, [hashtable]$Headers) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 -Method Post -Uri ('http://127.0.0.1:' + $script:port + $Path) -Body $Body -ContentType 'application/json' -Headers $Headers
    return [int]$r.StatusCode
  } catch [System.Net.WebException] {
    if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
    throw
  }
}
$script:port = $Port
function Own { return @{ Origin = ('http://127.0.0.1:' + $script:port) } }
[System.Net.ServicePointManager]::Expect100Continue = $false
# The runner may be a workstation with a real Synapse open: -Replace stops every Synapse server, so that
# check only runs when nothing outside this checkout is running.
$mineNow = @(Get-SynapseProcesses -Root $root -ThisCopyOnly | ForEach-Object { $_.Pid })
$others = @(Get-SynapseProcesses -Root $root | Where-Object { $mineNow -notcontains $_.Pid })

try {
  # Runtime file, routes, auto-stop after a leaving beacon
  $a = Start-Server @() $null
  $file = Join-Path $logs ('synapse-server-' + $a.Id + '.json')
  Check (Test-Path $file) 'runtime file logs\synapse-server-<pid>.json is written'
  if (Test-Path $file) {
    $info = Get-Content $file -Raw | ConvertFrom-Json
    Check (([int]$info.pid -eq $a.Id) -and ([int]$info.port -eq $script:port) -and ($info.url -eq ('http://127.0.0.1:' + $script:port + '/')) -and $info.startedAt) 'runtime file has pid, port, url, startedAt'
    Check (-not ((Get-Content $file -Raw) -match 'token|session')) 'runtime file holds no token'
  }
  $found = @(Get-SynapseProcesses -Root $root -ThisCopyOnly | Where-Object { $_.Pid -eq $a.Id })
  Check ($found.Count -eq 1) 'Get-SynapseProcesses finds the server'
  Check ((Post '/api/heartbeat' '{"tab":"t1","leaving":false}' @{ Origin = 'http://evil.example' }) -eq 403) 'heartbeat from another origin is refused'
  Check ((Post '/api/session/stop' '{}' (Own)) -eq 403) 'End session without its intent header is refused'
  Check ((Post '/api/heartbeat' '{"tab":"t1","leaving":false}' (Own)) -eq 204) 'heartbeat accepted'
  Start-Sleep -Seconds 2
  Check (-not $a.HasExited) 'still running 2 s after a heartbeat'
  Check ((Post '/api/heartbeat' '{"tab":"t1","leaving":true}' (Own)) -eq 204) 'leaving beacon accepted'
  Check (Wait-Exit $a 12) 'stops itself about 5 s after the leaving beacon'
  Check (-not (Test-Path $file)) 'runtime file removed on auto-stop'

  # End session, with auto-stop off by environment
  $b = Start-Server @() @{ SYNAPSE_AUTO_STOP = '0' }
  [void](Post '/api/heartbeat' '{"tab":"t1","leaving":false}' (Own))
  [void](Post '/api/heartbeat' '{"tab":"t1","leaving":true}' (Own))
  Start-Sleep -Seconds 7
  Check (-not $b.HasExited) 'SYNAPSE_AUTO_STOP=0 keeps it running after the tab leaves'
  Check ((Post '/api/session/stop' '{}' (@{ Origin = ('http://127.0.0.1:' + $script:port); 'X-Synapse-Intent' = 'end-session' })) -eq 200) 'End session accepted'
  Check (Wait-Exit $b 5) 'End session stops the server'

  # One instance: -Replace stops the running one; Stop-Synapse.ps1 stops the rest
  if ($others.Count -eq 0) {
    $c = Start-Server @('-Stay') $null
    $d = Start-Server @('-Replace') $null
    Check (Wait-Exit $c 5) '-Replace stops the running server'
    Check (-not (Test-Path (Join-Path $logs ('synapse-server-' + $c.Id + '.json')))) 'runtime file of the replaced server removed'
  } else {
    Write-Host ('  skip -Replace check: another Synapse server is running on this machine (PID ' + (($others | ForEach-Object { $_.Pid }) -join ', ') + ')') -ForegroundColor DarkYellow
    $d = Start-Server @('--stay') $null
  }
  Check (-not $d.HasExited) 'server started (--stay spelling accepted)'
  $stopOut = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $stop -ThisCopyOnly | Out-String
  Check (Wait-Exit $d 5) 'Stop-Synapse.ps1 stops it without a PID'
  Check ($stopOut -match ('Stopped Synapse server PID ' + $d.Id)) 'Stop-Synapse.ps1 says what it stopped'
  Check (-not (Test-Path (Join-Path $logs ('synapse-server-' + $d.Id + '.json')))) 'Stop-Synapse.ps1 removes the runtime file'
} finally {
  foreach ($p in $started) { if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } }
  if ($script:failures -gt 0) {
    foreach ($f in Get-ChildItem $out -File) { Write-Host ('--- ' + $f.Name); Get-Content $f.FullName -Raw | Write-Host }
  }
  Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
}

if ($script:failures -gt 0) { Write-Host ("::error title=Lifecycle.Tests.ps1::$($script:failures) lifecycle check(s) failed"); exit 1 }
Write-Host 'Lifecycle.Tests.ps1 OK'
