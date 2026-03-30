# Kimi Code 远程控制系统

一套完整的 Kimi Code CLI 远程控制解决方案，让你可以通过手机接收 Kimi 任务完成通知，并进行远程审批操作。

## 架构概览

```
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│   手机客户端      │◄────►│    推送服务          │◄────►│   Kimi CLI     │
│  (Flutter App)   │  WS  │  (Node.js + WS)     │  WS  │  (电脑端插件)   │
│                 │      │                     │      │                 │
│ - 接收推送        │      │ - 消息转发           │      │ - 事件捕获       │
│ - 远程审批        │      │ - 设备管理           │      │ - 推送到手机     │
│ - 任务状态        │      │ - 多用户支持         │      │ - 接收命令       │
└─────────────────┘      └─────────────────────┘      └─────────────────┘
```

## 组件说明

| 组件 | 技术栈 | 功能 |
|------|--------|------|
| **推送服务** | Node.js + WebSocket | 中转消息，管理设备连接 |
| **手机客户端** | Flutter | 接收通知，显示状态，执行审批 |
| **Kimi 插件** | Python | 捕获 Kimi CLI 事件并推送 |

## 快速开始

### 1. 部署推送服务

```bash
cd push-service
npm install
npm start
```

服务将启动在：
- WebSocket: `ws://localhost:8081`
- HTTP API: `http://localhost:8080`

### 2. 配置 Kimi CLI 插件

```bash
# 安装依赖
pip install websockets

# 设置环境变量
export KIMI_PUSH_SERVICE_URL="ws://your-server:8081"
export KIMI_REMOTE_USER_ID="your_user_id"

# 启动 Kimi CLI
kimi web --network
```

### 3. 运行手机客户端

```bash
cd mobile-client
flutter pub get
flutter run
```

配置服务器地址和用户ID，点击连接即可。

## 功能特性

### ✅ 已实现

- [x] WebSocket 实时消息推送
- [x] 任务完成通知（TurnEnd）
- [x] 审批请求通知（ApprovalRequest）
- [x] 远程批准/拒绝操作
- [x] 多设备管理
- [x] 本地推送提醒

### 🚧 计划实现

- [ ] 查看完整对话历史
- [ ] 远程发送消息
- [ ] 文件/图片预览
- [ ] 多会话管理
- [ ] APNs/FCM 离线推送
- [ ] 端到端加密

## 使用场景

### 场景 1：长时间运行的任务

你在电脑上让 Kimi 执行一个耗时的任务（如数据分析、代码重构），然后离开电脑。任务完成后，手机立即收到通知。

### 场景 2：需要审批的操作

Kimi 执行敏感操作（如写入文件、执行命令）需要你的确认。你可以在手机上查看详情并批准或拒绝。

### 场景 3：远程监控

外出时随时查看家里电脑上 Kimi 的任务状态，了解执行进度。

## API 文档

### WebSocket 消息格式

**注册消息（客户端 → 服务器）:**
```json
{
  "type": "register",
  "clientType": "mobile",
  "userId": "user123",
  "deviceInfo": {
    "name": "iPhone",
    "platform": "ios"
  }
}
```

**Kimi 事件（Kimi → 服务器）:**
```json
{
  "type": "kimi_event",
  "event": "TurnEnd",
  "sessionId": "session-uuid",
  "payload": {},
  "timestamp": 1700000000
}
```

**推送通知（服务器 → 手机）:**
```json
{
  "type": "push",
  "title": "任务完成",
  "body": "AI 已完成当前任务",
  "data": {
    "type": "kimi_event",
    "event": "TurnEnd"
  }
}
```

## 部署指南

### 云服务器部署

```bash
# 克隆代码
git clone <your-repo>
cd kimi-remote-control/push-service

# 安装依赖
npm install --production

# 启动服务（使用 PM2）
npm install -g pm2
pm2 start server.js --name kimi-push
pm2 save
pm2 startup
```

### Docker 部署

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8080 8081
CMD ["node", "server.js"]
```

```bash
docker build -t kimi-push .
docker run -d -p 8080:8080 -p 8081:8081 kimi-push
```

## 安全建议

1. **使用 HTTPS/WSS**: 生产环境务必使用 SSL
2. **设置强密码**: 配置复杂的用户ID和 JWT_SECRET
3. **限制访问**: 使用防火墙限制服务器端口访问
4. **认证**: 添加用户认证机制（TODO）

## 贡献

欢迎提交 Issue 和 PR！

## 许可证

MIT License
