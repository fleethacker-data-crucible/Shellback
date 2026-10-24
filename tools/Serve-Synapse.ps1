<#
.SYNOPSIS
  Serves the compiled Synapse app (dist/) to a local browser from 127.0.0.1.

.DESCRIPTION
  Windows PowerShell 5.1 + System.Net.Sockets.TcpListener. No admin rights, no
  installers, no services, no network beyond the loopback adapter. Serves only
  files under the dist directory (GET/HEAD, no directory listings, no traversal).

  TechStack: Launcher .bat -> powershell.exe -File ; Local server PowerShell 5.1 + TcpListener on 127.0.0.1

.PARAMETER Root
  Folder to serve. Defaults to ..\dist relative to this script.

.PARAMETER Port
  TCP port on 127.0.0.1. 0 (default) lets Windows pick a free ephemeral port.

.PARAMETER NoBrowser
  Do not open the default browser after the server starts.

.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\Serve-Synapse.ps1
#>
[CmdletBinding()]
param(
  [string]$Root = (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\dist'),
  [ValidateRange(0, 65535)][int]$Port = 0,
  [switch]$NoBrowser
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Root = [System.IO.Path]::GetFullPath($Root)
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

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
$boundPort = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$url = "http://127.0.0.1:$boundPort/"

Write-Host ''
Write-Host '  SYNAPSE  offline synthetic pilot' -ForegroundColor Cyan
Write-Host "  Serving $Root"
Write-Host "  Open    $url" -ForegroundColor Green
Write-Host '  Loopback only. No login, no telemetry. Do not enter real personnel data.' -ForegroundColor DarkYellow
Write-Host '  Press Ctrl+C in this window to stop.'
Write-Host ''

if (-not $NoBrowser) {
  try { Start-Process $url | Out-Null } catch { Write-Warning "Could not open a browser automatically. Browse to $url" }
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $client.SendTimeout = 10000
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      if (-not $requestLine) { continue }
      # Drain headers (we do not need them for static GET/HEAD).
      while ($true) { $h = $reader.ReadLine(); if ($null -eq $h -or $h -eq '') { break } }

      $parts = $requestLine.Split(' ')
      if ($parts.Length -lt 2) { Send-Text -Stream $stream -Status 400 -Reason 'Bad Request' -Text 'Bad request' -HeadOnly $false; continue }
      $method = $parts[0].ToUpperInvariant()
      $target = $parts[1]
      $headOnly = ($method -eq 'HEAD')
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
  Write-Host 'Synapse server stopped.'
}
