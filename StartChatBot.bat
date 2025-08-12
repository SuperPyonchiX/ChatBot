@echo off
cd /d "%~dp0"

REM ポート番号の設定（デフォルト：8000）

set PORT=8000
if not "%1"=="" set PORT=%1

REM Node.js の存在確認

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js が見つかりませんでした。https://nodejs.org/ からインストールしてください。
    pause
    exit /b 1
)

echo サーバーを起動します...（ポート: %PORT%）

REM サーバーを別ウィンドウで起動（環境変数 PORT を引き継ぐ）

start "ChatBot Server" cmd /c "set PORT=%PORT% && node server\server.js"

echo サーバーの起動を待機中...
powershell -NoProfile -ExecutionPolicy Bypass -Command " $p=$env:PORT; $url='http://localhost:'+ $p + '/'; $ok=$false; for ($i=0;$i -lt 40;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1 -Method GET; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ $ok=$true; break } } catch {} Start-Sleep -Milliseconds 250 }; if($ok){exit 0}else{exit 1}"

if %errorlevel%==0 (
    echo ブラウザを開きます: http://localhost:%PORT%/
    start "" http://localhost:%PORT%/
) else (
    echo サーバーの応答が確認できませんでした。ブラウザを開きます。
    start "" http://localhost:%PORT%/
)

exit /b 0