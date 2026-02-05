# Script to restart the frontend development server
Write-Host "🔄 Restarting Frontend Development Server..." -ForegroundColor Yellow

# Kill the current Vite dev server process on port 5173
Write-Host "📌 Stopping current development server..." -ForegroundColor Cyan
$processes = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object OwningProcess
if ($processes) {
    foreach ($process in $processes) {
        if ($process.OwningProcess -gt 0) {
            Stop-Process -Id $process.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "✅ Stopped process $($process.OwningProcess)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "ℹ️  No development server currently running" -ForegroundColor Gray
}

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

# Start the development server
Write-Host "🚀 Starting development server with new configuration..." -ForegroundColor Green
Write-Host "📡 API URL: http://localhost:5001/api/v1" -ForegroundColor Cyan
Write-Host "🌐 Frontend URL: http://localhost:5173" -ForegroundColor Cyan

# Start npm dev in a new PowerShell window so you can see the output
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"

Write-Host "✨ Frontend server is starting in a new window!" -ForegroundColor Green
Write-Host "🔗 Open http://localhost:5173 in your browser" -ForegroundColor Yellow