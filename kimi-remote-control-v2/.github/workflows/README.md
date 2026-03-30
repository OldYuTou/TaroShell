# GitHub Actions 工作流说明

## build_apk.yml

自动构建 Android APK 的工作流。

### 触发条件

- 推送到 main/master 分支且修改了 mobile-client 目录
- 手动触发（workflow_dispatch）

### 构建输出

- Universal APK（通用版，所有设备）
- ARM64 APK（arm64-v8a，现代手机）
- ARM32 APK（armeabi-v7a，旧手机）

### 自动发布

构建成功后自动创建 GitHub Release，包含所有 APK 文件。
