/**
 * 推送服务集成
 *
 * 支持：
 * - Firebase Cloud Messaging (FCM) - Android
 * - Apple Push Notification Service (APNs) - iOS
 * - 本地通知 - 备用方案
 */
import { UnifiedEvent } from '../index';
export interface PushNotification {
    title: string;
    body: string;
    data?: Record<string, any>;
    priority?: 'high' | 'normal' | 'low';
    badge?: number;
    sound?: string;
}
export interface PushDevice {
    token: string;
    platform: 'ios' | 'android' | 'web';
    userId: string;
    deviceId: string;
}
export interface PushServiceConfig {
    fcm?: {
        projectId: string;
        privateKey: string;
        clientEmail: string;
    };
    apns?: {
        keyId: string;
        teamId: string;
        privateKey: string;
        bundleId: string;
        production?: boolean;
    };
    enabled: boolean;
}
/**
 * 推送服务基类
 */
export declare abstract class BasePushService {
    protected config: PushServiceConfig;
    constructor(config: PushServiceConfig);
    abstract initialize(): Promise<void>;
    abstract send(device: PushDevice, notification: PushNotification): Promise<boolean>;
    abstract sendToUser(userId: string, notification: PushNotification): Promise<number>;
    abstract registerDevice(device: PushDevice): Promise<void>;
    abstract unregisterDevice(deviceId: string): Promise<void>;
    /**
     * 将统一事件转换为推送通知
     */
    protected eventToNotification(event: UnifiedEvent): PushNotification;
    private getEventPriority;
    /**
     * 发送事件推送
     */
    sendEvent(device: PushDevice, event: UnifiedEvent): Promise<boolean>;
}
/**
 * 多平台推送服务管理器
 */
export declare class PushServiceManager {
    private services;
    private devices;
    private userDevices;
    /**
     * 注册推送服务
     */
    register(name: string, service: BasePushService): void;
    /**
     * 初始化所有服务
     */
    initialize(): Promise<void>;
    /**
     * 注册设备
     */
    registerDevice(device: PushDevice): Promise<void>;
    /**
     * 注销设备
     */
    unregisterDevice(deviceId: string): Promise<void>;
    /**
     * 发送给指定设备
     */
    sendToDevice(deviceId: string, notification: PushNotification): Promise<boolean>;
    /**
     * 发送给用户的所有设备
     */
    sendToUser(userId: string, notification: PushNotification): Promise<number>;
    /**
     * 发送事件给用户的所有设备
     */
    sendEventToUser(userId: string, event: UnifiedEvent): Promise<number>;
    /**
     * 获取用户的设备列表
     */
    getUserDevices(userId: string): PushDevice[];
    /**
     * 将统一事件转换为推送通知
     */
    private eventToNotification;
    private getEventPriority;
}
export declare const pushManager: PushServiceManager;
