@echo off
cd /d "F:\kimi-bridge\kimi-remote-control-v2\hub"
echo Starting Hub Server...
echo WebSocket: ws://localhost:8081
node dist/index.js
pause
