# 构建 APK 指南

## 📋 前置要求

### 1. 安装 Flutter SDK

```bash
# Windows
# 下载: https://docs.flutter.dev/get-started/install/windows
# 解压到 C:\flutter，添加到环境变量 PATH

# Mac
brew install flutter

# 验证安装
flutter doctor
```

### 2. 安装 Android Studio

```bash
# 下载: https://developer.android.com/studio

# 安装后需要：
# 1. 打开 Android Studio
# 2. Tools -> SDK Manager
# 3. 安装 Android SDK (API 21+)
# 4. 安装 Android SDK Command-line Tools
```

### 3. 配置环境变量

**Windows:**
```
# 系统属性 -> 环境变量 -> Path 添加：
C:\flutter\bin
C:\Users\你的用户名\AppData\Local\Android\Sdk\platform-tools
```

**Mac/Linux:**
```bash
# ~/.zshrc 或 ~/.bashrc
export PATH="$PATH:$HOME/flutter/bin"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

---

## 🔧 项目配置

### 1. 创建 local.properties

在 `android/local.properties` 文件中添加：

```properties
# Windows
flutter.sdk=C:\\flutter
sdk.dir=C:\\Users\\你的用户名\\AppData\\Local\\Android\\Sdk

# Mac
flutter.sdk=/Users/你的用户名/flutter
sdk.dir=/Users/你的用户名/Library/Android/sdk
```

### 2. 获取依赖

```bash
cd kimi-remote-control-v2/mobile-client

# 获取 Flutter 依赖
flutter pub get
```

---

## 📱 构建 APK

### 调试版本（快速测试）

```bash
# 构建 Debug APK
flutter build apk --debug

# 输出位置
build/app/outputs/flutter-apk/app-debug.apk
```

### 发布版本（正式使用）

```bash
# 构建 Release APK
flutter build apk --release

# 输出位置
build/app/outputs/flutter-apk/app-release.apk

# 查看 APK 大小
ls -lh build/app/outputs/flutter-apk/
```

### 构建 App Bundle (Google Play)

```bash
flutter build appbundle --release
```

---

## 🔌 安装到手机

### 方法 1：USB 连接

```bash
# 1. 手机开启开发者模式
# 设置 -> 关于手机 -> 版本号（连续点击7次）

# 2. 开启 USB 调试
# 设置 -> 系统 -> 开发者选项 -> USB 调试

# 3. 连接手机，安装
flutter install

# 或直接安装 APK
adb install build/app/outputs/flutter-apk/app-release.apk
```

### 方法 2：传输文件

```bash
# 1. 把 APK 发送到手机（微信、QQ、邮件）
# 2. 手机上点击安装
# 3. 可能需要允许 "未知来源" 安装
```

---

## ⚠️ 常见问题

### 1. flutter doctor 报错

```bash
# Android toolchain 未配置
flutter config --android-sdk="/path/to/android/sdk"

# 缺少 Android licenses
flutter doctor --android-licenses
```

### 2. 构建失败

```bash
# 清理构建缓存
flutter clean
flutter pub get
flutter build apk

# 检查 Gradle
 cd android && ./gradlew clean
```

### 3. 依赖冲突

```bash
# 更新依赖
flutter pub upgrade

# 查看依赖树
flutter pub deps
```

### 4. APK 太大

```bash
# 使用分 ABI 构建
flutter build apk --split-per-abi

# 输出:
# app-arm64-v8a-release.apk
# app-armeabi-v7a-release.apk
# app-x86_64-release.apk
```

---

## 📦 完整构建脚本

创建 `build.sh`：

```bash
#!/bin/bash

echo "🚀 开始构建 APK..."

# 清理
echo "🧹 清理旧构建..."
flutter clean

# 获取依赖
echo "📦 获取依赖..."
flutter pub get

# 分析代码
echo "🔍 分析代码..."
flutter analyze

# 构建 Release APK
echo "🔨 构建 APK..."
flutter build apk --release

# 检查输出
if [ -f "build/app/outputs/flutter-apk/app-release.apk" ]; then
    echo "✅ 构建成功！"
    echo "📱 APK 位置: build/app/outputs/flutter-apk/app-release.apk"
    ls -lh build/app/outputs/flutter-apk/app-release.apk
else
    echo "❌ 构建失败"
    exit 1
fi
```

运行：
```bash
chmod +x build.sh
./build.sh
```

---

## 🎯 下一步

构建成功后：
1. 安装 APK 到手机
2. 配置服务器地址
3. 启动 Hub 和 Kimi 适配器
4. 开始远程控制！
