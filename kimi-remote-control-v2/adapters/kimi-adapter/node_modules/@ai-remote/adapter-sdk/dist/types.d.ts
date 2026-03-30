/**
 * AI Remote Control - 统一类型定义
 * 所有适配器共享的类型系统
 */
export type EventType = 'task.start' | 'task.progress' | 'task.complete' | 'task.error' | 'approval.request' | 'approval.granted' | 'approval.denied' | 'tool.call' | 'tool.result' | 'message.user' | 'message.assistant' | 'system.notification';
export interface EventPayload {
    title?: string;
    description?: string;
    message?: string;
    taskId?: string;
    progress?: number;
    action?: string;
    toolName?: string;
    parameters?: Record<string, any>;
    toolCallId?: string;
    result?: any;
    error?: string;
    content?: string;
    role?: 'user' | 'assistant' | 'system';
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
    source: string;
    version: string;
    type: EventType;
    payload: EventPayload;
    session: SessionInfo;
}
export type CommandType = 'approval.respond' | 'task.cancel' | 'message.send' | 'session.list' | 'session.switch' | 'system.ping' | 'system.config';
export interface CommandPayload {
    requestId?: string;
    decision?: 'approve' | 'deny' | 'approve_once' | 'approve_session';
    feedback?: string;
    message?: string;
    sessionId?: string;
    config?: Record<string, any>;
}
export interface UnifiedCommand {
    id: string;
    timestamp: number;
    target: string;
    type: CommandType;
    payload: CommandPayload;
}
export type AdapterStatus = 'initializing' | 'connected' | 'disconnected' | 'error';
export interface ToolConfig {
    kimiPath?: string;
    configPath?: string;
    openaiApiKey?: string;
    codexPath?: string;
    anthropicApiKey?: string;
    claudePath?: string;
    workDir?: string;
    env?: Record<string, string>;
    [key: string]: any;
}
export interface AdapterConfig {
    userId: string;
    deviceName: string;
    toolConfig: ToolConfig;
    hubUrl: string;
}
export type EventCallback = (event: UnifiedEvent) => void;
export interface IAdapter {
    readonly name: string;
    readonly version: string;
    readonly supportedEvents: EventType[];
    readonly supportedCommands: CommandType[];
    initialize(config: AdapterConfig): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    onEvent(callback: EventCallback): void;
    offEvent(callback: EventCallback): void;
    sendCommand(command: UnifiedCommand): Promise<void>;
    getStatus(): AdapterStatus;
    getConfig(): AdapterConfig | null;
}
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
