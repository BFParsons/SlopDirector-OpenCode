# Fetch the Windows x64 GPL build corresponding to the Linux bundle.
param([string]$Release = '9.0')
$ErrorActionPreference = 'Stop'
if ($Release -notmatch '^\d+\.\d+$') { throw 'Release must be major.minor' }
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$destination = Join-Path $repoRoot 'vendor\ffmpeg'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
if ((Test-Path -LiteralPath (Join-Path $destination 'ffmpeg.exe')) -and (Test-Path -LiteralPath (Join-Path $destination 'ffprobe.exe'))) {
    Write-Host "Windows ffmpeg and ffprobe already present in $destination"
    exit 0
}
$downloadRoot = Join-Path $repoRoot '.data\downloads'
New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
$staging = Join-Path $downloadRoot ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $staging | Out-Null
$url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n$Release-latest-win64-gpl-$Release.zip"
try {
    $archive = Join-Path $staging 'ffmpeg.zip'
    Invoke-WebRequest -Uri $url -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $staging
    foreach ($name in @('ffmpeg.exe', 'ffprobe.exe')) {
        $matches = @(Get-ChildItem -LiteralPath $staging -Recurse -File -Filter $name)
        if ($matches.Count -ne 1) { throw "Expected one $name in downloaded archive" }
        $versionOutput = & $matches[0].FullName -version
        if ($LASTEXITCODE -ne 0) { throw "$name did not execute" }
        Write-Host $versionOutput[0]
        Copy-Item -LiteralPath $matches[0].FullName -Destination (Join-Path $destination $name)
    }
    Get-ChildItem -LiteralPath $staging -Recurse -File -Filter 'LICENSE*' | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $destination $_.Name)
    }
    @("Binary: $url", 'Build scripts and source instructions: https://github.com/BtbN/FFmpeg-Builds', "FFmpeg source: https://github.com/FFmpeg/FFmpeg/tree/release/$Release") | Set-Content -LiteralPath (Join-Path $destination 'SOURCE.txt')
} finally {
    $resolvedStaging = [IO.Path]::GetFullPath($staging)
    $allowedRoot = [IO.Path]::GetFullPath($downloadRoot).TrimEnd('\') + '\'
    if (-not $resolvedStaging.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe staging cleanup path' }
    Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
}
