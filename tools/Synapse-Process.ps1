#requires -Version 5.1
# Dot-sourced helpers for the Synapse server lifecycle (TechStack "Lifecycle rules"):
#   - the presence rule (the browser tab owns the server),
#   - runtime files under logs\ (one per running server),
#   - finding and stopping running servers without knowing PIDs.
# Used by Serve-Synapse.ps1 (single-instance guard, auto-stop), Stop-Synapse.ps1 and the CI tests.

# ---------------------------------------------------------------------------- presence rule

function New-SynapsePresence {
  <#
  .SYNOPSIS
    Presence state for one server. AutoStop is off with -Stay or SYNAPSE_AUTO_STOP=0.
  #>
  param([bool]$AutoStop = $true, [double]$TimeoutSeconds = 20, [double]$LeavingGraceSeconds = 5, [double]$StaleSeconds = 11)
  return @{
    AutoStop            = $AutoStop
    TimeoutSeconds      = $TimeoutSeconds
    LeavingGraceSeconds = $LeavingGraceSeconds
    StaleSeconds        = $StaleSeconds   # after a leaving signal, a tab that missed two heartbeats no longer counts
    Tabs                = @{}      # tab id -> last heartbeat (UTC DateTime)
    LastHeartbeat       = $null    # last heartbeat from any tab
    LeavingAt           = $null    # last "leaving" signal (pagehide beacon)
    Busy                = $false   # a background job is running (Synapse has none today; kept for the rule)
  }
}

function Update-SynapsePresence {
  <#
  .SYNOPSIS
    Records a heartbeat (or, with -Leaving, the pagehide beacon) from one tab.
  #>
  param([Parameter(Mandatory = $true)][hashtable]$State, [string]$TabId, [switch]$Leaving, [DateTime]$Now = [DateTime]::UtcNow)
  if (-not $TabId) { $TabId = 'tab' }
  if ($Leaving) {
    $State.Tabs.Remove($TabId)
    $State.LeavingAt = $Now
  } else {
    $State.Tabs[$TabId] = $Now
    $State.LastHeartbeat = $Now
    $State.LeavingAt = $null
  }
}

function Test-SynapseBrowserGone {
  <#
  .SYNOPSIS
    True when no tab is alive any more and nothing is running: the server should stop.
    A tab is alive for TimeoutSeconds after its last heartbeat. After a leaving signal the
    server waits LeavingGraceSeconds for a fresh heartbeat (a reload sends one at once).
    Before the first heartbeat it never stops (-NoBrowser; the console stays visible).
  #>
  param([Parameter(Mandatory = $true)][hashtable]$State, [DateTime]$Now = [DateTime]::UtcNow)
  if (-not $State.AutoStop -or $State.Busy) { return $false }
  if ($null -eq $State.LastHeartbeat) { return $false }
  foreach ($id in @($State.Tabs.Keys)) {
    $age = ($Now - [DateTime]$State.Tabs[$id]).TotalSeconds
    # Browsers sometimes drop the pagehide beacon of a page being reloaded; without this a ghost tab id
    # would keep the server alive for the full timeout after the real last tab left.
    if ($age -ge $State.TimeoutSeconds -or ($null -ne $State.LeavingAt -and $age -ge $State.StaleSeconds)) { $State.Tabs.Remove($id) }
  }
  if ($State.Tabs.Count -gt 0) { return $false }
  if ($null -ne $State.LeavingAt -and ($Now - [DateTime]$State.LeavingAt).TotalSeconds -ge $State.LeavingGraceSeconds) { return $true }
  return (($Now - [DateTime]$State.LastHeartbeat).TotalSeconds -ge $State.TimeoutSeconds)
}

# ---------------------------------------------------------------------------- runtime files

function Get-SynapseLogsDir {
  param([Parameter(Mandatory = $true)][string]$Root)
  return (Join-Path $Root 'logs')
}

function Write-SynapseRuntimeFile {
  <#
  .SYNOPSIS
    Writes logs\synapse-server-<pid>.json (pid, port, url, startedAt) and returns its path,
    or $null when the folder is not writable. Synapse has no session token; nothing secret is written.
  #>
  param([Parameter(Mandatory = $true)][string]$Root, [int]$Port, [string]$Url)
  try {
    $dir = Get-SynapseLogsDir -Root $Root
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $path = Join-Path $dir ('synapse-server-' + $PID + '.json')
    $info = [ordered]@{ pid = $PID; port = $Port; url = $Url; startedAt = [DateTime]::UtcNow.ToString('o') }
    [System.IO.File]::WriteAllText($path, (ConvertTo-Json -InputObject $info), (New-Object System.Text.UTF8Encoding($false)))
    return $path
  } catch {
    Write-Warning ('Could not write the runtime file under ' + $Root + '\logs (' + $_.Exception.Message + '). Stop-Synapse.ps1 will still find this server by its command line.')
    return $null
  }
}

function Remove-SynapseRuntimeFile {
  param([string]$Path)
  if ($Path) { Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue }
}

# ---------------------------------------------------------------------------- find / stop

function Get-SynapseProcesses {
  <#
  .SYNOPSIS
    Running Synapse servers: PID, port and URL, from the runtime files under logs\ plus any
    PowerShell whose command line runs Serve-Synapse.ps1. Stale runtime files (dead pid) are removed.
  .PARAMETER ThisCopyOnly
    Only match command lines that run this copy's tools\Serve-Synapse.ps1 (used by CI on a shared machine).
  #>
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$Root, [switch]$ThisCopyOnly)
  $found = @{}
  $logs = Get-SynapseLogsDir -Root $Root
  if (Test-Path -LiteralPath $logs) {
    foreach ($f in Get-ChildItem -LiteralPath $logs -Filter 'synapse-server-*.json' -ErrorAction SilentlyContinue) {
      try {
        $info = Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json
        $id = [int]$info.pid
        $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($id -ne $PID -and $proc -and $proc.ProcessName -match '^(powershell|pwsh)$') {
          $found[$id] = [pscustomobject]@{ Pid = $id; Port = $info.port; Url = $info.url; Started = $info.startedAt; RuntimeFile = $f.FullName }
        } elseif ($id -ne $PID) {
          Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue
        }
      } catch { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue }
    }
  }
  $pattern = 'Serve-Synapse\.ps1'
  if ($ThisCopyOnly) { $pattern = [regex]::Escape((Join-Path $Root 'tools\Serve-Synapse.ps1')) }
  try {
    $mine = $PID
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.ProcessId -ne $mine -and $_.CommandLine -and $_.CommandLine -match $pattern } |
      ForEach-Object {
        if (-not $found.ContainsKey([int]$_.ProcessId)) {
          $found[[int]$_.ProcessId] = [pscustomobject]@{ Pid = [int]$_.ProcessId; Port = $null; Url = $null; Started = $_.CreationDate; RuntimeFile = $null }
        }
      }
  } catch { }
  return @($found.Values | Sort-Object Pid)
}

function Stop-SynapseProcesses {
  <#
  .SYNOPSIS
    Stops every running Synapse server and returns the PIDs stopped. Their runtime files are removed
    (a forced stop skips the server's own cleanup). Access denied is reported, not thrown.
  #>
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][string]$Root, [switch]$ThisCopyOnly)
  $stopped = New-Object System.Collections.Generic.List[int]
  foreach ($p in Get-SynapseProcesses -Root $Root -ThisCopyOnly:$ThisCopyOnly) {
    try {
      Stop-Process -Id $p.Pid -Force -ErrorAction Stop
      $stopped.Add($p.Pid)
      $file = Join-Path (Get-SynapseLogsDir -Root $Root) ('synapse-server-' + $p.Pid + '.json')
      Remove-SynapseRuntimeFile -Path $file
    } catch {
      Write-Warning ('Could not stop Synapse server PID ' + $p.Pid + ': ' + $_.Exception.Message + ' (started from an administrator window? Close that window.)')
    }
  }
  if ($stopped.Count -gt 0) { Start-Sleep -Milliseconds 300 }  # let the port close
  return ,$stopped
}
