/**
 * Firebase Cloud Messaging (FCM) 推送服务
 *
 * 用于 Android 设备推送
 */
import { BasePushService, PushDevice, PushNotification, PushServiceConfig } from './PushService';
export interface FCMConfig {
    projectId: string;
    privateKey: string;
    clientEmail: string;
}
export declare class FCMService extends BasePushService {
    private accessToken;
    private tokenExpiry;
    constructor(config: PushServiceConfig);
    initialize(): Promise<void>;
    /**
     * 获取 OAuth2 Access Token
     */
    private refreshAccessToken;
    /**
     * 创建 JWT
     */
    private createJWT;
    /**
     * 确保 token 有效
     */
    private ensureToken;
    /**
     * 发送推送
     */
    send(device: PushDevice, notification: PushNotification): Promise<boolean>;
    /**
     * 发送给用户（FCM 支持多设备批量发送，但这里简化处理）
     */
    sendToUser(userId: string, notification: PushNotification): Promise<number>;
    registerDevice(device: PushDevice): Promise<void>;
    unregisterDevice(deviceId: string): Promise<void>;
}
