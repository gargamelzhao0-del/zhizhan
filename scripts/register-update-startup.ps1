param([switch]$Remove)
$ErrorActionPreference = 'Stop'
# Current-user Startup needs no administrator Task Scheduler registration.
$startScript = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'start-private-updates.ps1'))
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $startScript + '" -EnableInternet'
$executable = "$env:SystemRoot/System32/WindowsPowerShell/v1.0/powershell.exe"
$startup = [Environment]::GetFolderPath('Startup')
if (!$startup -or !(Test-Path -LiteralPath $startup)) { throw 'Current user Startup directory is unavailable.' }
$shortcutPath = Join-Path $startup 'ZhizhanPrivateUpdates.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
if ((Test-Path -LiteralPath $shortcutPath) -and ($shortcut.Arguments -ne $arguments -or $shortcut.TargetPath -ne $executable)) {
    throw 'An unrelated startup entry uses this name; no entry changed.'
}
if ($Remove) {
    if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath }
    Write-Output 'Owned update logon shortcut removed; current service was not stopped.'
    exit 0
}
$shortcut.TargetPath = $executable
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = Split-Path -Parent $PSScriptRoot
$shortcut.WindowStyle = 7
$shortcut.Description = 'Start authenticated Zhizhan update files on this account logon.'
$shortcut.Save()
if (!(Test-Path -LiteralPath $shortcutPath)) { throw 'Startup shortcut was not saved.' }
Write-Output 'Zhizhan update server registered in current-user Startup. Keep the PC online and awake.'
