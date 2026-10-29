$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $projectRoot '.private/server/state.json'
if (!(Test-Path -LiteralPath $statePath)) { Write-Output 'No owned server record found.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$expectedEntry = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'private-update-server.mjs'))
if ($state.entry -ne $expectedEntry) { throw 'Server record belongs to another workspace.' }
$process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.processId)"
if ($process) {
    if ($process.ExecutablePath -ne $state.executable -or !$process.CommandLine.Contains($expectedEntry)) { throw 'PID no longer belongs to this update server; refusing to stop it.' }
    Stop-Process -Id $state.processId -ErrorAction Stop
}
Remove-Item -LiteralPath $statePath
Write-Output 'Owned update backend stopped. Tailscale and other services were not changed.'
