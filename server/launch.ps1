param(
  [int]$Port = 50000
)

$ErrorActionPreference = 'SilentlyContinue'

# Path settings
$serverDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Join-Path $serverDir '..'
$psServer = Join-Path $serverDir 'ps_server.ps1'

# ログ出力関数
$logFile = Join-Path $serverDir 'launch.log'
function Write-Log { 
  param([string]$msg) 
  $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
  "$ts `t $msg" | Out-File -FilePath $logFile -Encoding UTF8 -Append 
}

# Windows standard PowerShell server startup
$env:PORT = "$Port"
$serverProc = $null

if (Test-Path $psServer) {
  Write-Log "Starting PowerShell server (Windows standard): $psServer"
  $psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $serverProc = Start-Process -FilePath $psExe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"$psServer",'-Port',"$Port") -WindowStyle Hidden -PassThru -WorkingDirectory $projectRoot
} else {
  [Console]::Error.WriteLine("ERROR: PowerShell server not found: $psServer")
  Write-Log "ERROR: PowerShell server not found"
  exit 1
}

# サーバーの健康チェック
$healthy = $false
for ($i=0; $i -lt 40; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri ("http://localhost:" + $Port + "/") -TimeoutSec 1 -Method GET
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { $healthy = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 250
}
if (-not $healthy) { Write-Log "Warning: server health check not confirmed within timeout" }

# Browser launch settings
$targetUrl = "http://localhost:$Port/"

# Background monitor job using zero-process detection
$monitorJob = Start-Job -ScriptBlock {
  param($logFile)
  
  # Logging inside job
  function Write-Log { 
    param([string]$msg) 
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
    "$ts `t $msg" | Out-File -FilePath $logFile -Encoding UTF8 -Append 
  }
  
  # Process count inside job
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
  
  $consecutiveZeroChecks = 0
  Write-Log "Monitor job: started zero-process detection"
  
  while ($true) {
    Start-Sleep -Seconds 5
    
    # Check if all major browser processes are zero
    $braveCount = Get-ImageCount 'brave.exe'
    $chromeCount = Get-ImageCount 'chrome.exe'  
    $edgeCount = Get-ImageCount 'msedge.exe'
    $firefoxCount = Get-ImageCount 'firefox.exe'
    
    $totalBrowsers = $braveCount + $chromeCount + $edgeCount + $firefoxCount
    
    if ($totalBrowsers -eq 0) {
      $consecutiveZeroChecks++
      Write-Log "Monitor job: no browser processes detected (check $consecutiveZeroChecks/2)"

      if ($consecutiveZeroChecks -ge 2) { # 10s (2 checks * 5s) of zero browsers
        Write-Log "Monitor job: no browser processes for 10s. Stopping server."
        return "STOP_SERVER"
      }
    } else {
      $consecutiveZeroChecks = 0  # Reset counter when browsers detected
      if ($totalBrowsers -le 5) { # Log only when relatively few browsers
        Write-Log "Monitor job: browsers active (brave=$braveCount chrome=$chromeCount edge=$edgeCount firefox=$firefoxCount)"
      }
    }
  }
  Write-Log "Monitor job: unexpected exit"
  return "ERROR"
} -ArgumentList $logFile

# Launch browser with default handler
Start-Process $targetUrl | Out-Null
Write-Log "Launched with default browser"

# モニタージョブがブラウザ終了を検出するまで待機
Write-Log "Waiting for monitor job to detect browser exit..."
do {
  Start-Sleep -Seconds 1
  $jobResult = Receive-Job -Job $monitorJob -Keep
} while (-not $jobResult)

Write-Log "Monitor result: $jobResult"
Remove-Job -Job $monitorJob -Force

# Stop server and cleanup
try { 
  if (-not $serverProc.HasExited) { 
    Write-Log "Stopping server PID=$($serverProc.Id)"
    Stop-Process -Id $serverProc.Id -Force 
  } 
} catch {}
Write-Log "Launcher finished"
