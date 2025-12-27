@echo off
chcp 65001 > nul
setlocal

:: ========================================
:: ChatBot アプリケーション起動スクリプト
:: ========================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║              ChatBot アプリケーション起動中...            ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

:: カレントディレクトリをスクリプトのあるディレクトリに変更
cd /d "%~dp0"

:: Node.jsのインストール確認
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ エラー: Node.jsがインストールされていません
    echo.
    echo 📥 Node.jsをインストールしてください:
    echo    https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Node.jsバージョン表示
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION% が見つかりました
echo.

:: appディレクトリに移動（scripts から一つ上へ）
cd ..\app

:: 依存関係のインストール確認
if not exist "node_modules" (
    echo 📦 依存パッケージをインストールしています...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ エラー: パッケージのインストールに失敗しました
        pause
        exit /b 1
    )
    echo ✅ パッケージのインストールが完了しました
    echo.
)

:: サーバー起動
echo 🚀 ローカルサーバーを起動しています...
echo.

start "ChatBot Server" cmd /k "node server/index.js"

:: サーバーの起動を待つ
timeout /t 3 /nobreak > nul

:: ブラウザを開く
echo 🌐 ブラウザを起動しています...
start http://localhost:50000

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║              ChatBot アプリケーションが起動しました        ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 💡 ブラウザで http://localhost:50000 が開きます
echo.
echo 📝 注意事項:
echo    - サーバーを停止するには、サーバーウィンドウで Ctrl+C を押してください
echo    - ブラウザを閉じてもサーバーは実行中です
echo.

endlocal
