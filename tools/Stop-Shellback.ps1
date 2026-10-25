#requires -Version 5.1
<#
.SYNOPSIS
  Stops every running Shellback server on this machine.

.DESCRIPTION
  The server normally stops itself when its last browser tab closes, or from "End session" in the
  app. This script is the fallback and needs no PIDs: it reads the runtime files the server writes
  under logs\ (one per process, stale ones are removed), then looks for any PowerShell still running
  Start-Shellback.ps1. npm run build / npm run serve call it (with -ThisCopyOnly) before they start.

.PARAMETER Quiet
  Print nothing unless something was stopped.

.PARAMETER ThisCopyOnly
  Only stop servers started from this folder's tools\Start-Shellback.ps1 (build scripts use this).

.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\Stop-Shellback.ps1
#>
[CmdletBinding()]
param([switch]$Quiet, [switch]$ThisCopyOnly)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition }
$root = [System.IO.Path]::GetFullPath((Join-Path $scriptDir '..')).TrimEnd('\', '/')
. (Join-Path $scriptDir 'Shellback-Process.ps1')

$stopped = Stop-ShellbackProcesses -Root $root -ThisCopyOnly:$ThisCopyOnly
if ($stopped.Count -gt 0) {
  foreach ($p in $stopped) { Write-Host ('Stopped Shellback server PID ' + $p + '.') -ForegroundColor Yellow }
} elseif (-not $Quiet) {
  Write-Host 'No Shellback server is running.' -ForegroundColor DarkGray
}
