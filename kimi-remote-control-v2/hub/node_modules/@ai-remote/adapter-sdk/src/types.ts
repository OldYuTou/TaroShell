/**
 * AI Remote Control - 统一类型定义
 * 所有适配器共享的类型系统
 */

// ============ 事件类型 ============

export type EventType = 
  | 'task.start'
  | 'task.progress'
  | 'task.complete'
  | 'task.error'
  | 'approval.request'
  | 'approval.granted'
  | 'approval.denied'
  | 'tool.call'
  | 'tool.result'
  | 'message.user'
  | 'message.assistant'
  | 'system.notification';

export interface EventPayload {
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
  
  // 原始数据
  raw?: any;
}

export interface SessionInfo {
  id: string;
  name?: string;
  workDir?: string;
  startedAt: number;
  metadata?: Record<string, any>;
}

export interface UnifiedEvent {
  id: string;
  timestamp: number;
  source: string;           // 适配器名称: "kimi", "codex", "claude"...
  version: string;          // 适配器版本
  type: EventType;
  payload: EventPayload;
  session: SessionInfo;
}

// ============ 命令类型 ============

export type CommandType =
  | 'approval.respond'
  | 'task.cancel'
  | 'message.send'
  | 'session.list'
  | 'session.switch'
  | 'system.ping'
  | 'system.config';

export interface CommandPayload {
  // 审批响应
  requestId?: string;
  decision?: 'approve' | 'deny' | 'approve_once' | 'approve_session';
  feedback?: string;
  
  // 消息
  message?: string;
  
  // 会话
  sessionId?: string;
  
  // 配置
  config?: Record<string, any>;
}

export interface UnifiedCommand {
  id: string;
  timestamp: number;
  target: string;           // 目标适配器
  type: CommandType;
  payload: CommandPayload;
}

// ============ 适配器接口 ============

export type AdapterStatus = 
  | 'initializing'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface ToolConfig {
  // Kimi CLI
  kimiPath?: string;
  configPath?: string;
  
  // Codex CLI
  openaiApiKey?: string;
  codexPath?: string;
  
  // Claude Code
  anthropicApiKey?: string;
  claudePath?: string;
  
  // 通用
  workDir?: string;
  env?: Record<string, string>;
  
  // 其他工具特定配置
  [key: string]: any;
}

export interface AdapterConfig {
  // 通用配置
  userId: string;
  deviceName: string;
  
  // 工具特定配置
  toolConfig: ToolConfig;
  
  // Hub 连接配置
  hubUrl: string;
}

export type EventCallback = (event: UnifiedEvent) => void;

export interface IAdapter {
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
  onEvent(callback: EventCallback): void;
  offEvent(callback: EventCallback): void;
  
  // 命令处理
  sendCommand(command: UnifiedCommand): Promise<void>;
  
  // 状态
  getStatus(): AdapterStatus;
  getConfig(): AdapterConfig | null;
}

// ============ 协议消息 ============

export interface HubMessage {
  type: 'register' | 'event' | 'command' | 'ping' | 'pong' | 'error';
  timestamp?: number;
  payload?: any;
}

export interface RegisterMessage extends HubMessage {
  type: 'register';
  payload: {
    adapterName: string;
    adapterVersion: string;
    userId: string;
    deviceName: string;
    supportedEvents: EventType[];
    supportedCommands: CommandType[];
  };
}

export interface EventMessage extends HubMessage {
  type: 'event';
  payload: UnifiedEvent;
}

export interface CommandMessage extends HubMessage {
  type: 'command';
  payload: UnifiedCommand;
}
