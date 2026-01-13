# ========================================
# ChatBot Application Startup Script
# ========================================

# Set console to UTF-8
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "============================================================"
Write-Host ""
Write-Host "          ChatBot Application Starting..."
Write-Host ""
Write-Host "============================================================"
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check Node.js installation
try {
    $nodeVersion = & node -v 2>$null
    if (-not $nodeVersion) {
        throw "Node.js not found"
    }
    Write-Host "[OK] Node.js $nodeVersion found"
    Write-Host ""
} catch {
    Write-Host "[ERROR] Node.js is not installed"
    Write-Host ""
    Write-Host "Please install Node.js:"
    Write-Host "   https://nodejs.org/"
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 1
}

# Move to app directory (one level up from scripts)
$appDir = Join-Path (Split-Path -Parent $scriptDir) "app"
Set-Location $appDir

# Check dependencies
$nodeModulesPath = Join-Path $appDir "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "[INFO] Installing dependencies..."
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install packages"
        Read-Host "Press Enter to exit..."
        exit 1
    }
    Write-Host "[OK] Package installation completed"
    Write-Host ""
}

# Start server
Write-Host "[INFO] Starting local server..."
Write-Host ""

$serverScript = Join-Path $appDir "server\index.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "chcp 65001 | Out-Null; node `"$serverScript`""

# Wait for server startup
Start-Sleep -Seconds 3

# Open browser
Write-Host "[INFO] Opening browser..."
Start-Process "http://localhost:50000"

Write-Host ""
Write-Host "============================================================"
Write-Host ""
Write-Host "          ChatBot Application Started!"
Write-Host ""
Write-Host "============================================================"
Write-Host ""
Write-Host "Browser will open at http://localhost:50000"
Write-Host ""
Write-Host "Notes:"
Write-Host "   - Press Ctrl+C in the server window to stop"
Write-Host "   - Server keeps running even if you close the browser"
Write-Host ""
