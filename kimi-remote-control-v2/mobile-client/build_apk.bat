@echo off
chcp 65001
cls

echo ==========================================
echo    Kimi Remote - APK 构建脚本
echo ==========================================
echo.

:: 检查 Flutter
where flutter >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 找不到 Flutter，请确保 Flutter 已安装并添加到 PATH
    echo 下载地址: https://docs.flutter.dev/get-started/install/windows
    pause
    exit /b 1
)

echo [1/5] ✅ Flutter 已找到
flutter --version

echo.
echo [2/5] 📦 获取依赖...
call flutter pub get
if %errorlevel% neq 0 (
    echo [错误] 获取依赖失败
    pause
    exit /b 1
)

echo.
echo [3/5] 🧹 清理旧构建...
call flutter clean

echo.
echo [4/5] 🔨 构建 Release APK...
call flutter build apk --release
if %errorlevel% neq 0 (
    echo [错误] 构建失败
    pause
    exit /b 1
)

echo.
echo [5/5] ✅ 构建成功！
echo.
echo ==========================================
echo    APK 文件位置:
echo    build\app\outputs\flutter-apk\app-release.apk
echo ==========================================
echo.

:: 显示文件大小
for %%I in ("build\app\outputs\flutter-apk\app-release.apk") do (
    echo 文件大小: %%~zI 字节
)

echo.
echo 安装到手机:
echo   1. 开启手机 USB 调试
echo   2. 连接 USB
echo   3. 运行: flutter install
echo.
echo 或者手动安装:
echo   把 APK 文件传到手机，点击安装
echo.

pause
