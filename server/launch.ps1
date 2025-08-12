param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'SilentlyContinue'

# Resolve paths
$serverDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Join-Path $serverDir '..'
$serverJs = Join-Path $serverDir 'server.js'
$psServer = Join-Path $serverDir 'ps_server.ps1'

# Logging
$logFile = Join-Path $serverDir 'launch.log'
function Write-Log { param([string]$msg) $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'); "$ts `t $msg" | Out-File -FilePath $logFile -Encoding UTF8 -Append }

# Start server (Node preferred; fallback to PowerShell server)
$env:PORT = "$Port"
$serverProc = $null
$nodeCmd = (Get-Command node -ErrorAction SilentlyContinue)
if ($nodeCmd) {
  Write-Log "Starting Node server: $serverJs"
  $serverProc = Start-Process -FilePath $nodeCmd.Source -ArgumentList "`"$serverJs`"" -WindowStyle Hidden -PassThru -WorkingDirectory $projectRoot
} elseif (Test-Path $psServer) {
  Write-Log "Starting PS server: $psServer"
  $psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $serverProc = Start-Process -FilePath $psExe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"$psServer",'-Port',"$Port") -WindowStyle Hidden -PassThru -WorkingDirectory $projectRoot
} else {
  [Console]::Error.WriteLine("Neither Node.js nor PowerShell server available. Expected: node or $psServer")
  Write-Log "ERROR: Neither Node.js nor PS server found"
  exit 1
}

# Health check
$healthy = $false
for ($i=0; $i -lt 40; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri ("http://localhost:" + $Port + "/") -TimeoutSec 1 -Method GET
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { $healthy = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 250
}
if (-not $healthy) { Write-Log "WARN: Health check not confirmed within timeout" }

# Browser resolution
function Resolve-Exe {
  param([string]$exeName, [string[]]$fallbacks)
  # PATH
  $cmd = (Get-Command $exeName -ErrorAction SilentlyContinue)
  if ($cmd) { return $cmd.Source }
  # Fallback known locations
  foreach ($p in $fallbacks) { if (Test-Path $p) { return $p } }
  return $null
}

$edgePath = Resolve-Exe 'msedge.exe' @(
  (Join-Path ${env:ProgramFiles} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path ${env:"ProgramFiles(x86)"} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path ${env:LOCALAPPDATA} 'Microsoft\Edge\Application\msedge.exe')
)
$chromePath = Resolve-Exe 'chrome.exe' @(
  (Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:"ProgramFiles(x86)"} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:LOCALAPPDATA} 'Google\Chrome\Application\chrome.exe')
)
$bravePath = Resolve-Exe 'brave.exe' @(
  (Join-Path ${env:ProgramFiles} 'BraveSoftware\Brave-Browser\Application\brave.exe'),
  (Join-Path ${env:"ProgramFiles(x86)"} 'BraveSoftware\Brave-Browser\Application\brave.exe'),
  (Join-Path ${env:LOCALAPPDATA} 'BraveSoftware\Brave-Browser\Application\brave.exe')
)
Write-Log "Detected Edge='$edgePath' Chrome='$chromePath' Brave='$bravePath'"

$targetUrl = "http://localhost:$Port/"
$profileDir = Join-Path $env:TEMP ("ChatBotBrowser-" + $Port + "-" + $PID)
New-Item -ItemType Directory -Path $profileDir -Force | Out-Null

# Helper: get process count by image name (prefer Get-Process, fallback to tasklist)
function Get-ImageCount {
  param([string]$imageName)
  try {
    $base = ($imageName -replace '\.exe$','')
    $c = (Get-Process -Name $base -ErrorAction SilentlyContinue).Count
    if ($c -ge 0) { return $c }
  } catch {}
  try {
    $out = & cmd.exe /c "tasklist /FI \"IMAGENAME eq $imageName\" | findstr /B /C:$imageName"
    if ($LASTEXITCODE -eq 0 -and $out) { return ($out -split "`n").Length }
  } catch {}
  return 0
}

# Get baseline counts for all browsers before launching
$allBrowserBaselines = @{
  'brave.exe' = (Get-ImageCount 'brave.exe')
  'chrome.exe' = (Get-ImageCount 'chrome.exe')  
  'msedge.exe' = (Get-ImageCount 'msedge.exe')
  'firefox.exe' = (Get-ImageCount 'firefox.exe')
}
Write-Log "Baselines: brave=$($allBrowserBaselines['brave.exe']) chrome=$($allBrowserBaselines['chrome.exe']) edge=$($allBrowserBaselines['msedge.exe']) firefox=$($allBrowserBaselines['firefox.exe'])"

# Start periodic monitoring in background job
$monitorJob = Start-Job -ScriptBlock {
  param($baselines, $logFile)
  function Write-Log { param([string]$msg) $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'); "$ts `t $msg" | Out-File -FilePath $logFile -Encoding UTF8 -Append }
  function Get-ImageCount {
    param([string]$imageName)
    try {
      $base = ($imageName -replace '\.exe$','')
      $c = (Get-Process -Name $base -ErrorAction SilentlyContinue).Count
      if ($c -ge 0) { return $c }
    } catch {}
    try {
      $out = & cmd.exe /c "tasklist /FI \"IMAGENAME eq $imageName\" | findstr /B /C:$imageName"
      if ($LASTEXITCODE -eq 0 -and $out) { return ($out -split "`n").Length }
    } catch {}
    return 0
  }
  
  $idleCount = 0
  Write-Log "Monitor-Job: started periodic monitoring"
  
  while ($true) { # monitor indefinitely until browser closes
    Start-Sleep -Seconds 2
    
    $anyIncreased = $false
    foreach ($browser in $baselines.Keys) {
      $current = Get-ImageCount $browser
      $baseline = $baselines[$browser]
      if ($current -gt $baseline) {
        $anyIncreased = $true
        $idleCount = 0
        break
      }
    }
    
    if (-not $anyIncreased) {
      $idleCount++
      if ($idleCount -ge 30) { # 1 minute of no activity
        Write-Log "Monitor-Job: all browsers at/below baseline for 1min; server should stop"
        return "STOP_SERVER"
      }
      if ($idleCount % 15 -eq 0) { Write-Log "Monitor-Job: no browser activity ($idleCount/30 checks)" }
    }
  }
  Write-Log "Monitor-Job: unexpected exit"
  return "ERROR"
} -ArgumentList $allBrowserBaselines, $logFile
# Launch browser (Brave > Chrome > Edge > default)
if ($bravePath) {
  $browserArgs = "--new-window --app=`"$targetUrl`" --user-data-dir=`"$profileDir`" --no-first-run --no-default-browser-check"
  Start-Process -FilePath $bravePath -ArgumentList $browserArgs | Out-Null
  Write-Log "Launching Brave: $bravePath"
} elseif ($chromePath) {
  $browserArgs = "--new-window --app=`"$targetUrl`" --user-data-dir=`"$profileDir`" --no-first-run --no-default-browser-check"
  Start-Process -FilePath $chromePath -ArgumentList $browserArgs | Out-Null
  Write-Log "Launching Chrome: $chromePath"
} elseif ($edgePath) {
  $browserArgs = "--new-window --app=`"$targetUrl`" --user-data-dir=`"$profileDir`" --no-first-run --no-default-browser-check"
  Start-Process -FilePath $edgePath -ArgumentList $browserArgs | Out-Null
  Write-Log "Launching Edge: $edgePath"
} else {
  Start-Process $targetUrl | Out-Null
  Write-Log "Fallback: opened default browser"
}

# Wait for background monitor job result
Write-Log "Waiting for monitor job to detect browser closure..."
do {
  Start-Sleep -Seconds 1
  $jobResult = Receive-Job -Job $monitorJob -Keep
} while (-not $jobResult)

Write-Log "Monitor result: $jobResult"
Remove-Job -Job $monitorJob -Force

# Stop server and cleanup
try { if (-not $serverProc.HasExited) { Write-Log "Stopping server PID=$($serverProc.Id)"; Stop-Process -Id $serverProc.Id -Force } } catch {}
try { Start-Sleep -Milliseconds 100; Remove-Item -Path $profileDir -Recurse -Force -ErrorAction SilentlyContinue; Write-Log "Cleanup: removed $profileDir" } catch {}
Write-Log "Launch script completed"
