#!/bin/bash

echo "=========================================="
echo "   Kimi Remote - APK 构建脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Flutter
if ! command -v flutter &> /dev/null; then
    echo -e "${RED}[错误] 找不到 Flutter${NC}"
    echo "请确保 Flutter 已安装并添加到 PATH"
    echo "下载地址: https://docs.flutter.dev/get-started/install"
    exit 1
fi

echo -e "${GREEN}[1/5] ✅ Flutter 已找到${NC}"
flutter --version
echo ""

# 检查 Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${YELLOW}[警告] ANDROID_HOME 未设置${NC}"
    echo "尝试查找 Android SDK..."
    
    # 常见路径
    if [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    elif [ -d "/usr/lib/android-sdk" ]; then
        export ANDROID_HOME="/usr/lib/android-sdk"
    fi
    
    if [ -n "$ANDROID_HOME" ]; then
        echo -e "${GREEN}找到 Android SDK: $ANDROID_HOME${NC}"
        export PATH="$PATH:$ANDROID_HOME/platform-tools"
    else
        echo -e "${RED}[错误] 找不到 Android SDK${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}[2/5] 📦 获取依赖...${NC}"
flutter pub get
if [ $? -ne 0 ]; then
    echo -e "${RED}[错误] 获取依赖失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}[3/5] 🧹 清理旧构建...${NC}"
flutter clean

echo ""
echo -e "${GREEN}[4/5] 🔨 构建 Release APK...${NC}"
flutter build apk --release
if [ $? -ne 0 ]; then
    echo -e "${RED}[错误] 构建失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}[5/5] ✅ 构建成功！${NC}"
echo ""
echo "=========================================="
echo "   APK 文件位置:"
echo "   build/app/outputs/flutter-apk/app-release.apk"
echo "=========================================="
echo ""

# 显示文件大小
if [ -f "build/app/outputs/flutter-apk/app-release.apk" ]; then
    ls -lh build/app/outputs/flutter-apk/app-release.apk
fi

echo ""
echo "安装到手机:"
echo "  1. 开启手机 USB 调试"
echo "  2. 连接 USB"
echo "  3. 运行: flutter install"
echo ""
echo "或者手动安装:"
echo "  把 APK 文件传到手机，点击安装"
echo ""

read -p "按回车键继续..."
