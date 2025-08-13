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

# 2. PowerShell server processes（ps_server.ps1を実行中のもの）も終了
try {
    $psProcesses = Get-WmiObject Win32_Process -ErrorAction Stop | Where-Object {
        $_.CommandLine -like "*ps_server.ps1*" -or 
        $_.CommandLine -like "*Port*$Port*"
    } 

    foreach ($process in $psProcesses) {
        try {
            Write-Host "Stopping PowerShell server process PID: $($process.ProcessId)"
            Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
            Write-Host "PowerShell server process stopped"
        } catch {
            Write-Host "Failed to stop PowerShell server: $($_.Exception.Message)"
        }
    }
} catch {
    Write-Host "Warning: Could not enumerate PowerShell processes: $($_.Exception.Message)"
}

Write-Host "Server stop operation completed."
