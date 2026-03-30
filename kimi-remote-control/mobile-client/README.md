# Kimi 远程控制 - 手机客户端

Flutter 开发的跨平台手机客户端，用于接收 Kimi Code CLI 的推送通知。

## 功能

- 📱 实时接收 Kimi 任务完成通知
- 🔔 本地推送提醒
- ✅ 远程审批操作
- 👁️ 查看任务状态
- 📟 多设备管理

## 安装

### 环境要求

- Flutter SDK >= 3.0.0
- Dart SDK >= 3.0.0

### 依赖安装

```bash
cd mobile-client
flutter pub get
```

### 运行

```bash
# 开发模式
flutter run

# 构建 Android APK
flutter build apk --release

# 构建 iOS
flutter build ios --release
```

## 配置

1. 打开应用，进入设置页面
2. 输入推送服务器地址（如 `ws://your-server:8081`）
3. 输入用户ID（与电脑端配置相同）
4. 点击连接

## 使用

### 接收通知

当 Kimi CLI 完成任务或需要审批时，手机会收到推送通知。

### 远程审批

在"通知"标签页查看待处理的审批请求：
- 点击"批准"允许操作
- 点击"拒绝"阻止操作

### 查看状态

- **通知**：待处理的审批请求
- **完成**：已完成的任务历史
- **设备**：连接的电脑设备列表

## 项目结构

```
lib/
├── main.dart                 # 应用入口
├── models/
│   └── kimi_event.dart       # 事件模型
├── services/
│   ├── websocket_service.dart # WebSocket 服务
│   └── notification_service.dart # 本地通知
├── bloc/
│   └── remote_bloc.dart      # 状态管理
├── screens/
│   ├── home_screen.dart      # 主页面
│   └── settings_screen.dart  # 设置页面
└── widgets/                   # 可复用组件
```

## 开发计划

- [ ] 支持查看对话历史
- [ ] 支持发送消息到 Kimi
- [ ] 支持图片/文件预览
- [ ] 支持多会话切换
- [ ] iOS 后台推送（APNs）
- [ ] Android 后台推送（FCM）
