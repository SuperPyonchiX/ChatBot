@echo off
cd /d "%~dp0"

set PORT=8000
if not "%1"=="" set PORT=%1

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but not found in PATH.
  echo Please install Node.js from https://nodejs.org/ and try again.
  exit /b 1
)

set PORT=%PORT%
setx PORT %PORT% >nul 2>nul

echo Starting server with same-origin Anthropic proxy on port %PORT% ...
node server.js
