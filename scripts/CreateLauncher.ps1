# ========================================
# ChatBot Shortcut Creator Script
# ========================================

# Set console to UTF-8
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Creating ChatBot launcher shortcut..."
Write-Host ""

# Get script directory and root directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# Shortcut paths
$shortcutPath = Join-Path $rootDir "ChatBot.lnk"
$targetScript = Join-Path $scriptDir "StartChatBot.ps1"
$iconPath = Join-Path $rootDir "app\public\icon\ChatBot.ico"

# Create shortcut using WScript.Shell
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)

# Configure shortcut to run PowerShell script
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$targetScript`""
$Shortcut.WorkingDirectory = $scriptDir
$Shortcut.IconLocation = $iconPath
$Shortcut.Description = "Start ChatBot application"
$Shortcut.Save()

# Check result
if (Test-Path $shortcutPath) {
    Write-Host "[SUCCESS] ChatBot launcher shortcut created successfully!"
    Write-Host ""
    Write-Host "You can now double-click `"ChatBot.lnk`" to start ChatBot."
    Write-Host ""
    Write-Host "Directory structure:"
    Write-Host "  ChatBot.lnk          - Main launcher shortcut (click this!)"
    Write-Host "  scripts\             - Startup scripts"
    Write-Host "  app\                 - Application files (Node.js server + frontend)"
} else {
    Write-Host "[ERROR] Failed to create shortcut."
    Write-Host "Please check if you have write permissions in this directory."
}

Write-Host ""
Read-Host "Press Enter to exit..."
