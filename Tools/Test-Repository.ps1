<#
.SYNOPSIS
    Run agent harness checks and the repository's Node.js tests.
#>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Test-AgentHarness.ps1')
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    & node --test
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js tests failed (exit code $LASTEXITCODE)."
    }
} finally {
    Pop-Location
}
