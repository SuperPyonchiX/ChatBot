param(
  [int]$Port = 50000
)

$ErrorActionPreference = 'SilentlyContinue'

# Path settings
$serverDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Join-Path $serverDir '..' | Join-Path -ChildPath '..' | Resolve-Path
$nodeServer = Join-Path $serverDir 'server.js'
$indexHtmlPath = Join-Path $projectRoot 'app\index.html'

# Log output function
$logFile = Join-Path $serverDir 'launch.log'
function Write-Log { 
  param([string]$msg) 
  $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
  "$ts `t $msg" | Out-File -FilePath $logFile -Encoding UTF8 -Append 
}

Write-Log "=== ChatBot Launch Started ==="
Write-Log "ServerDir: $serverDir"
Write-Log "ProjectRoot: $projectRoot"

# Node.jsの存在確認（環境変数PATHから検索）
$nodeExe = $null
$nodePaths = @(
  "node.exe",
  "C:\Program Files\nodejs\node.exe",
  "C:\Program Files (x86)\nodejs\node.exe",
  "$env:ProgramFiles\nodejs\node.exe",
  "$env:ProgramFiles(x86)\nodejs\node.exe",
  "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
)

foreach ($path in $nodePaths) {
  try {
    if ($path -eq "node.exe") {
      # PATHから検索
      $found = Get-Command node -ErrorAction SilentlyContinue
      if ($found) { 
        $nodeExe = $found.Source 
        break 
      }
    } elseif (Test-Path $path) {
      $nodeExe = $path
      break
    }
  } catch {}
}

if (-not $nodeExe) {
  [Console]::Error.WriteLine("ERROR: Node.js not found. Please install Node.js from https://nodejs.org/")
  Write-Log "ERROR: Node.js not found"
  Write-Log "Searched paths: $($nodePaths -join ', ')"
  Start-Sleep -Seconds 5
  exit 1
}

Write-Log "Node.js found: $nodeExe"
try {
  $nodeVersion = & $nodeExe --version 2>&1
  Write-Log "Node.js version: $nodeVersion"
} catch {
  Write-Log "Warning: Could not get Node.js version"
}

# Node.js server startup with browser monitoring
if (-not (Test-Path $nodeServer)) {
  [Console]::Error.WriteLine("ERROR: Node.js server not found: $nodeServer")
  Write-Log "ERROR: Node.js server not found"
  exit 1
}

Write-Log "Starting Node.js server with browser monitoring..."

# Start Node.js server in background with browser monitoring enabled
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $nodeExe
$startInfo.Arguments = "`"$nodeServer`" --port=$Port --monitor-browser"
$startInfo.WorkingDirectory = $serverDir
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true

# Inherit environment variables to ensure PATH is available
$startInfo.EnvironmentVariables["PATH"] = $env:PATH

$serverProc = [System.Diagnostics.Process]::Start($startInfo)

if ($serverProc -and $serverProc.Id) {
  Write-Log "Server started with PID: $($serverProc.Id)"
  Write-Log "Browser monitoring: ENABLED (auto-stop after 10s with no browsers)"
} else {
  Write-Log "ERROR: Failed to start server"
  exit 1
}

# Wait for server to be ready
Write-Log "Waiting for server to start..."
Start-Sleep -Seconds 2

# Health check
$healthy = $false
for ($i=0; $i -lt 10; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$Port/" -TimeoutSec 2 -Method GET -ErrorAction SilentlyContinue
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { 
      $healthy = $true 
      Write-Log "Server health check passed"
      break 
    }
  } catch {}
  Start-Sleep -Milliseconds 500
}

if (-not $healthy) { 
  Write-Log "Warning: Server health check timeout (server may still be starting)"
}

# Launch browser
if (Test-Path $indexHtmlPath) {
  Write-Log "Opening browser: http://localhost:$Port/"
  Start-Process "http://localhost:$Port/" | Out-Null
  Write-Log "Browser launched successfully"
} else {
  Write-Log "ERROR: index.html not found: $indexHtmlPath"
  [Console]::Error.WriteLine("ERROR: index.html not found: $indexHtmlPath")
}

Write-Log "=== ChatBot Launch Completed ==="
Write-Log "Server is running with automatic browser monitoring"
Write-Log "Server will auto-stop 10 seconds after all browsers are closed"
