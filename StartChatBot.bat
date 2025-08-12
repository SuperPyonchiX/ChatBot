@echo off
cd /d "%~dp0"

REM ポート番号の設定（デフォルト：8001）
set PORT=8001
if not "%1"=="" set PORT=%1

REM PowerShell ランチャーを隠れウィンドウで起動（サーバー起動＋ブラウザ監視＋自動停止）
set PS1="%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set LAUNCH_SCRIPT=%~dp0server\launch.ps1

if not exist %LAUNCH_SCRIPT% (
    echo ランチャースクリプトが見つかりません: %LAUNCH_SCRIPT%
    exit /b 1
)

REM サイレント起動（このバッチは即終了）
start "" /B %PS1% -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCH_SCRIPT%" -Port %PORT%

exit /b 0