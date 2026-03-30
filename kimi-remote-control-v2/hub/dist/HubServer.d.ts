/**
 * AI Remote Control Hub Server
 *
 * 核心功能：
 * 1. 管理适配器连接
 * 2. 转发事件和命令
 * 3. 提供 HTTP API
 */
import { EventEmitter } from 'events';
import { AdapterManager } from './AdapterManager';
interface HubOptions {
    httpPort: number;
    wsPort: number;
    heartbeatInterval?: number;
    cleanupInterval?: number;
}
export declare class HubServer extends EventEmitter {
    private adapterManager;
    private httpServer;
    private wsServer;
    private options;
    private timers;
    constructor(options?: Partial<HubOptions>);
    /**
     * 设置推送服务
     */
    private setupPushService;
    start(): Promise<void>;
    stop(): Promise<void>;
    private startHttpServer;
    private startWebSocketServer;
    private handleWebSocketMessage;
    private startTimers;
    private setupAdapterEvents;
    /**
     * 发送推送通知
     */
    private sendPushNotification;
    private isMobileClient;
    getAdapterManager(): AdapterManager;
    getPushManager(): any;
}
export {};
