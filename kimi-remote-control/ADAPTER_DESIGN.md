# AI 编程工具远程控制 - 高适配架构设计

## 目标

设计一个通用的远程控制系统，支持多种 AI 编程工具：
- ✅ Kimi Code CLI
- 🎯 Codex (OpenAI)
- 🎯 Claude Code
- 🎯 OpenCode
- 🎯 Cline / Continue
- 🎯 未来更多工具...

## 各工具协议分析

### 1. Kimi Code CLI
- **协议**: JSON-RPC 2.0 over WebSocket/stdio
- **事件**: TurnBegin, TurnEnd, StepBegin, ApprovalRequest, ToolCall...
- **Hook 方式**: Wire Protocol + Hook Engine

### 2. Codex CLI (OpenAI)
- **协议**: 类似 MCP (Model Context Protocol)
- **事件**: request, response, tool_call, approval
- **Hook 方式**: 通过 stdin/stdout 拦截

### 3. Claude Code
- **协议**: 内部使用 Claude API
- **事件**: message_start, message_delta, message_stop, tool_use
- **Hook 方式**: 通过 API 拦截或 wrapper

### 4. OpenCode
- **协议**: 基于 Node.js，类似 VS Code 扩展 API
- **事件**: 通过 VS Code 事件系统
- **Hook 方式**: 扩展 API 或 WebSocket

## 统一架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Agent Remote Hub                         │
│                      (统一的推送服务)                             │
└─────────────┬───────────────────────────────────────────────────┘
              │
    ┌─────────┴─────────┬─────────────────┬─────────────────┐
    │                   │                 │                 │
┌───▼────┐        ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
│ Kimi   │        │  Codex  │      │ Claude  │      │  Other  │
│Adapter │        │ Adapter │      │ Adapter │      │ Adapters│
└───┬────┘        └────┬────┘      └────┬────┘      └────┬────┘
    │                  │                │                │
┌───▼────┐        ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
│  Kimi  │        │  Codex  │      │ Claude  │      │  ...    │
│  CLI   │        │   CLI   │      │  Code   │      │         │
└────────┘        └─────────┘      └─────────┘      └─────────┘
```

## 核心抽象层

### 1. 统一事件模型

```typescript
// 所有 AI 工具的事件都映射到这个统一模型
interface UnifiedEvent {
  // 元数据
  id: string;
  timestamp: number;
  source: string;          // "kimi", "codex", "claude", ...
  version: string;         // 适配器版本
  
  // 事件类型 (标准化)
  type: EventType;
  
  // 事件数据
  payload: EventPayload;
  
  // 会话信息
  session: SessionInfo;
}

type EventType = 
  | 'task.start'        // 任务开始
  | 'task.progress'     // 进度更新
  | 'task.complete'     // 任务完成 ✅
  | 'task.error'        // 任务出错
  | 'approval.request'  // 需要审批 ⚠️
  | 'approval.granted'  // 已批准
  | 'approval.denied'   // 已拒绝
  | 'tool.call'         // 工具调用
  | 'tool.result'       // 工具结果
  | 'message.user'      // 用户消息
  | 'message.assistant' // AI 消息
  | 'system.notification'; // 系统通知

interface EventPayload {
  // 通用字段
  title?: string;
  description?: string;
  message?: string;
  
  // 任务相关
  taskId?: string;
  progress?: number;
  
  // 审批相关
  action?: string;
  toolName?: string;
  parameters?: Record<string, any>;
  
  // 工具相关
  toolCallId?: string;
  result?: any;
  error?: string;
  
  // 消息相关
  content?: string;
  role?: 'user' | 'assistant' | 'system';
  
  // 原始数据 (保留以便调试)
  raw?: any;
}

interface SessionInfo {
  id: string;
  name?: string;
  workDir?: string;
  startedAt: number;
  metadata?: Record<string, any>;
}
```

### 2. 统一命令模型

```typescript
// 手机端发送的命令
interface UnifiedCommand {
  id: string;
  timestamp: number;
  target: string;          // 目标适配器
  
  type: CommandType;
  payload: CommandPayload;
}

type CommandType =
  | 'approval.respond'     // 响应审批
  | 'task.cancel'          // 取消任务
  | 'message.send'         // 发送消息
  | 'session.list'         // 列出会话
  | 'session.switch'       // 切换会话
  | 'system.ping'          // 心跳
  | 'system.config';       // 配置更新

interface CommandPayload {
  // 审批响应
  requestId?: string;
  decision?: 'approve' | 'deny' | 'approve_once';
  feedback?: string;
  
  // 消息
  message?: string;
  
  // 会话
  sessionId?: string;
  
  // 配置
  config?: Record<string, any>;
}
```

### 3. 适配器接口

```typescript
interface AIAdapter {
  // 元数据
  readonly name: string;
  readonly version: string;
  readonly supportedEvents: EventType[];
  readonly supportedCommands: CommandType[];
  
  // 生命周期
  initialize(config: AdapterConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // 事件处理
  onEvent(callback: (event: UnifiedEvent) => void): void;
  
  // 命令处理
  sendCommand(command: UnifiedCommand): Promise<void>;
  
  // 状态
  getStatus(): AdapterStatus;
}

interface AdapterConfig {
  // 通用配置
  userId: string;
  deviceName: string;
  
  // 工具特定配置
  toolConfig: {
    // Kimi CLI
    kimiPath?: string;
    configPath?: string;
    
    // Codex CLI
    openaiApiKey?: string;
    codexPath?: string;
    
    // Claude Code
    anthropicApiKey?: string;
    claudePath?: string;
    
    // 其他...
  };
  
  // 推送服务配置
  pushServiceUrl: string;
}

type AdapterStatus = 
  | 'initializing'
  | 'connected'
  | 'disconnected'
  | 'error';
```

## 实现架构

### 目录结构

```
kimi-remote-control/
├── hub/                          # 核心 Hub（原 push-service）
│   ├── src/
│   │   ├── core/                # 核心逻辑
│   │   │   ├── EventBus.ts      # 事件总线
│   │   │   ├── ProtocolRouter.ts # 协议路由
│   │   │   └── DeviceManager.ts # 设备管理
│   │   ├── adapters/            # 适配器管理
│   │   │   ├── AdapterRegistry.ts
│   │   │   ├── BaseAdapter.ts   # 适配器基类
│   │   │   └── loaders/         # 动态加载器
│   │   ├── protocols/           # 协议实现
│   │   │   ├── kimi/            # Kimi 协议
│   │   │   ├── codex/           # Codex 协议
│   │   │   ├── claude/          # Claude 协议
│   │   │   └── opencode/        # OpenCode 协议
│   │   └── index.ts
│   └── package.json
│
├── adapters/                     # 各 AI 工具的适配器
│   ├── kimi-adapter/
│   │   ├── src/
│   │   │   ├── index.ts         # 适配器入口
│   │   │   ├── KimiAdapter.ts   # 适配器实现
│   │   │   ├── protocol/        # Kimi 协议解析
│   │   │   └── hooks/           # Hook 实现
│   │   └── package.json
│   │
│   ├── codex-adapter/
│   │   ├── src/
│   │   │   ├── CodexAdapter.ts
│   │   │   └── protocol/
│   │   └── package.json
│   │
│   ├── claude-adapter/
│   │   └── ...
│   │
│   └── adapter-sdk/             # 适配器开发 SDK
│       ├── src/
│       │   ├── BaseAdapter.ts   # 基类
│       │   ├── types.ts         # 类型定义
│       │   ├── transformers.ts  # 转换工具
│       │   └── utils.ts         # 工具函数
│       └── package.json
│
├── mobile-client/               # 手机客户端
│   └── ...
│
└── docs/
    ├── adapter-development.md   # 适配器开发指南
    └── protocol-spec.md         # 协议规范
```

## 协议转换示例

### Kimi → 统一事件

```typescript
// Kimi 原始事件
const kimiEvent = {
  type: "TurnEnd",
  payload: {
    session_id: "sess-123",
    status: "completed"
  }
};

// 转换为统一事件
const unifiedEvent: UnifiedEvent = {
  id: generateId(),
  timestamp: Date.now(),
  source: "kimi",
  version: "1.0",
  type: "task.complete",
  payload: {
    title: "任务完成",
    description: "AI 已完成当前任务",
    taskId: kimiEvent.payload.session_id,
    raw: kimiEvent
  },
  session: {
    id: kimiEvent.payload.session_id,
    startedAt: Date.now()
  }
};
```

### Codex → 统一事件

```typescript
// Codex 原始事件
const codexEvent = {
  type: "approval_request",
  tool: "file_write",
  params: { path: "/tmp/test.txt", content: "..." }
};

// 转换为统一事件
const unifiedEvent: UnifiedEvent = {
  id: generateId(),
  timestamp: Date.now(),
  source: "codex",
  version: "1.0",
  type: "approval.request",
  payload: {
    title: "需要确认",
    description: `写入文件: ${codexEvent.params.path}`,
    action: codexEvent.tool,
    toolName: codexEvent.tool,
    parameters: codexEvent.params,
    raw: codexEvent
  },
  session: {
    id: "codex-session",
    startedAt: Date.now()
  }
};
```

## 配置示例

### 单工具配置

```yaml
# config.yaml
hub:
  port: 8080
  ws_port: 8081
  
adapters:
  - name: kimi
    enabled: true
    config:
      kimiPath: "/usr/local/bin/kimi"
      configPath: "~/.config/kimi"
      
  - name: codex
    enabled: false
    config:
      apiKey: "${OPENAI_API_KEY}"
```

### 多工具并行

```yaml
adapters:
  - name: kimi
    enabled: true
    config:
      workDir: "~/projects/project-a"
      
  - name: codex
    enabled: true
    config:
      workDir: "~/projects/project-b"
      
  - name: claude
    enabled: true
    config:
      workDir: "~/projects/project-c"
```

## 扩展性设计

### 添加新适配器的步骤

1. **创建适配器项目**
```bash
npm create ai-adapter@latest my-adapter
cd my-adapter
```

2. **实现适配器接口**
```typescript
import { BaseAdapter } from '@ai-remote/adapter-sdk';

export class MyAdapter extends BaseAdapter {
  name = 'my-tool';
  version = '1.0.0';
  
  async initialize(config: AdapterConfig): Promise<void> {
    // 初始化你的 AI 工具连接
  }
  
  protected async translateEvent(rawEvent: any): Promise<UnifiedEvent> {
    // 将原始事件转换为统一格式
  }
  
  protected async executeCommand(command: UnifiedCommand): Promise<void> {
    // 执行命令
  }
}
```

3. **注册到 Hub**
```bash
# 安装适配器
npm install ai-adapter-my-tool

# 在配置中启用
ai-remote adapter enable my-tool
```

## 技术选型建议

| 组件 | 技术 | 理由 |
|------|------|------|
| Hub | Node.js + TypeScript | 生态丰富，适合协议转换 |
| 适配器 | Node.js / Python | 根据 AI 工具选择 |
| 协议 | WebSocket + JSON | 简单通用 |
| 配置 | YAML/JSON | 易于维护 |
| 插件系统 | NPM packages | 标准生态 |

## 下一步

1. 重构现有代码为适配器架构
2. 实现 Codex 适配器
3. 实现 Claude Code 适配器
4. 编写适配器 SDK
5. 建立适配器仓库
