<#
.EXAMPLE
    .\lab.ps1 clean --dry-run
.EXAMPLE
    .\lab.ps1 finish-trial paulina giv-sam-v4-v5 filmprov-4ad4120c --dry-run
#>
[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
$ErrorActionPreference = 'Stop'
$samRoot = if ($env:SAM3D_ROOT) { $env:SAM3D_ROOT } else { Join-Path (Split-Path $PSScriptRoot -Parent) 'sam-3d-body' }
$samPython = Join-Path $samRoot '.venv\Scripts\python.exe'
$script = Join-Path $PSScriptRoot 'tools\lab.py'
if (Test-Path -LiteralPath $samPython -PathType Leaf) {
    & $samPython -B $script @Arguments
} elseif ($Arguments -and $Arguments[0] -in 'sam', 'view') {
    throw "Kommandot behöver SAM-miljön. Ange SAM3D_ROOT till den lokala installationen."
} elseif (Get-Command py -CommandType Application -ErrorAction SilentlyContinue) {
    & py -3 -B $script @Arguments
} else {
    & python -B $script @Arguments
}
exit $LASTEXITCODE
