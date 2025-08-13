@echo off
echo Creating silent launcher shortcut...

REM PowerShellでショートカットを作成
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$WshShell = New-Object -ComObject WScript.Shell; ^
$Shortcut = $WshShell.CreateShortcut('%~dp0ChatBot.lnk'); ^
$Shortcut.TargetPath = '%~dp0launcher\StartChatBot.bat'; ^
$Shortcut.WorkingDirectory = '%~dp0launcher'; ^
$Shortcut.IconLocation = '%~dp0icon\ChatBot.ico'; ^
$Shortcut.Description = 'Start ChatBot application'; ^
$Shortcut.Save()"

if exist "%~dp0ChatBot.lnk" (
    echo ChatBot launcher shortcut created successfully!
    echo You can now double-click "ChatBot.lnk" to start ChatBot.
    echo.
    echo Directory structure:
    echo   ChatBot.lnk          - Main launcher shortcut (click this!)
    echo   app\                 - Application files (HTML, CSS, JS)
    echo   launcher\            - Startup scripts and server
    echo   icon\                - Application icons
    echo   doc\                 - Documentation
) else (
    echo Failed to create shortcut.
)

pause
