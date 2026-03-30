# AI Remote Control V2 - 功能清单

## ✅ 已实现功能

### 1. 离线推送 (FCM/APNs)

**文件**: `adapter-sdk/src/push/`

- ✅ `PushService.ts` - 推送服务管理器基类
- ✅ `FCMService.ts` - Firebase Cloud Messaging 实现
- ✅ `APNsService.ts` - Apple Push Notification Service 实现
- ✅ 统一事件到推送通知的转换
- ✅ 设备注册/注销管理
- ✅ 多平台支持 (iOS/Android)

**Hub 集成**:
- ✅ 自动发送离线推送当 WebSocket 不可用时
- ✅ 推送设备注册 HTTP API
- ✅ 环境变量配置支持

### 2. 发送消息功能

**适配器 SDK**:
- ✅ `message.send` 命令类型
- ✅ 所有适配器支持发送消息给 AI

**Kimi 适配器**:
- ✅ 实现 `send_message` 命令处理
- ✅ 将消息转发到 Kimi CLI

**手机客户端**:
- ✅ 消息输入 UI (底部弹出的输入框)
- ✅ `SendMessageEvent` BLoC 事件
- ✅ WebSocket 发送消息接口

### 3. 完整功能列表

#### 核心架构
- ✅ 适配器 SDK (BaseAdapter, 统一类型)
- ✅ 多适配器管理
- ✅ 事件总线
- ✅ 协议路由

#### 适配器
- ✅ Kimi Code CLI 适配器
- ✅ 完整的事件转换 (TurnBegin → task.start, TurnEnd → task.complete...)
- ✅ 审批请求处理
- ✅ 命令响应

#### Hub 服务
- ✅ WebSocket 服务器
- ✅ HTTP API
- ✅ 用户设备隔离
- ✅ 心跳管理
- ✅ 离线推送集成

#### 手机客户端
- ✅ WebSocket 连接
- ✅ 本地通知
- ✅ 任务完成提醒
- ✅ 审批弹窗
- ✅ 远程批准/拒绝
- ✅ **发送消息给 AI** ⭐ 新增
- ✅ **推送 Token 注册** ⭐ 新增

## 🚀 使用方式

### 启用离线推送

```bash
# Hub 环境变量
export FCM_ENABLED=true
export FCM_PROJECT_ID="your-project"
export FCM_PRIVATE_KEY="..."
export FCM_CLIENT_EMAIL="..."

export APNS_ENABLED=true
export APNS_KEY_ID="..."
export APNS_TEAM_ID="..."
export APNS_PRIVATE_KEY="..."
export APNS_BUNDLE_ID="..."

npm start
```

### 手机端发送消息

```dart
// 在已连接的页面，点击右上角发送按钮
// 输入消息，点击发送
context.read<RemoteBloc>().add(SendMessageEvent(message: "你好 Kimi"));
```

### 注册推送 Token

```dart
// 初始化时
final fcmToken = await FirebaseMessaging.instance.getToken();
webSocket.registerPushToken(fcmToken, Platform.isIOS ? 'ios' : 'android');
```

## 📋 下一步建议

1. **测试离线推送** - 验证 FCM/APNs 配置
2. **实现 Codex 适配器** - 验证多适配器架构
3. **添加对话历史** - 查看完整聊天记录
4. **端到端加密** - 安全消息传输
