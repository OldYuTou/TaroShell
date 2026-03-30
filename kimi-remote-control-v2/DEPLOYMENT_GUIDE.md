# AI Remote Control - 部署使用指南

## 🚀 快速开始（5分钟上手）

### 方案一：本地开发测试（推荐先试试）

#### 1. 准备环境

```bash
# 需要安装
# - Node.js 18+
# - npm 或 yarn
# - Flutter SDK（如果要运行手机端）
# - Kimi CLI（已安装的跳过）

# 检查版本
node -v    # v18+
npm -v     # v9+
```

#### 2. 部署 Hub 服务

```bash
# 进入 hub 目录
cd kimi-remote-control-v2/hub

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 启动服务
npm start

# 看到输出：
# [Hub] Server started
#   HTTP: http://localhost:8080
#   WebSocket: ws://localhost:8081
```

#### 3. 部署 Kimi 适配器

```bash
# 新终端，进入适配器目录
cd kimi-remote-control-v2/adapters/kimi-adapter

# 安装依赖
npm install

# 编译
npm run build

# 设置环境变量
export HUB_URL="ws://localhost:8081"
export USER_ID="your_name"
export KIMI_PATH="kimi"  # 如果 kimi 不在 PATH 里，写完整路径

# 启动适配器
npm start

# 看到输出：
# [KimiFullAdapter] Initializing...
# [KimiFullAdapter] Connected to Hub
# [KimiFullAdapter] Connected to Kimi
```

#### 4. 运行手机 App（可选）

```bash
# 进入手机客户端
cd kimi-remote-control-v2/mobile-client

# 安装依赖
flutter pub get

# 运行
flutter run

# 配置：
# - 服务器地址: ws://localhost:8081
# - 用户ID: your_name（和适配器相同）
```

---

## 🌐 方案二：局域网使用（手机连电脑）

### 电脑端配置

```bash
# 1. 获取电脑 IP
ipconfig  # Windows
ifconfig  # Mac/Linux

# 假设 IP 是 192.168.1.100

# 2. 启动 Hub（绑定所有网卡）
export HTTP_PORT=8080
export WS_PORT=8081
cd hub && npm start

# 3. 启动 Kimi 适配器
export HUB_URL="ws://192.168.1.100:8081"  # 用电脑 IP
export USER_ID="your_name"
cd adapters/kimi-adapter && npm start

# 4. 启动 Kimi CLI（让 Kimi Web 运行）
kimi web --network --host 0.0.0.0
```

### 手机端配置

```
服务器地址: ws://192.168.1.100:8081
用户ID: your_name
```

---

## ☁️ 方案三：公网部署（随时随地使用）

### 服务器准备

需要一台有公网 IP 的服务器（阿里云、腾讯云等）

```bash
# 1. 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 克隆代码
git clone <your-repo>
cd kimi-remote-control-v2

# 3. 安装依赖并编译
# Hub
cd hub && npm install && npm run build

# Kimi 适配器（在开发机器上运行，不是服务器）
cd ../adapters/kimi-adapter && npm install && npm run build
```

### 服务器部署 Hub

```bash
cd hub

# 使用 PM2 守护进程
sudo npm install -g pm2

pm2 start dist/index.js --name "ai-hub"
pm2 save
pm2 startup

# 查看状态
pm2 status
pm2 logs ai-hub
```

### 防火墙配置

```bash
# 开放端口
sudo ufw allow 8080/tcp
sudo ufw allow 8081/tcp
```

### 开发机器配置（运行 Kimi）

```bash
# Kimi 适配器连接到公网 Hub
export HUB_URL="ws://your-server-ip:8081"
export USER_ID="your_name"

cd adapters/kimi-adapter
npm start
```

### 手机连接

```
服务器地址: ws://your-server-ip:8081
用户ID: your_name
```

---

## 🔧 进阶配置

### 1. 启用离线推送（FCM）

#### 获取 FCM 凭证

1. 访问 https://console.firebase.google.com/
2. 创建项目
3. 项目设置 → 服务账号 → 生成私钥
4. 下载 JSON 文件

#### 配置 Hub

```bash
# hub/.env 文件
FCM_ENABLED=true
FCM_PROJECT_ID="your-project-id"
FCM_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
FCM_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"

# 重启 Hub
pm2 restart ai-hub
```

#### 手机端配置

```bash
# 下载 google-services.json (Android) 或 GoogleService-Info.plist (iOS)
# 放到 flutter 项目的对应位置

# Android: android/app/google-services.json
# iOS: ios/Runner/GoogleService-Info.plist
```

### 2. 启用 HTTPS/WSS

```bash
# 使用 Nginx 反向代理
sudo apt install nginx

# /etc/nginx/sites-available/ai-hub
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
    }
    
    location /ws {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 3. 多用户配置

```bash
# 每个用户需要：
# 1. 独立的适配器进程

# 用户 A
export USER_ID="alice"
export HUB_URL="ws://server:8081"
npm start

# 用户 B（新终端）
export USER_ID="bob"
export HUB_URL="ws://server:8081"
npm start
```

---

## 📋 系统要求

### 最低配置

| 组件 | 要求 |
|------|------|
| Node.js | 18+ |
| 内存 | 512MB |
| 硬盘 | 1GB |
| 网络 | 能访问外网 |

### 推荐配置

| 组件 | 要求 |
|------|------|
| Node.js | 20 LTS |
| 内存 | 2GB |
| 硬盘 | 10GB |
| 带宽 | 5Mbps+ |

---

## 🔍 故障排查

### Hub 启动失败

```bash
# 端口被占用
lsof -i :8080
kill -9 <PID>

# 或更换端口
export HTTP_PORT=9090
export WS_PORT=9091
```

### 适配器连不上 Hub

```bash
# 检查网络
telnet localhost 8081

# 检查防火墙
sudo ufw status
```

### 手机连不上

```bash
# 检查手机和电脑是否同网段
ping 192.168.1.xxx  # 电脑 IP

# 检查 Kimi 是否运行
ps aux | grep kimi
```

### 收不到推送

```bash
# 检查 FCM 配置
curl -X POST https://fcm.googleapis.com/v1/projects/xxx/messages:send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message":{"token":"xxx","notification":{"title":"Test","body":"Test"}}}'
```

---

## 🎉 验证成功

如果看到以下输出，说明部署成功：

```
[Hub] Server started
  HTTP: http://localhost:8080
  WebSocket: ws://localhost:8081
  
[KimiFullAdapter] Connected to Hub
[KimiFullAdapter] Connected to Kimi

# 手机端显示：
# - 连接状态：已连接
# - 会话列表：显示当前会话
# - 可以发送消息、收到回复
```

---

## 💡 下一步

1. ✅ 本地测试通过
2. 🔄 部署到云服务器（如需公网访问）
3. 🔐 配置 HTTPS（生产环境必需）
4. 📱 发布手机 App
5. 🚀 接入更多 AI 工具（Codex、Claude）
