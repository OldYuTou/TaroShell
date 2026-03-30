# Flutter Android APK GitHub Actions 构建指南

完整的 GitHub Actions 配置，用于构建 Flutter Android APK 并自动发布到 GitHub Releases。

## 快速开始

### 1. 完整 Workflow 配置

创建 `.github/workflows/build_apk.yml`：

```yaml
name: Build Android APK

on:
  push:
    branches: [ main, master ]
    paths:
      - '**/pubspec.yaml'
      - '**/android/**'
      - '**/lib/**'
      - '.github/workflows/**'
  workflow_dispatch:
    inputs:
      version:
        description: '版本号 (例如: 1.0.0)'
        required: false
        default: ''

permissions:
  contents: write
  actions: read

env:
  FLUTTER_VERSION: '3.16.0'
  JAVA_VERSION: '17'

jobs:
  build:
    name: Build APK
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    - name: Setup Java
      uses: actions/setup-java@v4
      with:
        java-version: ${{ env.JAVA_VERSION }}
        distribution: 'temurin'
        cache: gradle
    
    - name: Setup Flutter
      uses: subosito/flutter-action@v2
      with:
        flutter-version: ${{ env.FLUTTER_VERSION }}
        channel: 'stable'
        cache: true
    
    - name: Get dependencies
      working-directory: ./your-flutter-project
      run: flutter pub get
    
    - name: Analyze code
      working-directory: ./your-flutter-project
      run: flutter analyze
      continue-on-error: true
    
    - name: Run tests
      working-directory: ./your-flutter-project
      run: flutter test
      continue-on-error: true
    
    - name: Build APK
      working-directory: ./your-flutter-project
      run: |
        flutter build apk --split-per-abi --release
        flutter build apk --release
    
    - name: Upload APKs
      uses: actions/upload-artifact@v4
      with:
        name: flutter-apks
        path: your-flutter-project/build/app/outputs/flutter-apk/*.apk
        retention-days: 30

  release:
    name: Create Release
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Download APK artifacts
      uses: actions/download-artifact@v4
      with:
        name: flutter-apks
        path: ./artifacts
    
    - name: Generate version
      id: version
      run: |
        if [ -n "${{ github.event.inputs.version }}" ]; then
          echo "VERSION=${{ github.event.inputs.version }}" >> $GITHUB_OUTPUT
        else
          echo "VERSION=1.0.${{ github.run_number }}" >> $GITHUB_OUTPUT
        fi
    
    - name: Create Release
      id: create_release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: v${{ steps.version.outputs.VERSION }}
        release_name: App v${{ steps.version.outputs.VERSION }}
        body: |
          ## Android APK
          
          ### 下载说明
          - **app-release.apk**: 通用版，支持所有设备
          - **app-arm64-v8a-release.apk**: ARM64 现代手机
          - **app-armeabi-v7a-release.apk**: ARM32 旧设备
        draft: false
        prerelease: false
    
    - name: Upload APKs to Release
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        VERSION: ${{ steps.version.outputs.VERSION }}
      run: |
        for apk in ./artifacts/*.apk; do
          if [ -f "$apk" ]; then
            echo "Uploading: $(basename $apk)"
            gh release upload "v${VERSION}" "$apk" --clobber --repo "$GITHUB_REPOSITORY"
          fi
        done
```

## 常见错误与解决方案

### 1. Kotlin 版本错误
**错误信息**：
```
Could not get unknown property 'kotlin_version'
```

**解决方案**：在 `android/app/build.gradle` 中直接指定版本：
```gradle
dependencies {
    implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.7.10"
}
```

### 2. AndroidX 主题错误
**错误信息**：
```
error: resource android:style/Theme.Light.NoActionBar not found
```

**解决方案**：更新 `android/app/src/main/res/values/styles.xml`：
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="LaunchTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:windowBackground">@drawable/launch_background</item>
    </style>
    <style name="NormalTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:windowBackground">?android:colorBackground</item>
    </style>
</resources>
```

并在 `android/app/build.gradle` 添加依赖：
```gradle
dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
}
```

### 3. AndroidX 未启用
**错误信息**：
```
Your app isn't using AndroidX
```

**解决方案**：创建 `android/gradle.properties`：
```properties
org.gradle.jvmargs=-Xmx4G -XX:MaxMetaspaceSize=2G -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
```

### 4. SDK 版本过低
**错误信息**：
```
The plugin xxx requires Android SDK version 34
```

**解决方案**：更新 `android/app/build.gradle`：
```gradle
android {
    compileSdkVersion 34
    
    defaultConfig {
        targetSdkVersion 34
        minSdkVersion 21
    }
}
```

### 5. Dart 代码错误
**错误信息**：
```
Error: This expression has type 'void' and can't be used.
```

**解决方案**：不要 `await` 返回 `void` 的方法：
```dart
// 错误
await _webSocket?.dispose();

// 正确
_webSocket?.dispose();
```

### 6. 缺少应用图标
**错误信息**：
```
resource mipmap/ic_launcher not found
```

**快速修复**（使用系统图标）：
在 `AndroidManifest.xml` 中：
```xml
android:icon="@android:drawable/ic_menu_compass"
```

**完整修复**：创建自适应图标资源。

### 7. Release 创建权限错误
**错误信息**：
```
Resource not accessible by integration
```

**解决方案**：在 workflow 顶部添加权限：
```yaml
permissions:
  contents: write
  actions: read
```

### 8. Release Asset 上传失败
**错误信息**：
```
{"message":"Multipart form data required"}
```

**解决方案**：使用 `gh CLI` 而不是 curl：
```yaml
- name: Upload APKs to Release
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    for apk in ./artifacts/*.apk; do
      gh release upload "v${VERSION}" "$apk" --clobber --repo "$GITHUB_REPOSITORY"
    done
```

## 关键配置检查清单

### Flutter 项目配置

- [ ] `pubspec.yaml` 存在且有效
- [ ] `android/app/build.gradle` 配置正确：
  - [ ] `compileSdkVersion 34`
  - [ ] `targetSdkVersion 34`
  - [ ] `minSdkVersion 21`
  - [ ] Kotlin 版本直接指定
  - [ ] AndroidX 依赖添加
- [ ] `android/gradle.properties` 启用 AndroidX
- [ ] `android/app/src/main/res/values/styles.xml` 使用 AppCompat 主题
- [ ] Dart 代码无语法错误

### Workflow 配置

- [ ] `permissions` 包含 `contents: write`
- [ ] `working-directory` 指向正确的 Flutter 项目路径
- [ ] Artifact 上传路径正确
- [ ] Release 上传使用 `gh CLI`

## 调试技巧

### 1. 本地测试构建
```bash
cd your-flutter-project
flutter clean
flutter pub get
flutter build apk --release
```

### 2. 查看 GitHub Actions 日志
```bash
# 查看最新运行
gh run list -L 5

# 查看失败日志
gh run view <run-id> --log-failed

# 查看特定 job 日志
gh run view <run-id> --job=<job-id>
```

### 3. 下载 Artifact 调试
```bash
gh run download <run-id> --name flutter-apks
```

### 4. 检查 Release
```bash
gh release view
gh release view --json assets
```

## 最佳实践

1. **使用矩阵构建**：可以同时构建多个 Flutter 版本
2. **缓存依赖**：使用 `actions/cache` 缓存 Gradle 和 Pub 依赖
3. **代码签名**：发布到应用商店需要配置签名密钥
4. **版本管理**：使用 `pubspec.yaml` 中的版本号
5. **分支保护**：只在 main/master 分支创建 Release

## 参考资料

- [Flutter 官方构建文档](https://docs.flutter.dev/deployment/android)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [subosito/flutter-action](https://github.com/subosito/flutter-action)
