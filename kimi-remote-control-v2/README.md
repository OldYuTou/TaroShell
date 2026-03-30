# AI Remote Control V2 - 多适配器架构

高可插拔、高适配的 AI 编程工具远程控制系统。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                           AI Remote Hub                              │
│                    (统一推送服务 - 支持多适配器)                       │
└──────────────┬─────────────────────────────┬────────────────────────┘
               │                             │
    ┌──────────▼──────────┐      ┌───────────▼──────────┐
    │   适配器层           │      │     客户端层          │
    │  (Adapter Layer)    │      │   (Client Layer)      │
    ├─────────────────────┤      ├──────────────────────┤
    │ • Kimi Adapter      │      │ • Flutter App        │
    │ • Codex Adapter     │      │ • Web Dashboard      │
    │ • Claude Adapter    │      │ • CLI Tool           │
    │ • Custom Adapters   │      │                      │
    └─────────────────────┘      └──────────────────────┘
```

## 核心特性

- ✅ **统一协议**: 所有 AI 工具通过统一事件模型通信
- ✅ **插件架构**: 新工具接入只需开发适配器
- ✅ **多工具并行**: 同时连接多个 AI 工具
- ✅ **跨平台**: 手机、Web、CLI 多端支持

## 项目结构

```
kimi-remote-control-v2/
├── adapter-sdk/              # 适配器开发 SDK
│   ├── src/
│   │   ├── types.ts         # 统一类型定义
│   │   ├── BaseAdapter.ts   # 适配器基类
│   │   └── utils.ts         # 工具函数
│   └── package.json
│
├── adapters/                 # 各 AI 工具适配器
│   └── kimi-adapter/        # Kimi CLI 适配器
│       ├── src/
│       │   ├── KimiAdapter.ts
│       │   └── index.ts
│       └── package.json
│
├── hub/                      # 核心推送服务
│   ├── src/
│   │   ├── HubServer.ts     # Hub 服务器
│   │   ├── AdapterManager.ts # 适配器管理
│   │   └── index.ts
│   └── package.json
│
└── mobile-client/            # 手机客户端 (Flutter)
    └── ...
```

## 快速开始

### 1. 启动 Hub

```bash
cd hub
npm install
npm run build
npm start
```

### 2. 启动适配器

```bash
cd adapters/kimi-adapter
npm install
npm run build

# 环境变量
export HUB_URL="ws://localhost:8081"
export USER_ID="your_name"
export KIMI_PATH="kimi"

npm start
```

### 3. 运行手机客户端

```bash
cd mobile-client
flutter pub get
flutter run
```

## 统一事件模型

### 标准事件类型

```typescript
type EventType = 
  | 'task.start'        // 任务开始
  | 'task.progress'     // 进度更新
  | 'task.complete'     // 任务完成
  | 'task.error'        // 任务出错
  | 'approval.request'  // 需要审批
  | 'approval.granted'  // 已批准
  | 'approval.denied'   // 已拒绝
  | 'tool.call'         // 工具调用
  | 'tool.result'       // 工具结果
  | 'message.user'      // 用户消息
  | 'message.assistant' // AI 消息
  | 'system.notification'; // 系统通知
```

### 事件格式

```json
{
  "id": "uuid",
  "timestamp": 1700000000000,
  "source": "kimi",          // 适配器名称
  "version": "1.0.0",
  "type": "task.complete",
  "payload": {
    "title": "任务完成",
    "description": "AI 已完成当前任务",
    "raw": { ... }           // 原始数据
  },
  "session": {
    "id": "session-123",
    "name": "Project A",
    "workDir": "/home/user/project"
  }
}
```

## 开发新适配器

### 1. 创建项目

```bash
mkdir my-adapter
cd my-adapter
npm init -y
npm install @ai-remote/adapter-sdk
```

### 2. 实现适配器

```typescript
import { BaseAdapter, UnifiedCommand } from '@ai-remote/adapter-sdk';

export class MyAdapter extends BaseAdapter {
  readonly name = 'my-tool';
  readonly version = '1.0.0';
  readonly supportedEvents = ['task.complete', 'approval.request'];
  readonly supportedCommands = ['approval.respond'];
  
  protected async onInitialize() {
    // 初始化你的 AI 工具
  }
  
  protected onHubConnect() {
    // 连接成功后
    this.sendEvent('system.notification', {
      title: '已连接',
      description: `${this.name} 已连接到 Hub`
    });
  }
  
  protected async onCommand(command: UnifiedCommand) {
    // 处理手机端命令
    if (command.type === 'approval.respond') {
      // 处理审批响应
    }
  }
}
```

### 3. 事件转换

```typescript
// 当 AI 工具完成时
private onTaskComplete() {
  this.sendEvent('task.complete', {
    title: '任务完成',
    description: 'AI 已完成',
    progress: 100
  });
}
```

## 支持的工具

| 工具 | 适配器 | 状态 |
|------|--------|------|
| Kimi Code CLI | `@ai-remote/adapter-kimi` | ✅ 已实现 |
| OpenAI Codex | `@ai-remote/adapter-codex` | 🚧 计划中 |
| Claude Code | `@ai-remote/adapter-claude` | 🚧 计划中 |
| OpenCode | `@ai-remote/adapter-opencode` | 🚧 计划中 |
| Cline/Continue | `@ai-remote/adapter-cline` | 🚧 计划中 |

## 配置示例

### 单工具配置

```yaml
# hub/config.yaml
port: 8080
adapters:
  - name: kimi
    enabled: true
```

### 多工具并行

```yaml
adapters:
  - name: kimi
    enabled: true
    config:
      workDir: "~/projects/web"
      
  - name: codex
    enabled: true
    config:
      workDir: "~/projects/backend"
      
  - name: claude
    enabled: true
    config:
      workDir: "~/projects/mobile"
```

## 从 V1 迁移

V1 用户只需：
1. 更新 Hub 到 V2（向后兼容）
2. 将 Kimi 插件替换为 Kimi 适配器
3. 手机客户端无需修改

## 贡献

欢迎提交新的适配器！

## 许可证

MIT
