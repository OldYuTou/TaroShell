"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAdapter = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const ws_1 = __importDefault(require("ws"));
/**
 * 适配器基类
 * 所有 AI 工具适配器都应该继承这个类
 */
class BaseAdapter extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.config = null;
        this.status = 'disconnected';
        this.ws = null;
        this.reconnectTimer = null;
        this.pingTimer = null;
        this.eventCallbacks = [];
        // 会话管理
        this.sessions = new Map();
        this.currentSessionId = null;
    }
    // ============ 生命周期 ============
    async initialize(config) {
        this.config = config;
        this.status = 'initializing';
        await this.onInitialize();
    }
    async start() {
        if (!this.config) {
            throw new Error('Adapter not initialized');
        }
        await this.connectToHub();
    }
    async stop() {
        this.clearTimers();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.status = 'disconnected';
        await this.onStop();
    }
    // ============ 事件处理 ============
    onEvent(callback) {
        if (!this.eventCallbacks.includes(callback)) {
            this.eventCallbacks.push(callback);
        }
    }
    offEvent(callback) {
        const index = this.eventCallbacks.indexOf(callback);
        if (index > -1) {
            this.eventCallbacks.splice(index, 1);
        }
    }
    emitEvent(event) {
        // 本地回调
        for (const callback of this.eventCallbacks) {
            try {
                callback(event);
            }
            catch (err) {
                console.error('Event callback error:', err);
            }
        }
        // 发送到 Hub
        this.sendToHub({
            type: 'event',
            timestamp: Date.now(),
            payload: event,
        });
    }
    // ============ 命令处理 ============
    async sendCommand(command) {
        await this.onCommand(command);
    }
    async handleCommandFromHub(command) {
        // 检查是否支持该命令
        if (!this.supportedCommands.includes(command.type)) {
            console.warn(`Command ${command.type} not supported by ${this.name}`);
            return;
        }
        await this.onCommand(command);
    }
    // ============ 状态获取 ============
    getStatus() {
        return this.status;
    }
    getConfig() {
        return this.config;
    }
    // ============ 工具方法 ============
    /**
     * 创建统一事件
     */
    createEvent(type, payload, sessionId) {
        const session = sessionId
            ? this.sessions.get(sessionId) || this.createSession(sessionId)
            : this.getOrCreateDefaultSession();
        return {
            id: (0, uuid_1.v4)(),
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
    sendEvent(type, payload, sessionId) {
        const event = this.createEvent(type, payload, sessionId);
        this.emitEvent(event);
    }
    /**
     * 获取或创建默认会话
     */
    getOrCreateDefaultSession() {
        if (!this.currentSessionId) {
            this.currentSessionId = `session-${Date.now()}`;
        }
        return this.createSession(this.currentSessionId);
    }
    /**
     * 创建会话
     */
    createSession(id, name, workDir) {
        const session = {
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
    createCommand(type, payload) {
        return {
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
            target: this.name,
            type,
            payload,
        };
    }
    // ============ WebSocket 连接 ============
    async connectToHub() {
        if (!this.config)
            return;
        const wsUrl = this.config.hubUrl;
        try {
            this.ws = new ws_1.default(wsUrl);
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
        }
        catch (err) {
            console.error('Failed to connect to hub:', err);
            this.scheduleReconnect();
        }
    }
    onHubConnected() {
        console.log(`[${this.name}] Connected to hub`);
        this.status = 'connected';
        // 发送注册消息
        const registerMsg = {
            type: 'register',
            payload: {
                adapterName: this.name,
                adapterVersion: this.version,
                userId: this.config.userId,
                deviceName: this.config.deviceName,
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
    onHubDisconnected() {
        console.log(`[${this.name}] Disconnected from hub`);
        this.status = 'disconnected';
        this.clearTimers();
        this.scheduleReconnect();
        this.onHubDisconnect();
    }
    onHubMessage(data) {
        try {
            const message = JSON.parse(data);
            switch (message.type) {
                case 'pong':
                    // 心跳响应
                    break;
                case 'command':
                    // 收到命令
                    if (message.payload) {
                        this.handleCommandFromHub(message.payload);
                    }
                    break;
                case 'error':
                    console.error('Hub error:', message.payload);
                    break;
            }
        }
        catch (err) {
            console.error('Failed to parse hub message:', err);
        }
    }
    sendToHub(message) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    startPing() {
        this.pingTimer = setInterval(() => {
            this.sendToHub({ type: 'ping', timestamp: Date.now() });
        }, 30000);
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectToHub();
        }, 5000);
    }
    clearTimers() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
exports.BaseAdapter = BaseAdapter;
