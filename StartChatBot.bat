@echo off
cd /d "%~dp0"

REM �|�[�g�ԍ��̐ݒ�i�f�t�H���g�F8000�j

set PORT=8000
if not "%1"=="" set PORT=%1

REM Node.js �̑��݊m�F

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js ��������܂���ł����Bhttps://nodejs.org/ ����C���X�g�[�����Ă��������B
    pause
    exit /b 1
)

echo �T�[�o�[���N�����܂�...�i�|�[�g: %PORT%�j

REM �T�[�o�[��ʃE�B���h�E�ŋN���i���ϐ� PORT �������p���j

start "ChatBot Server" cmd /c "set PORT=%PORT% && node server\server.js"

echo �T�[�o�[�̋N����ҋ@��...
powershell -NoProfile -ExecutionPolicy Bypass -Command " $p=$env:PORT; $url='http://localhost:'+ $p + '/'; $ok=$false; for ($i=0;$i -lt 40;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1 -Method GET; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ $ok=$true; break } } catch {} Start-Sleep -Milliseconds 250 }; if($ok){exit 0}else{exit 1}"

if %errorlevel%==0 (
    echo �u���E�U���J���܂�: http://localhost:%PORT%/
    start "" http://localhost:%PORT%/
) else (
    echo �T�[�o�[�̉������m�F�ł��܂���ł����B�u���E�U���J���܂��B
    start "" http://localhost:%PORT%/
)

exit /b 0