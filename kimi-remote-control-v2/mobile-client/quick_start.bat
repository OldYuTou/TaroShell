@echo off
chcp 65001
cls

echo ==========================================
echo    Kimi Remote - 快速启动
echo ==========================================
echo.

:: 创建配置目录
if not exist "config" mkdir config

:: 检查是否已构建
if not exist "build\app\outputs\flutter-apk\app-release.apk" (
    echo [提示] 未找到 APK，先进行构建...
    echo.
    call build_apk.bat
    exit /b
)

echo [1/3] ✅ APK 已存在
echo.

:: 检查 ADB
echo [2/3] 🔍 检查设备连接...
adb devices

echo.
echo [3/3] 📱 安装 APK...
adb install -r build\app\outputs\flutter-apk\app-release.apk

if %errorlevel% equ 0 (
    echo.
    echo ✅ 安装成功！
    echo 请在手机上打开 "Kimi Remote" 应用
) else (
    echo.
    echo [错误] 安装失败
    echo 请检查：
    echo   1. 手机是否连接 USB
    echo   2. 是否开启 USB 调试
    echo   3. 是否允许安装未知来源应用
)

echo.
pause
