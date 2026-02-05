# Test the login API endpoint
$loginData = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

Write-Host "🧪 Testing Login API Endpoint..." -ForegroundColor Yellow
Write-Host "📧 Email: test@example.com" -ForegroundColor Gray
Write-Host "🔑 Password: password123" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5001/api/v1/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginData `
        -TimeoutSec 10

    Write-Host "`n✅ Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "📄 Response:" -ForegroundColor Cyan
    $responseObj = $response.Content | ConvertFrom-Json
    $responseObj | Format-List

    if ($responseObj.success -eq $true) {
        Write-Host "🎉 Login API is working correctly!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Login returned success=false" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n❌ Error testing login API:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $responseText = $reader.ReadToEnd()
        Write-Host "Response body:" -ForegroundColor Gray
        Write-Host $responseText -ForegroundColor Gray
    }
}