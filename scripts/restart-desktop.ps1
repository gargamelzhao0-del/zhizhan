$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$desktopRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'release/zhizhan-windows'))
$nodePath = Join-Path $desktopRoot 'runtime/node.exe'
$entryPath = Join-Path $desktopRoot 'scripts/serve.mjs'
$metadata = Get-Content -LiteralPath (Join-Path $desktopRoot 'package.json') -Raw | ConvertFrom-Json
if (!(Test-Path -LiteralPath $nodePath) -or !(Test-Path -LiteralPath $entryPath)) {
    throw 'Package the Windows release before restarting the desktop service.'
}
$listeners = @(Get-NetTCPConnection -LocalPort 8462 -State Listen -ErrorAction SilentlyContinue)
foreach ($listener in $listeners) {
    $ownedProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$listener.OwningProcess)"
    if (!$ownedProcess -or $ownedProcess.ExecutablePath -ne $nodePath -or !$ownedProcess.CommandLine.Contains($entryPath)) {
        throw 'Port 8462 belongs to a different application; no process was stopped.'
    }
}
foreach ($processId in ($listeners.OwningProcess | Select-Object -Unique)) {
    Stop-Process -Id $processId -ErrorAction Stop
}
$arguments = '"' + $entryPath + '" --no-open'
$desktopProcess = Start-Process -FilePath $nodePath -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot '.private/desktop-output.log') -RedirectStandardError (Join-Path $projectRoot '.private/desktop-error.log')
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:8462/__zhizhan_health' -TimeoutSec 1
        if ($health.app -eq 'zhizhan' -and $health.version -eq $metadata.version) {
            Write-Output "Zhizhan $($health.version) is running at http://127.0.0.1:8462 (PID $($desktopProcess.Id))."
            exit 0
        }
    } catch {}
}
throw 'The expected desktop version did not become ready; inspect .private/desktop-error.log.'
