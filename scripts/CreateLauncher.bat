@echo off
chcp 65001 >nul
echo Creating ChatBot launcher shortcut...
echo.

REM プロジェクトルートのパスを取得（scripts の親ディレクトリ）
set "ROOT_DIR=%~dp0.."

REM PowerShellでショートカットを作成（ルートに配置）
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%ROOT_DIR%\ChatBot.lnk'); $Shortcut.TargetPath = '%~dp0StartChatBot.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.IconLocation = '%ROOT_DIR%\app\public\icon\ChatBot.ico'; $Shortcut.Description = 'Start ChatBot application'; $Shortcut.Save()"

if exist "%ROOT_DIR%\ChatBot.lnk" (
    echo [SUCCESS] ChatBot launcher shortcut created successfully!
    echo.
    echo You can now double-click "ChatBot.lnk" to start ChatBot.
    echo.
    echo Directory structure:
    echo   ChatBot.lnk          - Main launcher shortcut ^(click this!^)
    echo   scripts\             - Startup scripts
    echo   app\                 - Application files ^(Node.js server + frontend^)
) else (
    echo [ERROR] Failed to create shortcut.
    echo Please check if you have write permissions in this directory.
)

echo.
pause
