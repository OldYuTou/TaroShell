"use strict";
/**
 * AI Remote Control Hub Server
 *
 * 核心功能：
 * 1. 管理适配器连接
 * 2. 转发事件和命令
 * 3. 提供 HTTP API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HubServer = void 0;
const events_1 = require("events");
const ws_1 = __importDefault(require("ws"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const uuid_1 = require("uuid");
const adapter_sdk_1 = require("@ai-remote/adapter-sdk");
const AdapterManager_1 = require("./AdapterManager");
class HubServer extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.wsServer = null;
        this.timers = [];
        this.options = {
            httpPort: 8080,
            wsPort: 8081,
            heartbeatInterval: 30000,
            cleanupInterval: 60000,
            ...options,
        };
        this.adapterManager = new AdapterManager_1.AdapterManager();
        this.setupAdapterEvents();
        this.setupPushService();
    }
    /**
     * 设置推送服务
     */
    setupPushService() {
        // 从环境变量读取配置
        const fcmEnabled = process.env.FCM_ENABLED === 'true';
        const apnsEnabled = process.env.APNS_ENABLED === 'true';
        if (fcmEnabled && process.env.FCM_PROJECT_ID) {
            adapter_sdk_1.pushManager.register('fcm', new adapter_sdk_1.FCMService({
                enabled: true,
                fcm: {
                    projectId: process.env.FCM_PROJECT_ID,
                    privateKey: process.env.FCM_PRIVATE_KEY || '',
                    clientEmail: process.env.FCM_CLIENT_EMAIL || '',
                },
            }));
        }
        if (apnsEnabled && process.env.APNS_KEY_ID) {
            adapter_sdk_1.pushManager.register('apns', new adapter_sdk_1.APNsService({
                enabled: true,
                apns: {
                    keyId: process.env.APNS_KEY_ID,
                    teamId: process.env.APNS_TEAM_ID || '',
                    privateKey: process.env.APNS_PRIVATE_KEY || '',
                    bundleId: process.env.APNS_BUNDLE_ID || '',
                    production: process.env.APNS_PRODUCTION === 'true',
                },
            }));
        }
    }
    // ============ 启动/停止 ============
    async start() {
        // 初始化推送服务
        await adapter_sdk_1.pushManager.initialize();
        // 启动 HTTP 服务器
        await this.startHttpServer();
        // 启动 WebSocket 服务器
        await this.startWebSocketServer();
        // 启动定时任务
        this.startTimers();
        console.log(`[Hub] Server started`);
        console.log(`  HTTP: http://localhost:${this.options.httpPort}`);
        console.log(`  WebSocket: ws://localhost:${this.options.wsPort}`);
    }
    async stop() {
        // 停止定时任务
        this.timers.forEach(timer => clearInterval(timer));
        this.timers = [];
        // 关闭 WebSocket 服务器
        if (this.wsServer) {
            this.wsServer.close();
            this.wsServer = null;
        }
        // 关闭 HTTP 服务器
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
        }
        console.log('[Hub] Server stopped');
    }
    // ============ HTTP 服务器 ============
    async startHttpServer() {
        const app = (0, express_1.default)();
        app.use((0, cors_1.default)());
        app.use(express_1.default.json());
        // 健康检查
        app.get('/health', (req, res) => {
            const stats = this.adapterManager.getStats();
            res.json({
                status: 'ok',
                adapters: stats.total,
                timestamp: new Date().toISOString(),
            });
        });
        // 获取用户的适配器列表
        app.get('/api/adapters/:userId', (req, res) => {
            const { userId } = req.params;
            const adapters = this.adapterManager.getUserAdapters(userId);
            res.json({
                adapters: adapters.map(a => ({
                    id: a.id,
                    name: a.name,
                    version: a.version,
                    deviceName: a.deviceName,
                    supportedEvents: a.supportedEvents,
                    supportedCommands: a.supportedCommands,
                    connectedAt: a.connectedAt,
                    lastPing: a.lastPing,
                })),
            });
        });
        // 发送推送通知
        app.post('/api/push/:userId', (req, res) => {
            const { userId } = req.params;
            const { title, body, data } = req.body;
            // 创建统一事件
            const event = {
                id: (0, uuid_1.v4)(),
                timestamp: Date.now(),
                source: 'hub',
                version: '1.0',
                type: 'system.notification',
                payload: {
                    title,
                    description: body,
                    ...data,
                },
                session: {
                    id: 'hub',
                    startedAt: Date.now(),
                },
            };
            // 发送给用户的所有手机客户端
            const sent = this.adapterManager.sendToUser(userId, { type: 'push', payload: event }, adapter => this.isMobileClient(adapter));
            res.json({ success: true, sent });
        });
        // 发送命令到指定适配器
        app.post('/api/command/:adapterId', (req, res) => {
            const { adapterId } = req.params;
            const command = {
                id: (0, uuid_1.v4)(),
                timestamp: Date.now(),
                target: req.body.target || 'unknown',
                type: req.body.type,
                payload: req.body.payload || {},
            };
            const success = this.adapterManager.forwardCommandToAdapter(adapterId, command);
            res.json({ success });
        });
        // 获取统计信息
        app.get('/api/stats', (req, res) => {
            const stats = this.adapterManager.getStats();
            res.json(stats);
        });
        // 注册推送设备
        app.post('/api/push/register', async (req, res) => {
            const { userId, deviceId, token, platform } = req.body;
            try {
                await adapter_sdk_1.pushManager.registerDevice({
                    token,
                    platform,
                    userId,
                    deviceId,
                });
                res.json({ success: true });
            }
            catch (err) {
                res.status(500).json({ success: false, error: String(err) });
            }
        });
        // 注销推送设备
        app.post('/api/push/unregister', async (req, res) => {
            const { deviceId } = req.body;
            try {
                await adapter_sdk_1.pushManager.unregisterDevice(deviceId);
                res.json({ success: true });
            }
            catch (err) {
                res.status(500).json({ success: false, error: String(err) });
            }
        });
        return new Promise((resolve) => {
            this.httpServer = app.listen(this.options.httpPort, () => {
                resolve();
            });
        });
    }
    // ============ WebSocket 服务器 ============
    async startWebSocketServer() {
        this.wsServer = new ws_1.default.Server({ port: this.options.wsPort });
        this.wsServer.on('connection', (socket, req) => {
            const clientId = (0, uuid_1.v4)();
            console.log(`[Hub] WebSocket connection: ${clientId}`);
            let adapterInfo = null;
            socket.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleWebSocketMessage(clientId, socket, message, adapterInfo);
                }
                catch (err) {
                    console.error(`[Hub] Invalid message from ${clientId}:`, err);
                    socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
                }
            });
            socket.on('close', () => {
                console.log(`[Hub] WebSocket closed: ${clientId}`);
                if (adapterInfo) {
                    this.adapterManager.unregisterAdapter(adapterInfo.id);
                }
            });
            socket.on('error', (err) => {
                console.error(`[Hub] WebSocket error ${clientId}:`, err);
            });
            // 发送连接确认
            socket.send(JSON.stringify({
                type: 'connected',
                clientId,
                message: 'Connected to AI Remote Hub',
            }));
        });
    }
    handleWebSocketMessage(clientId, socket, message, adapterInfo) {
        const msgType = message.type;
        switch (msgType) {
            case 'register':
                // 注册适配器
                try {
                    const registerPayload = message.payload || {};
                    adapterInfo = this.adapterManager.registerAdapter({
                        id: clientId,
                        name: registerPayload.adapterName || 'unknown',
                        version: registerPayload.adapterVersion || '1.0.0',
                        userId: registerPayload.userId || 'default_user',
                        deviceName: registerPayload.deviceName || 'Unknown Device',
                        supportedEvents: registerPayload.supportedEvents || [],
                        supportedCommands: registerPayload.supportedCommands || [],
                        socket,
                    });
                    console.log(`[Hub] Adapter registered: ${adapterInfo.name} (${clientId}) for user ${adapterInfo.userId}`);
                    // 发送注册确认
                    socket.send(JSON.stringify({
                        type: 'registered',
                        adapterId: clientId,
                        adapterName: adapterInfo.name,
                    }));
                }
                catch (err) {
                    console.error(`[Hub] Register error:`, err);
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Registration failed: ' + String(err),
                    }));
                }
                break;
            case 'event':
                // 收到适配器的事件
                if (adapterInfo) {
                    this.adapterManager.updatePing(adapterInfo.id);
                    const event = message.payload;
                    // 转发给用户的其他设备（WebSocket）
                    this.adapterManager.forwardEventToUser(adapterInfo.userId, event, adapterInfo.id);
                    // 发送离线推送（FCM/APNs）
                    this.sendPushNotification(adapterInfo.userId, event);
                    this.emit('event', event, adapterInfo);
                }
                break;
            case 'command':
                // 收到命令（通常是手机客户端发送）
                if (adapterInfo) {
                    this.adapterManager.updatePing(adapterInfo.id);
                    const command = message.payload;
                    // 转发给目标适配器
                    const targetAdapters = this.adapterManager
                        .getUserAdapters(adapterInfo.userId)
                        .filter(a => a.name === command.target);
                    for (const target of targetAdapters) {
                        this.adapterManager.forwardCommandToAdapter(target.id, command);
                    }
                    this.emit('command', command, adapterInfo);
                }
                break;
            case 'ping':
                // 心跳
                if (adapterInfo) {
                    this.adapterManager.updatePing(adapterInfo.id);
                }
                socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
            default:
                console.log(`[Hub] Unknown message type: ${msgType}`);
        }
    }
    // ============ 定时任务 ============
    startTimers() {
        // 清理不活跃的适配器
        const cleanupTimer = setInterval(() => {
            const stale = this.adapterManager.cleanupStaleAdapters(120000);
            if (stale.length > 0) {
                console.log(`[Hub] Cleaned up ${stale.length} stale adapters`);
            }
        }, this.options.cleanupInterval);
        this.timers.push(cleanupTimer);
    }
    // ============ 事件处理 ============
    setupAdapterEvents() {
        this.adapterManager.on('adapter:connected', (adapter) => {
            this.emit('adapter:connected', adapter);
        });
        this.adapterManager.on('adapter:disconnected', (adapter) => {
            this.emit('adapter:disconnected', adapter);
        });
    }
    // ============ 推送通知 ============
    /**
     * 发送推送通知
     */
    async sendPushNotification(userId, event) {
        try {
            // 只推送重要事件
            const importantTypes = ['task.complete', 'task.error', 'approval.request'];
            if (!importantTypes.includes(event.type)) {
                return;
            }
            const sent = await adapter_sdk_1.pushManager.sendEventToUser(userId, event);
            if (sent > 0) {
                console.log(`[Hub] Push sent to ${sent} devices for user ${userId}`);
            }
        }
        catch (err) {
            console.error('[Hub] Push error:', err);
        }
    }
    // ============ 辅助方法 ============
    isMobileClient(adapter) {
        const name = adapter.deviceName.toLowerCase();
        return name.includes('mobile') ||
            name.includes('phone') ||
            name.includes('ios') ||
            name.includes('android');
    }
    // ============ 公共 API ============
    getAdapterManager() {
        return this.adapterManager;
    }
    getPushManager() {
        return adapter_sdk_1.pushManager;
    }
}
exports.HubServer = HubServer;
