#requires -Version 5.1
# Account-token forwarder for the Fairlead preset (issue 62).
# Same rules as tools/fairlead-forward.mjs, for the Windows PowerShell 5.1 server:
#   1. FAIRLEAD_LOCAL_TOKEN=off refuses.
#   2. Only GET /v1/models and POST /v1/chat/completions.
#   3. Read the first line of %LOCALAPPDATA%\Fairlead\local-token (or FAIRLEAD_LOCAL_TOKEN_FILE). Never log it.
#   4. GET http://127.0.0.1:8776/__fleethacker/id with no token. tool must be fairlead, with pid and path.
#   5. Exactly one loopback listener on 8776, and its pid must match. The path must be that process's executable or -File script.
#   6. Forward with Authorization Bearer, X-Fairlead-Label: Shellback, and X-Fairlead-Privacy: local.
#   7. Scrub the token out of any text we return.

$script:ShellbackFairleadOrigin = 'http://127.0.0.1:8776'
$script:ShellbackFairleadLabel = 'Shellback'

function Test-ShellbackFairleadTokenOff {
  $v = $env:FAIRLEAD_LOCAL_TOKEN
  if (-not $v) { return $false }
  return @('off', '0', 'false', 'no') -contains $v.Trim().ToLowerInvariant()
}

function Get-ShellbackFairleadTokenPath {
  if ($env:FAIRLEAD_LOCAL_TOKEN_FILE) { return $env:FAIRLEAD_LOCAL_TOKEN_FILE }
  $base = $env:LOCALAPPDATA
  if (-not $base) { $base = [Environment]::GetFolderPath('LocalApplicationData') }
  if (-not $base) { return $null }
  return [IO.Path]::Combine($base, 'Fairlead', 'local-token')
}

function Read-ShellbackFairleadLocalToken {
  param([string]$Path)
  try {
    if (-not $Path -or -not [IO.File]::Exists($Path)) { return $null }
    if ((New-Object IO.FileInfo $Path).Length -gt 4096) { return $null }
    $text = [IO.File]::ReadAllText($Path)
    $line = ($text -split "`r?`n", 2)[0]
    if ($null -eq $line) { return $null }
    $line = $line.Trim().TrimStart([char]0xFEFF)
    if (-not $line -or $line.Length -gt 2000) { return $null }
    return $line
  } catch { return $null }
}

function Convert-ShellbackFairleadScrub {
  param([string]$Text, [string]$Token)
  if (-not $Text) { return '' }
  if ($Token) { $Text = $Text.Replace($Token, '[key]') }
  $Text = [regex]::Replace($Text, '[\x00-\x1F\x7F]+', ' ').Trim()
  if ($Text.Length -gt 300) { $Text = $Text.Substring(0, 300) + '...' }
  return $Text
}

function Test-ShellbackFairleadForward {
  param([string]$Method, [string]$Path)
  if ($Method -eq 'GET' -and $Path -eq '/v1/models') { return $true }
  if ($Method -eq 'POST' -and $Path -eq '/v1/chat/completions') { return $true }
  return $false
}

function Get-ShellbackJsonProp {
  param($Object, [string]$Name)
  if ($null -eq $Object) { return $null }
  $prop = $Object.PSObject.Properties[$Name]
  if ($prop) { return $prop.Value }
  return $null
}

function Get-ShellbackLoopbackListenerPids {
  param([int]$Port)
  # Ok $false means the check could not run, so the token must not be sent.
  if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { return @{ Ok = $false; Pids = @() } }
  try { $rows = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop) }
  catch { return @{ Ok = $false; Pids = @() } }
  $found = New-Object System.Collections.Generic.List[int]
  foreach ($row in $rows) {
    $ip = [string]$row.LocalAddress
    if ($ip -ne '127.0.0.1' -and $ip -ne '::1' -and $ip -ne '0.0.0.0' -and $ip -ne '::') { continue }
    $procId = [int]$row.OwningProcess
    if (-not $found.Contains($procId)) { [void]$found.Add($procId) }
  }
  return @{ Ok = $true; Pids = @($found.ToArray()) }
}

function Get-ShellbackProcessRunPaths {
  param([int]$ProcessId)
  $exe = ''
  $scriptPath = ''
  try {
    $proc = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId=" + $ProcessId) -ErrorAction Stop
    $exe = [string]$proc.ExecutablePath
    $cmd = [string]$proc.CommandLine
    $match = [regex]::Match($cmd, '(?i)(?:^|\s)-File\s+(?:"([^"]+)"|(\S+))')
    if ($match.Success) {
      if ($match.Groups[1].Success) { $scriptPath = $match.Groups[1].Value } else { $scriptPath = $match.Groups[2].Value }
    }
  } catch { }
  return @($exe, $scriptPath)
}

function Convert-ShellbackNormalPath {
  param([string]$Path)
  if (-not $Path) { return '' }
  try { return [IO.Path]::GetFullPath($Path).TrimEnd('\') } catch { return '' }
}

function Test-ShellbackSamePath {
  param([string]$Left, [string]$Right)
  $a = Convert-ShellbackNormalPath $Left
  $b = Convert-ShellbackNormalPath $Right
  if (-not $a -or -not $b) { return $false }
  return [string]::Equals($a, $b, [StringComparison]::OrdinalIgnoreCase)
}

function Invoke-ShellbackFairleadGetId {
  $req = [Net.HttpWebRequest]::Create($script:ShellbackFairleadOrigin + '/__fleethacker/id')
  $req.Method = 'GET'
  $req.Timeout = 3000
  $req.ReadWriteTimeout = 3000
  $req.Proxy = $null
  $req.AllowAutoRedirect = $false
  $req.Accept = 'application/json'
  $req.UserAgent = 'Shellback'
  $resp = $null
  try {
    $resp = $req.GetResponse()
    if ([int]$resp.StatusCode -ne 200) { return @{ Ok = $false; Error = 'Fairlead did not identify itself, so the account token was not sent.' } }
    $reader = New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)
    try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
    if ($text.Length -gt 4096) { return @{ Ok = $false; Error = 'Fairlead did not identify itself, so the account token was not sent.' } }
    $id = $text | ConvertFrom-Json
    $tool = [string](Get-ShellbackJsonProp $id 'tool')
    if ($tool -cne 'fairlead') {
      $who = 'something else'
      if ($tool -cmatch '\A[A-Za-z0-9._-]{1,40}\z') { $who = '"' + $tool + '"' }
      return @{ Ok = $false; Error = ('The program on the Fairlead port is ' + $who + ', not Fairlead, so the account token was not sent.') }
    }
    $idPid = 0
    if (-not [int]::TryParse([string](Get-ShellbackJsonProp $id 'pid'), [ref]$idPid) -or $idPid -le 0) {
      return @{ Ok = $false; Error = 'Fairlead did not report the process that holds its port, so the account token was not sent.' }
    }
    $reported = [string](Get-ShellbackJsonProp $id 'path')
    if (-not $reported.Trim()) { return @{ Ok = $false; Error = 'Fairlead did not report its program path, so the account token was not sent.' } }
    return @{ Ok = $true; Pid = $idPid; Path = $reported.Trim() }
  } catch {
    return @{ Ok = $false; Error = 'Fairlead is not running on 127.0.0.1:8776, or it did not identify itself. The account token was not sent.' }
  } finally {
    if ($null -ne $resp) { try { $resp.Close() } catch { } }
  }
}

function Invoke-ShellbackFairleadForward {
  param([string]$Method, [string]$RelPath, [byte[]]$Body, [string]$Token)
  $req = [Net.HttpWebRequest]::Create($script:ShellbackFairleadOrigin + $RelPath)
  $req.Method = $Method
  $req.Timeout = 45000
  $req.ReadWriteTimeout = 45000
  $req.Proxy = $null
  $req.AllowAutoRedirect = $false
  $req.Accept = 'application/json'
  $req.UserAgent = 'Shellback'
  $req.Headers.Add('Authorization', 'Bearer ' + $Token)
  $req.Headers.Add('X-Fairlead-Label', $script:ShellbackFairleadLabel)
  $req.Headers.Add('X-Fairlead-Privacy', 'local')
  $resp = $null
  try {
    if ($Method -eq 'POST') {
      $bytes = $Body
      if ($null -eq $bytes) { $bytes = New-Object byte[] 0 }
      $req.ContentType = 'application/json'
      $req.ContentLength = $bytes.Length
      $out = $req.GetRequestStream()
      try { if ($bytes.Length -gt 0) { $out.Write($bytes, 0, $bytes.Length) } } finally { $out.Dispose() }
    }
    try { $resp = $req.GetResponse() }
    catch [Net.WebException] {
      if ($null -eq $_.Exception.Response) { throw }
      $resp = $_.Exception.Response
    }
    $status = [int]$resp.StatusCode
    if ($status -ge 300 -and $status -lt 400) {
      return @{ Status = 502; Reason = 'Bad Gateway'; ContentType = 'text/plain; charset=utf-8'; Bytes = [Text.Encoding]::UTF8.GetBytes('Fairlead redirected the request, so Shellback stopped.') }
    }
    $stream = $resp.GetResponseStream()
    $ms = New-Object IO.MemoryStream
    try {
      $buf = New-Object byte[] 8192
      while (($n = $stream.Read($buf, 0, $buf.Length)) -gt 0) {
        if (($ms.Length + $n) -gt 2097152) {
          return @{ Status = 502; Reason = 'Bad Gateway'; ContentType = 'text/plain; charset=utf-8'; Bytes = [Text.Encoding]::UTF8.GetBytes('Fairlead sent an answer larger than Shellback accepts.') }
        }
        $ms.Write($buf, 0, $n)
      }
    } finally { $stream.Dispose() }
    $raw = $ms.ToArray()
    $ctype = [string]$resp.ContentType
    if (-not $ctype) { $ctype = 'application/json; charset=utf-8' }
    if (($ctype -like 'application/json*' -or $ctype -like 'text/*') -and $Token) {
      $text = [Text.Encoding]::UTF8.GetString($raw)
      if ($text.Contains($Token)) { $raw = [Text.Encoding]::UTF8.GetBytes($text.Replace($Token, '[key]')) }
    }
    $reason = $(if ($status -eq 200) { 'OK' } else { 'Error' })
    return @{ Status = $status; Reason = $reason; ContentType = $ctype; Bytes = $raw }
  } catch {
    $msg = Convert-ShellbackFairleadScrub $_.Exception.Message $Token
    if (-not $msg) { $msg = 'Fairlead could not be reached.' }
    return @{ Status = 502; Reason = 'Bad Gateway'; ContentType = 'text/plain; charset=utf-8'; Bytes = [Text.Encoding]::UTF8.GetBytes($msg) }
  } finally {
    if ($null -ne $resp) { try { $resp.Close() } catch { } }
  }
}

function New-ShellbackFairleadText {
  param([int]$Status, [string]$Reason, [string]$Text)
  return @{ Status = $Status; Reason = $Reason; ContentType = 'text/plain; charset=utf-8'; Bytes = [Text.Encoding]::UTF8.GetBytes($Text) }
}

function Invoke-ShellbackFairleadProxy {
  param(
    [string]$Method,
    [string]$TargetPath,
    [AllowNull()][byte[]]$Body,
    [string]$Origin,
    [string]$HostHeader,
    [string[]]$AllowedOrigins,
    [string[]]$AllowedHosts
  )
  if ($AllowedOrigins -notcontains $Origin -or $AllowedHosts -notcontains $HostHeader) {
    return (New-ShellbackFairleadText 403 'Forbidden' 'Forbidden')
  }
  if ($TargetPath.Contains('?')) { return (New-ShellbackFairleadText 400 'Bad Request' 'Bad request') }
  $rel = $TargetPath
  $prefix = '/api/fairlead'
  if ($rel.StartsWith($prefix)) { $rel = $rel.Substring($prefix.Length) }
  if (-not $rel.StartsWith('/')) { $rel = '/' + $rel }
  if (-not (Test-ShellbackFairleadForward -Method $Method -Path $rel)) {
    if ($Method -ne 'GET' -and $Method -ne 'POST') { return (New-ShellbackFairleadText 405 'Method Not Allowed' 'Method not allowed') }
    return (New-ShellbackFairleadText 404 'Not Found' 'Not found')
  }
  if ($null -ne $Body -and $Body.Length -gt 524288) { return (New-ShellbackFairleadText 413 'Payload Too Large' 'Too large') }
  if (Test-ShellbackFairleadTokenOff) {
    return (New-ShellbackFairleadText 503 'Service Unavailable' 'Fairlead account token is turned off (FAIRLEAD_LOCAL_TOKEN=off). Add a key under Program → Intelligence, or turn the switch back on.')
  }
  $token = Read-ShellbackFairleadLocalToken -Path (Get-ShellbackFairleadTokenPath)
  if (-not $token) {
    return (New-ShellbackFairleadText 503 'Service Unavailable' 'Fairlead has no account token for this Windows account yet. Start Fairlead once so it can write %LOCALAPPDATA%\Fairlead\local-token, or add a key under Program → Intelligence.')
  }
  $id = Invoke-ShellbackFairleadGetId
  if (-not $id.Ok) { return (New-ShellbackFairleadText 502 'Bad Gateway' ([string]$id.Error)) }
  $listen = Get-ShellbackLoopbackListenerPids -Port 8776
  if (-not $listen.Ok) {
    return (New-ShellbackFairleadText 503 'Service Unavailable' 'Shellback could not see which program listens on the Fairlead port, so the account token was not sent.')
  }
  $listenerList = @($listen.Pids)
  if ($listenerList.Count -eq 0) {
    return (New-ShellbackFairleadText 502 'Bad Gateway' 'Fairlead is not running on 127.0.0.1:8776. Start Fairlead, then try again. The account token was not sent.')
  }
  if ($listenerList.Count -ne 1 -or [int]$listenerList[0] -ne [int]$id.Pid) {
    return (New-ShellbackFairleadText 502 'Bad Gateway' 'Something other than the program that identified itself as Fairlead is holding port 8776, so the account token was not sent.')
  }
  $paths = @(Get-ShellbackProcessRunPaths -ProcessId ([int]$id.Pid))
  $match = $false
  foreach ($candidate in $paths) { if (Test-ShellbackSamePath $candidate ([string]$id.Path)) { $match = $true } }
  if (-not $match) {
    return (New-ShellbackFairleadText 502 'Bad Gateway' 'The program on port 8776 reports a path that is not what that process runs, so the account token was not sent.')
  }
  return (Invoke-ShellbackFairleadForward -Method $Method -RelPath $rel -Body $Body -Token $token)
}
