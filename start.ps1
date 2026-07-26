# Banker Lapp - start the LOCAL DEVELOPMENT stack (Postgres + backend + app).
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File C:\coding\banker_lapp\start.ps1
#
# This is for development only. Friends now use the deployed app on Render, so
# nothing here needs to stay running for them - no ngrok tunnel, no leaving your
# laptop on. See DEPLOYMENT.md.

$ErrorActionPreference = "Stop"
$root    = "C:\coding\banker_lapp"
$backend = Join-Path $root "backend"
$mobile  = Join-Path $root "mobile"
$port    = 9000

Write-Host "==> 1/3 Starting Postgres (Docker)..." -ForegroundColor Cyan
Push-Location $root
docker compose up -d
Pop-Location

Write-Host "==> 2/3 Starting backend on port $port (new window)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$backend'; Write-Host 'Banker Lapp backend :$port' -ForegroundColor Green; go run ./cmd/api"
)

Write-Host "==> 3/3 Starting the web app (new window)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$mobile'; Write-Host 'Banker Lapp web :8081' -ForegroundColor Green; npm run web"
)

Write-Host ""
Write-Host "Backend:  http://localhost:$port/health" -ForegroundColor Yellow
Write-Host "Web app:  http://localhost:8081" -ForegroundColor Yellow
Write-Host ""
Write-Host "For the Android emulator, set EXPO_PUBLIC_API_URL=http://10.0.2.2:$port" -ForegroundColor DarkGray
Write-Host "To stop: close the two new windows, then run 'docker compose down' in $root." -ForegroundColor DarkGray
