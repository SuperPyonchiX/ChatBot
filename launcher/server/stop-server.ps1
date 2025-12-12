param(
    [int]$Port = 50000
)

Write-Host "Stopping ChatBot server on port $Port..."

# 1. ポートを使用しているプロセスを特定（LISTENINGのみ対象）
$netstatOutput = netstat -aon | Where-Object { $_ -match ":$Port " -and $_ -match "LISTENING" }
if ($netstatOutput) {
    Write-Host "Found processes using port $Port :"
    Write-Host $netstatOutput
    
    # PIDを抽出して強制終了（変数名をpidIdに変更してPID組み込み変数との競合を回避）
    $pidIds = $netstatOutput | ForEach-Object {
        $parts = $_.Trim() -split '\s+'
        if ($parts.Count -ge 5) { 
            $pidValue = $parts[-1]
            # システムプロセス（PID 0, 4など）は除外
            if ($pidValue -match '^\d+$' -and [int]$pidValue -gt 4) { 
                $pidValue 
            }
        }
    } | Where-Object { $_ -ne $null } | Sort-Object -Unique
    
    foreach ($pidId in $pidIds) {
        try {
            Write-Host "Stopping process PID: $pidId"
            Stop-Process -Id $pidId -Force -ErrorAction Stop
            Write-Host "Process $pidId stopped successfully"
        } catch {
            Write-Host "Failed to stop process $pidId : $($_.Exception.Message)"
        }
    }
} else {
    Write-Host "No processes found listening on port $Port"
}

# 2. Node.js server processes（server.jsを実行中のもの）も終了
try {
    # PIDファイルから直接読み込む方法を優先
    $pidFile = Join-Path $PSScriptRoot 'server.pid'
    if (Test-Path $pidFile) {
        try {
            $savedPid = Get-Content $pidFile -ErrorAction Stop
            if ($savedPid -match '^\d+$') {
                Write-Host "Stopping server from PID file: $savedPid"
                Stop-Process -Id ([int]$savedPid) -Force -ErrorAction SilentlyContinue
                Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
                Write-Host "Server stopped from PID file"
            }
        } catch {
            Write-Host "Failed to stop from PID file: $($_.Exception.Message)"
        }
    }
    
    # Node.jsプロセスを検索して終了
    $nodeProcesses = Get-WmiObject Win32_Process -ErrorAction Stop | Where-Object {
        $_.Name -eq 'node.exe' -and (
            $_.CommandLine -like "*server.js*" -or 
            $_.CommandLine -like "*--port=$Port*"
        )
    } 

    foreach ($process in $nodeProcesses) {
        try {
            Write-Host "Stopping Node.js server process PID: $($process.ProcessId)"
            Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
            Write-Host "Node.js server process stopped"
        } catch {
            Write-Host "Failed to stop Node.js server: $($_.Exception.Message)"
        }
    }
} catch {
    Write-Host "Warning: Could not enumerate Node.js processes: $($_.Exception.Message)"
}

Write-Host "Server stop operation completed."
