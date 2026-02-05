# Script to check the status of backend and frontend servers
Write-Host "🔍 Checking Server Status..." -ForegroundColor Yellow

# Check Backend (Port 5001)
Write-Host "`n📡 Backend API (Port 5001):" -ForegroundColor Cyan
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:5001/api/health" -Method GET -TimeoutSec 5
    if ($backendResponse.StatusCode -eq 200) {
        Write-Host "✅ Backend is running successfully!" -ForegroundColor Green
        $content = $backendResponse.Content | ConvertFrom-Json
        Write-Host "   Version: $($content.version)" -ForegroundColor Gray
        Write-Host "   Message: $($content.message)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Backend is not running or not accessible" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}

# Check Frontend (Port 5173)
Write-Host "`n🌐 Frontend (Port 5173):" -ForegroundColor Cyan
$frontendProcess = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($frontendProcess) {
    Write-Host "✅ Frontend development server is running!" -ForegroundColor Green
    Write-Host "   URL: http://localhost:5173" -ForegroundColor Gray
} else {
    Write-Host "❌ Frontend development server is not running" -ForegroundColor Red
}

# Check MongoDB Connection
Write-Host "`n🗄️  Database Connection:" -ForegroundColor Cyan
try {
    $testResponse = Invoke-WebRequest -Uri "http://localhost:5001/api/v1/test" -Method GET -TimeoutSec 5
    if ($testResponse.StatusCode -eq 200) {
        Write-Host "✅ Database connection is working!" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Database connection failed" -ForegroundColor Red
    Write-Host "   Make sure MongoDB is running" -ForegroundColor Gray
}

Write-Host "`n🎯 Summary:" -ForegroundColor Yellow
Write-Host "- Backend API: http://localhost:5001" -ForegroundColor White
Write-Host "- Frontend App: http://localhost:5173" -ForegroundColor White
Write-Host "- API Documentation: http://localhost:5001/api/health" -ForegroundColor White