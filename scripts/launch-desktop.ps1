# SlopStudio Pro — desktop launcher.
# Starts the Next dev server and opens the Electron (Chromium) window onto it.
# Used by the "SlopStudio Pro" desktop shortcut.
$ErrorActionPreference = 'SilentlyContinue'

# Project root = this script's folder's parent (scripts/..), so the launcher is
# path-independent.
$proj = Split-Path -Parent $PSScriptRoot
Set-Location $proj

# Stop any stale dev server still holding port 3000 so Electron connects to the
# right server (Next would otherwise fall back to 3001 and the window would 404).
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {} }

Write-Host "Starting SlopStudio Pro (desktop) ..." -ForegroundColor Cyan
# desktop:dev = `next dev` + Electron window (server + web interface).
corepack pnpm desktop:dev
