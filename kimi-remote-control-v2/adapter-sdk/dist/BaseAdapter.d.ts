import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { IAdapter, AdapterConfig, AdapterStatus, UnifiedEvent, UnifiedCommand, EventCallback, EventType, CommandType, SessionInfo, EventPayload } from './types';
/**
 * 适配器基类
 * 所有 AI 工具适配器都应该继承这个类
 */
export declare abstract class BaseAdapter extends EventEmitter implements IAdapter {
    abstract readonly name: string;
    abstract readonly version: string;
    abstract readonly supportedEvents: EventType[];
    abstract readonly supportedCommands: CommandType[];
    protected config: AdapterConfig | null;
    protected status: AdapterStatus;
    protected ws: WebSocket | null;
    protected reconnectTimer: NodeJS.Timeout | null;
    protected pingTimer: NodeJS.Timeout | null;
    protected eventCallbacks: EventCallback[];
    protected sessions: Map<string, SessionInfo>;
    protected currentSessionId: string | null;
    initialize(config: AdapterConfig): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    onEvent(callback: EventCallback): void;
    offEvent(callback: EventCallback): void;
    protected emitEvent(event: UnifiedEvent): void;
    sendCommand(command: UnifiedCommand): Promise<void>;
    protected handleCommandFromHub(command: UnifiedCommand): Promise<void>;
    getStatus(): AdapterStatus;
    getConfig(): AdapterConfig | null;
    /**
     * 创建统一事件
     */
    protected createEvent(type: EventType, payload: EventPayload, sessionId?: string): UnifiedEvent;
    /**
     * 发送事件到 Hub
     */
    protected sendEvent(type: EventType, payload: EventPayload, sessionId?: string): void;
    /**
     * 获取或创建默认会话
     */
    protected getOrCreateDefaultSession(): SessionInfo;
    /**
     * 创建会话
     */
    protected createSession(id: string, name?: string, workDir?: string): SessionInfo;
    /**
     * 生成命令
     */
    protected createCommand(type: CommandType, payload: CommandPayload): UnifiedCommand;
    private connectToHub;
    private onHubConnected;
    private onHubDisconnected;
    private onHubMessage;
    private sendToHub;
    private startPing;
    private scheduleReconnect;
    private clearTimers;
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
