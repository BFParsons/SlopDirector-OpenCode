# Native Windows launcher. No Git Bash/WSL or global pnpm shim required.
param([switch]$Dev, [switch]$Prod, [switch]$Headless)
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'launch-local.mjs'
$launchArgs = @($launcher)
if ($Dev) { $launchArgs += '--dev' } else { $launchArgs += '--prod' }
if ($Headless) { $launchArgs += '--headless' }
& node @launchArgs
exit $LASTEXITCODE
