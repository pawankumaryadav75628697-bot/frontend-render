# Port Management Script for Development
# Usage: .\manage-port.ps1 [check|kill|start]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("check", "kill", "start")]
    [string]$Action,
    
    [int]$Port = 5001
)

function Check-Port {
    param([int]$PortNumber)
    
    Write-Host "🔍 Checking port $PortNumber..." -ForegroundColor Cyan
    $connections = netstat -ano | Select-String ":$PortNumber "
    
    if ($connections) {
        Write-Host "📍 Port $PortNumber is in use:" -ForegroundColor Yellow
        $connections | ForEach-Object {
            $line = $_.Line
            if ($line -match "LISTENING\s+(\d+)") {
                $pid = $matches[1]
                $processName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
                Write-Host "  PID: $pid ($processName)" -ForegroundColor White
            }
        }
        return $true
    } else {
        Write-Host "✅ Port $PortNumber is available" -ForegroundColor Green
        return $false
    }
}

function Kill-Port {
    param([int]$PortNumber)
    
    Write-Host "🔪 Attempting to free port $PortNumber..." -ForegroundColor Yellow
    $connections = netstat -ano | Select-String ":$PortNumber.*LISTENING"
    
    if ($connections) {
        $connections | ForEach-Object {
            if ($_.Line -match "LISTENING\s+(\d+)") {
                $pid = $matches[1]
                try {
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "🛑 Killing process $($process.ProcessName) (PID: $pid)" -ForegroundColor Red
                        Stop-Process -Id $pid -Force
                        Start-Sleep 2
                    }
                } catch {
                    Write-Host "❌ Failed to kill process $pid`: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
        
        # Verify port is now free
        if (Check-Port $PortNumber) {
            Write-Host "❌ Port $PortNumber is still in use after cleanup" -ForegroundColor Red
            return $false
        } else {
            Write-Host "✅ Port $PortNumber is now available" -ForegroundColor Green
            return $true
        }
    } else {
        Write-Host "ℹ️ No processes found using port $PortNumber" -ForegroundColor Blue
        return $true
    }
}

function Start-DevServer {
    Write-Host "🚀 Starting development server..." -ForegroundColor Green
    
    if (Check-Port $Port) {
        Write-Host "⚠️ Port $Port is in use. Attempting to free it..." -ForegroundColor Yellow
        if (-not (Kill-Port $Port)) {
            Write-Host "❌ Could not free port $Port. Aborting." -ForegroundColor Red
            return
        }
    }
    
    Write-Host "🏃 Starting npm run dev..." -ForegroundColor Cyan
    npm run dev
}

# Main execution
switch ($Action) {
    "check" {
        Check-Port $Port
    }
    "kill" {
        Kill-Port $Port
    }
    "start" {
        Start-DevServer
    }
}