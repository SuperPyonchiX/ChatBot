@echo off
cd /d "%~dp0"

REM �|�[�g�ԍ��̐ݒ�i�f�t�H���g�F8001�j
set PORT=8001
if not "%1"=="" set PORT=%1

REM PowerShell �����`���[���B��E�B���h�E�ŋN���i�T�[�o�[�N���{�u���E�U�Ď��{������~�j
set PS1="%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set LAUNCH_SCRIPT=%~dp0server\launch.ps1

if not exist %LAUNCH_SCRIPT% (
    echo �����`���[�X�N���v�g��������܂���: %LAUNCH_SCRIPT%
    exit /b 1
)

REM �T�C�����g�N���i���̃o�b�`�͑��I���j
start "" /B %PS1% -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAUNCH_SCRIPT%" -Port %PORT%

exit /b 0