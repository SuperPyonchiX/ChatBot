@echo off
cd /d "%~dp0"

REM Port number setting (default: 50000)
set PORT=50000
if not "%1"=="" set PORT=%1

REM Launch PowerShell script in hidden window (server startup + browser monitoring + auto stop)
set PS1="%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set LAUNCH_SCRIPT="%~dp0server\launch.ps1"

if not exist %LAUNCH_SCRIPT% (
    echo Launch script not found: %LAUNCH_SCRIPT%
    timeout /t 3 >nul
    exit /b 1
)

REM Silent startup using PowerShell to hide the window
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process -FilePath %PS1% -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','%LAUNCH_SCRIPT%','-Port','%PORT%') -WindowStyle Hidden"

REM Exit immediately without pause
exit /b 0