import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

import {
  IAdapter,
  AdapterConfig,
  AdapterStatus,
  UnifiedEvent,
  UnifiedCommand,
  EventCallback,
  EventType,
  CommandType,
  SessionInfo,
  EventPayload,
  HubMessage,
  RegisterMessage,
  EventMessage,
} from './types';

/**
 * 适配器基类
 * 所有 AI 工具适配器都应该继承这个类
 */
export abstract class BaseAdapter extends EventEmitter implements IAdapter {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly supportedEvents: EventType[];
  abstract readonly supportedCommands: CommandType[];
  
  protected config: AdapterConfig | null = null;
  protected status: AdapterStatus = 'disconnected';
  protected ws: WebSocket | null = null;
  protected reconnectTimer: NodeJS.Timeout | null = null;
  protected pingTimer: NodeJS.Timeout | null = null;
  protected eventCallbacks: EventCallback[] = [];
  
  // 会话管理
  protected sessions: Map<string, SessionInfo> = new Map();
  protected currentSessionId: string | null = null;
  
  // ============ 生命周期 ============
  
  async initialize(config: AdapterConfig): Promise<void> {
    this.config = config;
    this.status = 'initializing';
    await this.onInitialize();
  }
  
  async start(): Promise<void> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }
    
    await this.connectToHub();
  }
  
  async stop(): Promise<void> {
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.status = 'disconnected';
    await this.onStop();
  }
  
  // ============ 事件处理 ============
  
  onEvent(callback: EventCallback): void {
    if (!this.eventCallbacks.includes(callback)) {
      this.eventCallbacks.push(callback);
    }
  }
  
  offEvent(callback: EventCallback): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }
  
  protected emitEvent(event: UnifiedEvent): void {
    // 本地回调
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error('Event callback error:', err);
      }
    }
    
    // 发送到 Hub
    this.sendToHub({
      type: 'event',
      timestamp: Date.now(),
      payload: event,
    } as EventMessage);
  }
  
  // ============ 命令处理 ============
  
  async sendCommand(command: UnifiedCommand): Promise<void> {
    await this.onCommand(command);
  }
  
  protected async handleCommandFromHub(command: UnifiedCommand): Promise<void> {
    // 检查是否支持该命令
    if (!this.supportedCommands.includes(command.type)) {
      console.warn(`Command ${command.type} not supported by ${this.name}`);
      return;
    }
    
    await this.onCommand(command);
  }
  
  // ============ 状态获取 ============
  
  getStatus(): AdapterStatus {
    return this.status;
  }
  
  getConfig(): AdapterConfig | null {
    return this.config;
  }
  
  // ============ 工具方法 ============
  
  /**
   * 创建统一事件
   */
  protected createEvent(
    type: EventType,
    payload: EventPayload,
    sessionId?: string
  ): UnifiedEvent {
    const session = sessionId 
      ? this.sessions.get(sessionId) || this.createSession(sessionId)
      : this.getOrCreateDefaultSession();
      
    return {
      id: uuidv4(),
      timestamp: Date.now(),
      source: this.name,
      version: this.version,
      type,
      payload,
      session,
    };
  }
  
  /**
   * 发送事件到 Hub
   */
  protected sendEvent(type: EventType, payload: EventPayload, sessionId?: string): void {
    const event = this.createEvent(type, payload, sessionId);
    this.emitEvent(event);
  }
  
  /**
   * 获取或创建默认会话
   */
  protected getOrCreateDefaultSession(): SessionInfo {
    if (!this.currentSessionId) {
      this.currentSessionId = `session-${Date.now()}`;
    }
    return this.createSession(this.currentSessionId);
  }
  
  /**
   * 创建会话
   */
  protected createSession(id: string, name?: string, workDir?: string): SessionInfo {
    const session: SessionInfo = {
      id,
      name: name || id,
      workDir: workDir || this.config?.toolConfig.workDir,
      startedAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }
  
  /**
   * 生成命令
   */
  protected createCommand(type: CommandType, payload: CommandPayload): UnifiedCommand {
    return {
      id: uuidv4(),
      timestamp: Date.now(),
      target: this.name,
      type,
      payload,
    };
  }
  
  // ============ WebSocket 连接 ============
  
  private async connectToHub(): Promise<void> {
    if (!this.config) return;
    
    const wsUrl = this.config.hubUrl;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        this.onHubConnected();
      });
      
      this.ws.on('message', (data) => {
        this.onHubMessage(data.toString());
      });
      
      this.ws.on('close', () => {
        this.onHubDisconnected();
      });
      
      this.ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        this.status = 'error';
      });
      
    } catch (err) {
      console.error('Failed to connect to hub:', err);
      this.scheduleReconnect();
    }
  }
  
  private onHubConnected(): void {
    console.log(`[${this.name}] Connected to hub`);
    this.status = 'connected';
    
    // 发送注册消息
    const registerMsg: RegisterMessage = {
      type: 'register',
      payload: {
        adapterName: this.name,
        adapterVersion: this.version,
        userId: this.config!.userId,
        deviceName: this.config!.deviceName,
        supportedEvents: this.supportedEvents,
        supportedCommands: this.supportedCommands,
      },
    };
    
    this.sendToHub(registerMsg);
    
    // 启动心跳
    this.startPing();
    
    // 通知子类
    this.onHubConnect();
  }
  
  private onHubDisconnected(): void {
    console.log(`[${this.name}] Disconnected from hub`);
    this.status = 'disconnected';
    this.clearTimers();
    this.scheduleReconnect();
    this.onHubDisconnect();
  }
  
  private onHubMessage(data: string): void {
    try {
      const message: HubMessage = JSON.parse(data);
      
      switch (message.type) {
        case 'pong':
          // 心跳响应
          break;
          
        case 'command':
          // 收到命令
          if (message.payload) {
            this.handleCommandFromHub(message.payload as UnifiedCommand);
          }
          break;
          
        case 'error':
          console.error('Hub error:', message.payload);
          break;
      }
    } catch (err) {
      console.error('Failed to parse hub message:', err);
    }
  }
  
  private sendToHub(message: HubMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.sendToHub({ type: 'ping', timestamp: Date.now() });
    }, 30000);
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectToHub();
    }, 5000);
  }
  
  private clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  // ============ 抽象方法 - 子类实现 ============
  
  /**
   * 初始化时调用
   */
  protected abstract onInitialize(): Promise<void>;
  
  /**
   * 停止时调用
   */
  protected abstract onStop(): Promise<void>;
  
  /**
   * 连接到 Hub 后调用
   */
  protected abstract onHubConnect(): void;
  
  /**
   * 从 Hub 断开时调用
   */
  protected abstract onHubDisconnect(): void;
  
  /**
   * 收到命令时调用
   */
  protected abstract onCommand(command: UnifiedCommand): Promise<void>;
}
