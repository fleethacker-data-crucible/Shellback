<#
.SYNOPSIS
  Serves the compiled Shellback app (dist/) to a local browser from 127.0.0.1.

.DESCRIPTION
  Windows PowerShell 5.1 + System.Net.Sockets.TcpListener. No admin rights, no
  installers, no services, no network beyond the loopback adapter. Serves only
  files under the dist directory (GET/HEAD, no directory listings, no traversal).

  Lifecycle (TechStack "Lifecycle rules"): the page POSTs /api/heartbeat every 5 s and a
  sendBeacon "leaving" signal on pagehide; the server stops itself 20 s after the last heartbeat
  from any tab, or 5 s after a leaving signal with no new heartbeat. POST /api/session/stop is
  "End session". Both routes accept only this server's own Origin and Host (there is no session
  token). While running it writes logs\shellback-server-<pid>.json and deletes it on stop.

  TechStack: Launcher .bat -> powershell.exe -File ; Local server PowerShell 5.1 + TcpListener on 127.0.0.1

.PARAMETER Root
  Folder to serve. Defaults to ..\dist relative to this script.

.PARAMETER Port
  TCP port on 127.0.0.1. Default 8765. Keep it stable: the browser keys IndexedDB data by
  origin (scheme + host + PORT), so a different port shows an empty workspace. If the port
  is busy, the next 10 ports are tried and a warning explains the consequence.

.PARAMETER NoBrowser
  Do not open the default browser after the server starts.

.PARAMETER Stay
  Keep the server running after the browser tab closes. By default the tab owns the server: it
  stops itself about 20 s after the last tab closes (5 s after the tab says it is leaving).
  Also: Launch-Shellback.bat --stay, or set SHELLBACK_AUTO_STOP=0 (SYNAPSE_AUTO_STOP=0 still works).

.PARAMETER Replace
  If a Shellback server is already running, stop it and start fresh without asking. Also: --replace

.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\Start-Shellback.ps1

.EXAMPLE
  Launch-Shellback.bat --replace --stay
#>
[CmdletBinding(PositionalBinding = $false)]
param(
  [string]$Root = '',
  [ValidateRange(1, 65535)][int]$Port = 8765,
  [switch]$NoBrowser,
  [switch]$Stay,
  [switch]$Replace,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# Launch-Shellback.bat passes its arguments through; accept the --long spellings too.
foreach ($a in @($Rest)) {
  switch -Regex ($a) {
    '^--?stay$' { $Stay = $true }
    '^--?replace$' { $Replace = $true }
    '^--?no-browser$' { $NoBrowser = $true }
    default { if ($a) { Write-Warning "Ignoring unknown option $a" } }
  }
}

# Resolve the default here, not in param(): $PSScriptRoot can be empty in param defaults on older hosts.
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition }
$appRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir '..')).TrimEnd('\', '/')
if (-not $Root) { $Root = Join-Path $scriptDir '..\dist' }
. (Join-Path $scriptDir 'Shellback-Process.ps1')

# Lifecycle (TechStack "Lifecycle rules"): the browser tab owns this server unless -Stay or SHELLBACK_AUTO_STOP=0.
$autoStop = -not $Stay
# SHELLBACK_AUTO_STOP first; SYNAPSE_AUTO_STOP (the former name) is still read as a fallback.
$autoStopEnv = $env:SHELLBACK_AUTO_STOP
if ($null -eq $autoStopEnv) { $autoStopEnv = $env:SYNAPSE_AUTO_STOP }
if ($autoStopEnv -match '^(0|false|off|no)$') { $autoStop = $false }

$Root = [System.IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
if (-not (Test-Path -LiteralPath (Join-Path $Root 'index.html'))) {
  Write-Error "Compiled application not found at '$Root'. Build off-workstation (npm run build) and copy dist\ here."
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
  '.wasm' = 'application/wasm'
  '.txt'  = 'text/plain; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
}

function Send-Response {
  param([System.IO.Stream]$Stream, [int]$Status, [string]$Reason, [byte[]]$Body, [string]$ContentType, [bool]$HeadOnly, [string]$Extra)
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("HTTP/1.1 $Status $Reason")
  $lines.Add("Content-Type: $ContentType")
  $lines.Add("Content-Length: $($Body.Length)")
  $lines.Add('Connection: close')
  $lines.Add('Cache-Control: no-store')
  $lines.Add('X-Content-Type-Options: nosniff')
  $lines.Add('Referrer-Policy: no-referrer')
  $lines.Add('Cross-Origin-Opener-Policy: same-origin')
  $lines.Add('Cross-Origin-Resource-Policy: same-origin')
  $lines.Add('Permissions-Policy: camera=(), microphone=(), geolocation=()')
  $lines.Add("Content-Security-Policy: frame-ancestors 'none'")
  if ($Extra) { $lines.Add($Extra) }
  $lines.Add('')
  $lines.Add('')
  $head = [System.Text.Encoding]::ASCII.GetBytes(($lines -join "`r`n"))
  $Stream.Write($head, 0, $head.Length)
  if (-not $HeadOnly -and $Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
  $Stream.Flush()
}

function Send-Text {
  param([System.IO.Stream]$Stream, [int]$Status, [string]$Reason, [string]$Text, [bool]$HeadOnly)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  Send-Response -Stream $Stream -Status $Status -Reason $Reason -Body $bytes -ContentType 'text/plain; charset=utf-8' -HeadOnly $HeadOnly -Extra $null
}

# One instance: a second server on the next port would show an empty workspace (data is per port).
$running = @(Get-ShellbackProcesses -Root $appRoot)
if ($running.Count -gt 0) {
  $where = ($running | ForEach-Object { if ($_.Url) { $_.Url + ' (PID ' + $_.Pid + ')' } else { 'PID ' + $_.Pid } }) -join ', '
  Write-Host ('Shellback is already running: ' + $where) -ForegroundColor Yellow
  $answer = 'y'
  if (-not $Replace) {
    try { $answer = Read-Host 'Stop it and start fresh? [Y/n]' } catch { $answer = $null }
  }
  if ($null -eq $answer) {
    Write-Warning 'No console to ask in (non-interactive), so the running server is left alone and another one starts. Pass -Replace to stop it first.'
  } elseif ($answer -eq '' -or $answer -match '^[Yy]') {
    foreach ($p in Stop-ShellbackProcesses -Root $appRoot) { Write-Host ('  stopped Shellback server PID ' + $p) -ForegroundColor DarkGray }
  } else {
    Write-Host 'Leaving the running server alone. Use "End session" in its browser tab, or tools\Stop-Shellback.ps1.' -ForegroundColor DarkGray
    $existing = @($running | Where-Object { $_.Url })
    if (-not $NoBrowser -and $existing.Count -gt 0) { try { Start-Process $existing[0].Url | Out-Null } catch { } }
    exit 0
  }
}

$listener = $null
$boundPort = 0
for ($candidate = $Port; $candidate -le [Math]::Min(65535, $Port + 10); $candidate++) {
  try {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $candidate)
    $listener.Start()
    $boundPort = $candidate
    break
  } catch {
    $listener = $null
  }
}
if (-not $listener) { Write-Error "Ports $Port-$($Port + 10) on 127.0.0.1 are all in use. Close the other program or pass -Port."; exit 1 }
if ($boundPort -ne $Port) {
  Write-Warning "Port $Port is busy; using $boundPort. Browser data is stored per port, so this session will not show workspace data saved on port $Port."
}
$url = "http://127.0.0.1:$boundPort/"
# Only this page may call the lifecycle routes: another site (or a DNS-rebinding name) must not stop the app.
# Shellback has no session token, so the Origin and Host headers are the check.
$allowedOrigins = @("http://127.0.0.1:$boundPort", "http://localhost:$boundPort")
$allowedHosts = @("127.0.0.1:$boundPort", "localhost:$boundPort")
$presence = New-ShellbackPresence -AutoStop $autoStop
$runtimeFile = $null
$stopReason = ''

Write-Host ''
Write-Host '  SHELLBACK  offline synthetic pilot' -ForegroundColor Cyan
Write-Host "  Serving $Root"
Write-Host "  Open    $url" -ForegroundColor Green
Write-Host '  Loopback only. No login, no telemetry. Do not enter real personnel data.' -ForegroundColor DarkYellow
if ($autoStop) {
  Write-Host '  Closing the browser tab stops this server (about 20 s later). End session in the app, or Ctrl+C here, stops it now.'
} else {
  Write-Host '  Auto-stop is off (-Stay or SHELLBACK_AUTO_STOP=0). Press Ctrl+C in this window, or run tools\Stop-Shellback.ps1, to stop.'
}
Write-Host ''

if (-not $NoBrowser) {
  try { Start-Process $url | Out-Null } catch { Write-Warning "Could not open a browser automatically. Browse to $url" }
}

$lastTick = [DateTime]::UtcNow
try {
  $runtimeFile = Write-ShellbackRuntimeFile -Root $appRoot -Port $boundPort -Url $url
  while (-not $stopReason) {
    $now = [DateTime]::UtcNow
    if (($now - $lastTick).TotalMilliseconds -ge 1000) {
      $lastTick = $now
      if (Test-ShellbackBrowserGone -State $presence -Now $now) { $stopReason = 'The browser tab closed; stopping (SHELLBACK_AUTO_STOP=0 or -Stay keeps the server running).'; break }
    }
    # Poll instead of blocking in AcceptTcpClient so Ctrl+C is handled promptly by PowerShell.
    if (-not $listener.Pending()) { Start-Sleep -Milliseconds 40; continue }
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $client.SendTimeout = 10000
      $stream = $client.GetStream()
      # Browsers open speculative (preconnect) sockets that may never send a request.
      # Give a connection 300 ms to start talking; otherwise drop it so real requests are not
      # stuck behind it (the browser simply opens a new connection when it needs one).
      $waited = 0
      while (-not $stream.DataAvailable -and $waited -lt 300) { Start-Sleep -Milliseconds 10; $waited += 10 }
      if (-not $stream.DataAvailable) { continue }
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      if (-not $requestLine) { continue }
      # Headers: static GET/HEAD ignores them; the lifecycle routes check Host and Origin.
      $headers = @{}
      while ($true) {
        $h = $reader.ReadLine(); if ($null -eq $h -or $h -eq '') { break }
        $colon = $h.IndexOf(':')
        if ($colon -gt 0 -and $headers.Count -lt 64) { $headers[$h.Substring(0, $colon).Trim().ToLowerInvariant()] = $h.Substring($colon + 1).Trim() }
      }

      $parts = $requestLine.Split(' ')
      if ($parts.Length -lt 2) { Send-Text -Stream $stream -Status 400 -Reason 'Bad Request' -Text 'Bad request' -HeadOnly $false; continue }
      $method = $parts[0].ToUpperInvariant()
      $target = $parts[1]
      $headOnly = ($method -eq 'HEAD')

      $apiPath = $target.Split('?')[0]
      if ($apiPath -eq '/api/heartbeat' -or $apiPath -eq '/api/session/stop') {
        if ($method -ne 'POST') { Send-Text -Stream $stream -Status 405 -Reason 'Method Not Allowed' -Text 'Method not allowed' -HeadOnly $false; continue }
        $origin = $headers['origin']; $hostHeader = $headers['host']
        if (-not $origin -or $allowedOrigins -notcontains $origin -or -not $hostHeader -or $allowedHosts -notcontains $hostHeader) {
          Send-Text -Stream $stream -Status 403 -Reason 'Forbidden' -Text 'Forbidden' -HeadOnly $false; continue
        }
        # Small JSON body; never logged. Shellback has no session token, so there is nothing secret in it.
        $length = 0
        if ($headers['content-length']) { [void][int]::TryParse($headers['content-length'], [ref]$length) }
        if ($length -lt 0 -or $length -gt 4096) { Send-Text -Stream $stream -Status 413 -Reason 'Payload Too Large' -Text 'Too large' -HeadOnly $false; continue }
        $body = $null
        if ($length -gt 0) {
          $buffer = New-Object char[] $length
          $read = 0
          while ($read -lt $length) { $n = $reader.Read($buffer, $read, $length - $read); if ($n -le 0) { break }; $read += $n }
          try { $body = [System.String]::new($buffer, 0, $read) | ConvertFrom-Json } catch { $body = $null }
        }
        if ($apiPath -eq '/api/heartbeat') {
          $tab = ''; $leaving = $false
          if ($body -and $body.PSObject.Properties['tab']) { $tab = [string]$body.tab }
          if ($body -and $body.PSObject.Properties['leaving']) { $leaving = [bool]$body.leaving }
          if ($tab.Length -gt 64) { $tab = $tab.Substring(0, 64) }
          Update-ShellbackPresence -State $presence -TabId $tab -Leaving:$leaving
          Send-Response -Stream $stream -Status 204 -Reason 'No Content' -Body ([byte[]]@()) -ContentType 'text/plain; charset=utf-8' -HeadOnly $false -Extra $null
        } else {
          # End session: a custom header, so a cross-site form or beacon cannot trigger it.
          # X-Synapse-Intent is the former header name, still accepted so an older open tab can end its session.
          $intent = $headers['x-shellback-intent']
          if (-not $intent) { $intent = $headers['x-synapse-intent'] }
          if ($intent -ne 'end-session') { Send-Text -Stream $stream -Status 403 -Reason 'Forbidden' -Text 'Forbidden' -HeadOnly $false; continue }
          Send-Text -Stream $stream -Status 200 -Reason 'OK' -Text 'Stopping' -HeadOnly $false
          $stopReason = 'End session was chosen in the browser; stopping.'
        }
        continue
      }
      if ($method -ne 'GET' -and -not $headOnly) { Send-Text -Stream $stream -Status 405 -Reason 'Method Not Allowed' -Text 'Method not allowed' -HeadOnly $false; continue }

      $pathPart = $target.Split('?')[0]
      $relative = [System.Uri]::UnescapeDataString($pathPart)
      if ($relative.EndsWith('/')) { $relative = $relative + 'index.html' }
      $relative = $relative.TrimStart('/').Replace('/', '\')
      $full = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))

      if (-not $full.StartsWith($Root + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Text -Stream $stream -Status 403 -Reason 'Forbidden' -Text 'Forbidden' -HeadOnly $headOnly; continue
      }
      if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        Send-Text -Stream $stream -Status 404 -Reason 'Not Found' -Text 'Not found' -HeadOnly $headOnly; continue
      }

      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $type = $mime[$ext]
      if (-not $type) { $type = 'application/octet-stream' }
      $extra = $null
      if ($relative -ieq 'sw.js') { $extra = 'Service-Worker-Allowed: /' }
      $body = [System.IO.File]::ReadAllBytes($full)
      Send-Response -Stream $stream -Status 200 -Reason 'OK' -Body $body -ContentType $type -HeadOnly $headOnly -Extra $extra
    } catch {
      Write-Verbose ("Request failed: " + $_.Exception.Message)
    } finally {
      try { $client.Close() } catch { }
    }
  }
} finally {
  $listener.Stop()
  Remove-ShellbackRuntimeFile -Path $runtimeFile
  if ($stopReason) { Write-Host $stopReason -ForegroundColor DarkGray }
  Write-Host 'Shellback server stopped.'
}
