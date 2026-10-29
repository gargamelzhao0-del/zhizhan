param([switch]$EnableInternet)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$metadata = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$feedDirectory = Join-Path $projectRoot "release/zhizhan-$($metadata.version)-update-feed"
$profilePath = Join-Path $projectRoot '.private/update-service.json'
if (!(Test-Path -LiteralPath $profilePath)) { throw 'Prepare the authenticated update-service profile before starting this release.' }
$profile = Get-Content -LiteralPath $profilePath -Raw | ConvertFrom-Json
if ($profile.token -notmatch '^[A-Za-z0-9_-]{43,128}$') { throw 'Invalid update access credential.' }
if (!(Test-Path -LiteralPath (Join-Path $feedDirectory 'latest.json'))) { throw 'Build/package the update feed first.' }
$stateDirectory = Join-Path $projectRoot '.private/server'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$health = $null
try { $health = Invoke-RestMethod 'http://127.0.0.1:8463/__zhizhan_release_health' -TimeoutSec 2 } catch {}
if ($health) {
    if ($health.service -ne 'zhizhan-private-updates' -or $health.version -ne $metadata.version -or !$health.authenticated) { throw 'Port 8463 has another server, version or authentication mode. Stop the owned server before starting this release.' }
} else {
    if (Get-NetTCPConnection -LocalPort 8463 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 8463 is occupied; no process was stopped.' }
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $entryPath = Join-Path $PSScriptRoot 'private-update-server.mjs'
    $arguments = '"' + $entryPath + '" "' + $feedDirectory + '" "' + $profilePath + '"'
    $process = Start-Process -FilePath $nodePath -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDirectory 'output.log') -RedirectStandardError (Join-Path $stateDirectory 'error.log')
    @{ processId=$process.Id; executable=$nodePath; entry=$entryPath; version=$metadata.version } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stateDirectory 'state.json')
    $ready = $false
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        try { $health = Invoke-RestMethod 'http://127.0.0.1:8463/__zhizhan_release_health' -TimeoutSec 1; $ready = $health.service -eq 'zhizhan-private-updates' -and $health.version -eq $metadata.version -and $health.authenticated; if ($ready) { break } } catch {}
    }
    if (!$ready) { throw "Update server did not start; inspect $stateDirectory/error.log" }
}
Write-Output "Local update backend running: version $($metadata.version)"
if (!$EnableInternet) { Write-Output 'Authenticated backend ready; use -EnableInternet to expose the HTTPS entry after computer login.'; exit 0 }
$tailscale = (Get-Command tailscale.exe -ErrorAction Stop).Source
$status = (& $tailscale status --json | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0 -or $status.BackendState -ne 'Running' -or !$status.Self.DNSName) { throw 'Log in to Tailscale on this PC only, then retry. The phone does not need Tailscale.' }
$existing = (& $tailscale serve status --json | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect existing Tailscale Serve configuration; no configuration changed.' }
$dnsName = $status.Self.DNSName.TrimEnd('.')
if ($profile.url -ne "https://${dnsName}:8443/latest.json") { throw 'Built-in endpoint differs from this computer DNS name; no remote configuration changed.' }
# Dedicated HTTPS port avoids replacing a user's existing service on 443.
$handlers = $existing.Web."${dnsName}:8443".Handlers
if ($handlers -and (($handlers.PSObject.Properties.Name -join ',') -ne '/' -or $handlers.'/'.Proxy -ne 'http://127.0.0.1:8463')) { throw 'Tailscale port 8443 already serves another application; no configuration changed.' }
if ($existing.TCP.'8443' -and !$handlers) { throw 'Tailscale TCP port 8443 already has a different handler; no configuration changed.' }
& $tailscale funnel --bg --https=8443 http://127.0.0.1:8463
if ($LASTEXITCODE -ne 0) { throw 'HTTPS entry is not ready. Complete the Tailscale HTTPS/Funnel consent on this PC and retry.' }
Write-Output "App endpoint: https://${dnsName}:8443/latest.json"
Write-Output 'Internet-reachable HTTPS entry; manifest and APK require the app credential. Keep the PC awake and connected.'
