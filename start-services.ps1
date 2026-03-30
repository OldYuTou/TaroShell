# 启动 Hub 和 Kimi 适配器服务

$hubPath = "F:\kimi-bridge\kimi-remote-control-v2\hub"
$adapterPath = "F:\kimi-bridge\kimi-remote-control-v2\adapters\kimi-adapter"

# 启动 Hub
Write-Host "Starting Hub server..." -ForegroundColor Green
$hubJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    node dist/index.js
} -ArgumentList $hubPath

# 等待 Hub 启动
Start-Sleep -Seconds 3

# 启动 Kimi Adapter
Write-Host "Starting Kimi adapter..." -ForegroundColor Green
$adapterJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    node dist/index.js
} -ArgumentList $adapterPath

Write-Host "`nServices started!" -ForegroundColor Cyan
Write-Host "Hub WebSocket: ws://192.168.100.4:8081" -ForegroundColor Yellow
Write-Host "Kimi Web UI: http://localhost:5494" -ForegroundColor Yellow
Write-Host "`nPress Ctrl+C to stop all services`n" -ForegroundColor Gray

# 等待并显示输出
while ($true) {
    Receive-Job $hubJob
    Receive-Job $adapterJob
    Start-Sleep -Milliseconds 500
}
