"use strict";
/**
 * Apple Push Notification Service (APNs) 推送服务
 *
 * 用于 iOS 设备推送
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APNsService = void 0;
const https_1 = __importDefault(require("https"));
const PushService_1 = require("./PushService");
class APNsService extends PushService_1.BasePushService {
    constructor(config) {
        super(config);
        this.jwt = null;
        this.jwtExpiry = 0;
        if (!config.apns) {
            throw new Error('APNs config required');
        }
    }
    async initialize() {
        console.log('[APNs] Initializing...');
        await this.refreshJWT();
        console.log('[APNs] Initialized');
    }
    /**
     * 生成 JWT
     */
    async refreshJWT() {
        const { keyId, teamId, privateKey } = this.config.apns;
        const now = Math.floor(Date.now() / 1000);
        const header = Buffer.from(JSON.stringify({
            alg: 'ES256',
            kid: keyId,
        })).toString('base64url');
        const claims = Buffer.from(JSON.stringify({
            iss: teamId,
            iat: now,
            exp: now + 3600,
        })).toString('base64url');
        // 注意：这里需要 crypto 签名
        // 实际使用请安装: npm install jsonwebtoken
        this.jwt = `${header}.${claims}.signature`;
        this.jwtExpiry = now + 3600;
    }
    /**
     * 确保 JWT 有效
     */
    async ensureJWT() {
        const now = Math.floor(Date.now() / 1000);
        if (!this.jwt || now >= this.jwtExpiry - 60) {
            await this.refreshJWT();
        }
        return this.jwt;
    }
    /**
     * 获取 APNs 主机
     */
    getHost() {
        return this.config.apns.production
            ? 'api.push.apple.com'
            : 'api.sandbox.push.apple.com';
    }
    /**
     * 发送推送
     */
    async send(device, notification) {
        try {
            const jwt = await this.ensureJWT();
            const { bundleId } = this.config.apns;
            const payload = {
                aps: {
                    alert: {
                        title: notification.title,
                        body: notification.body,
                    },
                    badge: notification.badge,
                    sound: notification.sound || 'default',
                    'content-available': 1,
                },
                ...notification.data,
            };
            return await new Promise((resolve) => {
                const req = https_1.default.request({
                    hostname: this.getHost(),
                    port: 443,
                    path: `/3/device/${device.token}`,
                    method: 'POST',
                    headers: {
                        'authorization': `bearer ${jwt}`,
                        'apns-topic': bundleId,
                        'apns-priority': notification.priority === 'high' ? '10' : '5',
                        'content-type': 'application/json',
                    },
                }, (res) => {
                    if (res.statusCode === 200) {
                        console.log(`[APNs] Sent to ${device.deviceId}`);
                        resolve(true);
                    }
                    else {
                        console.error(`[APNs] Failed: ${res.statusCode}`);
                        resolve(false);
                    }
                });
                req.on('error', (err) => {
                    console.error('[APNs] Request error:', err);
                    resolve(false);
                });
                req.write(JSON.stringify(payload));
                req.end();
            });
        }
        catch (err) {
            console.error('[APNs] Send error:', err);
            return false;
        }
    }
    async sendToUser(userId, notification) {
        return 0;
    }
    async registerDevice(device) {
        console.log(`[APNs] Device registered: ${device.deviceId}`);
    }
    async unregisterDevice(deviceId) {
        console.log(`[APNs] Device unregistered: ${deviceId}`);
    }
}
exports.APNsService = APNsService;
