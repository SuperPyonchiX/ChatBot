@echo off
setlocal enabledelayedexpansion

set PORT=50000
if not "%1"=="" set PORT=%1

echo Stopping ChatBot server on port %PORT%...

REM ポートを使用しているプロセスを検索
echo Searching for processes using port %PORT%...

REM netstatの結果をより正確にパース
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    set PID=%%a
    if !PID! GTR 4 (
        echo Stopping listening process PID: !PID!
        taskkill /PID !PID! /F >nul 2>&1
        if errorlevel 1 (
            echo Failed to stop process !PID!
        ) else (
            echo Process !PID! stopped successfully
        )
    )
)

REM PowerShell server processesを特定して終了（複数の方法で試行）
echo Stopping PowerShell server processes...

REM Method 1: WMICでコマンドラインをチェック
for /f "skip=1 tokens=2" %%a in ('wmic process where "name='powershell.exe'" get processid /format:csv 2^>nul') do (
    if "%%a" NEQ "" if "%%a" NEQ "ProcessId" (
        REM コマンドラインを確認
        for /f "tokens=*" %%b in ('wmic process where "processid='%%a'" get commandline /format:csv 2^>nul ^| findstr "ps_server.ps1"') do (
            echo Stopping PowerShell server PID: %%a
            taskkill /PID %%a /F >nul 2>&1
            if errorlevel 1 (
                echo Failed to stop PowerShell server %%a
            ) else (
                echo PowerShell server %%a stopped successfully
            )
        )
    )
)

REM Method 2: PIDファイルが存在する場合はそれを使用
if exist "server.pid" (
    set /p SERVER_PID=<server.pid
    if defined SERVER_PID (
        echo Found server PID from file: !SERVER_PID!
        taskkill /PID !SERVER_PID! /F >nul 2>&1
        if errorlevel 1 (
            echo Failed to stop server process !SERVER_PID!
        ) else (
            echo Server process !SERVER_PID! stopped successfully
        )
        del server.pid >nul 2>&1
        echo PID file removed
    )
)

REM Method 3: Fallback - PowerShellを使った確実な方法
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $ps = Get-WmiObject Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*ps_server.ps1*' }; foreach ($p in $ps) { Write-Host 'Stopping PowerShell server PID:' $p.ProcessId; Stop-Process -Id $p.ProcessId -Force; Write-Host 'PowerShell server process stopped' } } catch { Write-Host 'PowerShell method failed:' $_.Exception.Message }" 2>nul

echo Server stop operation completed.
pause
