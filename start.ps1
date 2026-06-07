#requires -Version 5
# GameStack StreamKit launcher.
# Builds the overlay if needed, starts the single server (bot + overlay + control panel),
# auto-opens the control panel in your browser, and prints the OBS overlay URL.
#
#   .\start.ps1          # start (builds overlay only if overlay-dist is missing)
#   .\start.ps1 -Build   # force a fresh overlay build first

param([switch]$Build)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Resolve the port from .env (STREAMKIT_PORT), falling back to the app default.
$port = 8420
if (Test-Path '.env') {
  $m = Select-String -Path '.env' -Pattern '^\s*STREAMKIT_PORT\s*=\s*(\d+)' | Select-Object -First 1
  if ($m) { $port = [int]$m.Matches[0].Groups[1].Value }
}

# Build the overlay if it has never been built (or when -Build is passed).
if ($Build -or -not (Test-Path 'overlay-dist/index.html')) {
  Write-Host 'Building overlay...' -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Overlay build failed.' }
}

$controlUrl = "http://localhost:$port/control"
$overlayUrl = "http://localhost:$port/#/stage"

Write-Host ''
Write-Host '  GameStack StreamKit' -ForegroundColor Magenta
Write-Host "  Control panel : $controlUrl  (opening in your browser)"
Write-Host "  OBS overlay   : $overlayUrl  (paste into an OBS Browser Source)"
Write-Host '  Press Ctrl+C to stop.' -ForegroundColor DarkGray
Write-Host ''

# Wait for the server's /health to respond, then open the control panel.
Start-Job -ScriptBlock {
  param($p, $url)
  for ($i = 0; $i -lt 60; $i++) {
    try {
      Invoke-WebRequest "http://localhost:$p/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
      Start-Process $url
      break
    } catch { Start-Sleep -Milliseconds 500 }
  }
} -ArgumentList $port, $controlUrl | Out-Null

# Run the server in the foreground; Ctrl+C stops it.
npm start
