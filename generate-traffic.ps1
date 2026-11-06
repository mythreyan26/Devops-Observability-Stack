# ==============================================================================
# Observability Traffic Generator Script (PowerShell)
# Generates realistic traffic across all endpoints to populate:
# - Prometheus Metrics (Counters, Histograms)
# - Loki Logs (Structured JSON)
# - Jaeger Traces (OpenTelemetry Spans)
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🚀 Starting Observability Stack Traffic Generator" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000"

# 1. Normal Requests to / (50 requests)
Write-Host "`n[1/3] Sending 50 requests to GET / (Healthy Traffic)..." -ForegroundColor Green
1..50 | ForEach-Object {
    try {
        Invoke-RestMethod -Uri "$baseUrl/" -Method Get | Out-Null
    } catch {
        Write-Warning "Failed to connect to $baseUrl/. Ensure docker compose is running."
        break
    }
}
Write-Host "  -> 50 requests to '/' completed successfully." -ForegroundColor Gray

# 2. Intermittent Error Requests to /error (50 requests - ~50% status 500)
Write-Host "`n[2/3] Sending 50 requests to GET /error (Simulating Failures)..." -ForegroundColor Yellow
$error500Count = 0
$success200Count = 0

1..50 | ForEach-Object {
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/error" -Method Get -UseBasicParsing
        if ($response.StatusCode -eq 200) { $success200Count++ }
    } catch {
        $error500Count++
    }
}
Write-Host "  -> 50 requests to '/error' completed (200 OK: $success200Count | 500 Error: $error500Count)." -ForegroundColor Gray

# 3. Latency Requests to /slow (Concurrent execution for speed)
Write-Host "`n[3/3] Sending 20 requests to GET /slow (Simulating High Latency)..." -ForegroundColor Magenta
1..20 | ForEach-Object {
    Start-Job -ScriptBlock {
        param($url)
        Invoke-WebRequest -Uri "$url/slow" -Method Get -UseBasicParsing | Out-Null
    } -ArgumentList $baseUrl | Out-Null
}

Write-Host "  -> Waiting for concurrent /slow requests to finish..." -ForegroundColor Gray
Get-Job | Wait-Job | Remove-Job
Write-Host "  -> 20 slow requests completed (durations between 1s and 3s)." -ForegroundColor Gray

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " ✅ Traffic generation complete! All telemetry dispatched." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "• Grafana Dashboard: http://localhost:3001/d/devops-observability-overview" -ForegroundColor White
Write-Host "• Grafana Explore (Loki): http://localhost:3001/explore" -ForegroundColor White
Write-Host "• Jaeger Traces: http://localhost:16686" -ForegroundColor White
Write-Host "• Prometheus Metrics: http://localhost:9090" -ForegroundColor White
