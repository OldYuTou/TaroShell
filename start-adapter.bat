@echo off
cd /d "F:\kimi-bridge\kimi-remote-control-v2\adapters\kimi-adapter"
echo Starting Kimi Adapter...
echo Waiting 3 seconds for Hub to start...
timeout /t 3 /nobreak >nul
node dist/index.js
pause
