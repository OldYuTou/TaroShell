/**
 * Apple Push Notification Service (APNs) 推送服务
 *
 * 用于 iOS 设备推送
 */
import { BasePushService, PushDevice, PushNotification, PushServiceConfig } from './PushService';
export interface APNsConfig {
    keyId: string;
    teamId: string;
    privateKey: string;
    bundleId: string;
    production?: boolean;
}
export declare class APNsService extends BasePushService {
    private jwt;
    private jwtExpiry;
    constructor(config: PushServiceConfig);
    initialize(): Promise<void>;
    /**
     * 生成 JWT
     */
    private refreshJWT;
    /**
     * 确保 JWT 有效
     */
    private ensureJWT;
    /**
     * 获取 APNs 主机
     */
    private getHost;
    /**
     * 发送推送
     */
    send(device: PushDevice, notification: PushNotification): Promise<boolean>;
    sendToUser(userId: string, notification: PushNotification): Promise<number>;
    registerDevice(device: PushDevice): Promise<void>;
    unregisterDevice(deviceId: string): Promise<void>;
}
