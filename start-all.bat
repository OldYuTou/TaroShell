@echo off
echo ===================================
echo  Starting Kimi Remote Services
echo ===================================
echo.
echo Hub WebSocket: ws://192.168.100.4:8081
echo Kimi Web UI: http://localhost:5494
echo.

:: Start Hub in new window
echo Starting Hub...
start "Hub Server" cmd /k "cd /d F:\kimi-bridge\kimi-remote-control-v2\hub && node dist/index.js"

:: Wait for Hub to start
timeout /t 3 /nobreak >nul

:: Start Adapter in new window
echo Starting Kimi Adapter...
start "Kimi Adapter" cmd /k "cd /d F:\kimi-bridge\kimi-remote-control-v2\adapters\kimi-adapter && node dist/index.js"

echo.
echo Services started! Press any key to close this window...
pause >nul
