# ==============================================================================
# Observability Traffic Generator Script (PowerShell)
# Generates realistic traffic across all endpoints to populate:
# - Prometheus Metrics (Counters, Histograms, Error Rates)
# - Loki Logs (Structured JSON with correlated trace_id & span_id)
# - Jaeger Traces (OpenTelemetry Spans with latency breakdowns)
# ==============================================================================

[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000",
    [int]$HealthyRequests = 50,
    [int]$ErrorRequests = 50,
    [int]$SlowRequests = 20
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🚀 Starting Observability Stack Traffic Generator" -ForegroundColor Cyan
Write-Host " Target URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Healthy Requests to /
Write-Host "`n[1/3] Sending $HealthyRequests requests to GET / (Healthy Traffic)..." -ForegroundColor Green
$healthySuccess = 0
1..$HealthyRequests | ForEach-Object {
    try {
        Invoke-RestMethod -Uri "$BaseUrl/" -Method Get -TimeoutSec 5 | Out-Null
        $healthySuccess++
    } catch {
        Write-Warning "Cannot connect to $BaseUrl. Ensure containers are running ('docker compose ps')."
        return
    }
}
Write-Host "  -> $healthySuccess / $HealthyRequests requests to '/' completed." -ForegroundColor Gray

# 2. Intermittent Error Requests to /error (~50% HTTP 500)
Write-Host "`n[2/3] Sending $ErrorRequests requests to GET /error (Simulating Intermittent Failures)..." -ForegroundColor Yellow
$status200 = 0
$status500 = 0

1..$ErrorRequests | ForEach-Object {
    try {
        $res = Invoke-WebRequest -Uri "$BaseUrl/error" -Method Get -UseBasicParsing -TimeoutSec 5
        if ($res.StatusCode -eq 200) { $status200++ }
    } catch {
        $status500++
    }
}
Write-Host "  -> $ErrorRequests requests to '/error' completed (200 OK: $status200 | 500 Error: $status500)." -ForegroundColor Gray

# 3. High Latency Requests to /slow (Concurrent execution)
Write-Host "`n[3/3] Sending $SlowRequests requests to GET /slow (Simulating High Latency 1-3s)..." -ForegroundColor Magenta
1..$SlowRequests | ForEach-Object {
    Start-Job -ScriptBlock {
        param($url)
        Invoke-WebRequest -Uri "$url/slow" -Method Get -UseBasicParsing -TimeoutSec 10 | Out-Null
    } -ArgumentList $BaseUrl | Out-Null
}

Write-Host "  -> Waiting for concurrent /slow requests to complete..." -ForegroundColor Gray
Get-Job | Wait-Job | Remove-Job
Write-Host "  -> $SlowRequests slow requests completed." -ForegroundColor Gray

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " ✅ Telemetry Dispatched Successfully!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "• Grafana Dashboard: http://localhost:3001/d/devops-observability-overview" -ForegroundColor White
Write-Host "• Grafana Explore (Loki): http://localhost:3001/explore" -ForegroundColor White
Write-Host "• Jaeger UI (Traces): http://localhost:16686" -ForegroundColor White
Write-Host "• Prometheus Metrics: http://localhost:9090" -ForegroundColor White
Write-Host "• Prometheus Alerts: http://localhost:9090/alerts" -ForegroundColor White
