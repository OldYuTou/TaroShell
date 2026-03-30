/**
 * 推送服务集成
 * 
 * 支持：
 * - Firebase Cloud Messaging (FCM) - Android
 * - Apple Push Notification Service (APNs) - iOS
 * - 本地通知 - 备用方案
 */

import { UnifiedEvent, formatEvent } from '../index';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
  badge?: number;
  sound?: string;
}

export interface PushDevice {
  token: string;           // FCM token 或 APNs device token
  platform: 'ios' | 'android' | 'web';
  userId: string;
  deviceId: string;
}

export interface PushServiceConfig {
  // FCM 配置
  fcm?: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
  };
  
  // APNs 配置
  apns?: {
    keyId: string;
    teamId: string;
    privateKey: string;
    bundleId: string;
    production?: boolean;
  };
  
  // 通用配置
  enabled: boolean;
}

/**
 * 推送服务基类
 */
export abstract class BasePushService {
  protected config: PushServiceConfig;
  
  constructor(config: PushServiceConfig) {
    this.config = config;
  }
  
  abstract initialize(): Promise<void>;
  abstract send(device: PushDevice, notification: PushNotification): Promise<boolean>;
  abstract sendToUser(userId: string, notification: PushNotification): Promise<number>;
  abstract registerDevice(device: PushDevice): Promise<void>;
  abstract unregisterDevice(deviceId: string): Promise<void>;
  
  /**
   * 将统一事件转换为推送通知
   */
  protected eventToNotification(event: UnifiedEvent): PushNotification {
    const formatted = formatEvent(event);
    
    return {
      title: formatted.title,
      body: formatted.body,
      data: {
        eventId: event.id,
        eventType: event.type,
        source: event.source,
        sessionId: event.session.id,
        timestamp: event.timestamp,
        raw: event.payload.raw,
      },
      priority: this.getEventPriority(event),
      sound: event.type === 'approval.request' ? 'alert' : 'default',
    };
  }
  
  private getEventPriority(event: UnifiedEvent): 'high' | 'normal' | 'low' {
    switch (event.type) {
      case 'approval.request':
        return 'high';
      case 'task.complete':
      case 'task.error':
        return 'normal';
      default:
        return 'low';
    }
  }
  
  /**
   * 发送事件推送
   */
  async sendEvent(device: PushDevice, event: UnifiedEvent): Promise<boolean> {
    const notification = this.eventToNotification(event);
    return this.send(device, notification);
  }
}

/**
 * 多平台推送服务管理器
 */
export class PushServiceManager {
  private services: Map<string, BasePushService> = new Map();
  private devices: Map<string, PushDevice> = new Map();
  private userDevices: Map<string, Set<string>> = new Map();
  
  /**
   * 注册推送服务
   */
  register(name: string, service: BasePushService): void {
    this.services.set(name, service);
    console.log(`[PushService] Registered: ${name}`);
  }
  
  /**
   * 初始化所有服务
   */
  async initialize(): Promise<void> {
    for (const [name, service] of this.services) {
      try {
        await service.initialize();
        console.log(`[PushService] Initialized: ${name}`);
      } catch (err) {
        console.error(`[PushService] Failed to initialize ${name}:`, err);
      }
    }
  }
  
  /**
   * 注册设备
   */
  async registerDevice(device: PushDevice): Promise<void> {
    this.devices.set(device.deviceId, device);
    
    // 添加到用户索引
    if (!this.userDevices.has(device.userId)) {
      this.userDevices.set(device.userId, new Set());
    }
    this.userDevices.get(device.userId)!.add(device.deviceId);
    
    // 注册到对应平台服务
    const serviceName = device.platform === 'ios' ? 'apns' : 'fcm';
    const service = this.services.get(serviceName);
    if (service) {
      await service.registerDevice(device);
    }
    
    console.log(`[PushService] Device registered: ${device.deviceId} (${device.platform})`);
  }
  
  /**
   * 注销设备
   */
  async unregisterDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;
    
    // 从用户索引中移除
    const userSet = this.userDevices.get(device.userId);
    if (userSet) {
      userSet.delete(deviceId);
      if (userSet.size === 0) {
        this.userDevices.delete(device.userId);
      }
    }
    
    // 从平台服务注销
    const serviceName = device.platform === 'ios' ? 'apns' : 'fcm';
    const service = this.services.get(serviceName);
    if (service) {
      await service.unregisterDevice(deviceId);
    }
    
    this.devices.delete(deviceId);
    console.log(`[PushService] Device unregistered: ${deviceId}`);
  }
  
  /**
   * 发送给指定设备
   */
  async sendToDevice(deviceId: string, notification: PushNotification): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    
    const serviceName = device.platform === 'ios' ? 'apns' : 'fcm';
    const service = this.services.get(serviceName);
    if (!service) return false;
    
    return service.send(device, notification);
  }
  
  /**
   * 发送给用户的所有设备
   */
  async sendToUser(userId: string, notification: PushNotification): Promise<number> {
    const deviceSet = this.userDevices.get(userId);
    if (!deviceSet) return 0;
    
    let sent = 0;
    for (const deviceId of deviceSet) {
      const success = await this.sendToDevice(deviceId, notification);
      if (success) sent++;
    }
    
    return sent;
  }
  
  /**
   * 发送事件给用户的所有设备
   */
  async sendEventToUser(userId: string, event: UnifiedEvent): Promise<number> {
    const notification = this.eventToNotification(event);
    return this.sendToUser(userId, notification);
  }
  
  /**
   * 获取用户的设备列表
   */
  getUserDevices(userId: string): PushDevice[] {
    const deviceSet = this.userDevices.get(userId);
    if (!deviceSet) return [];
    
    return Array.from(deviceSet)
      .map(id => this.devices.get(id))
      .filter((d): d is PushDevice => d !== undefined);
  }
  
  /**
   * 将统一事件转换为推送通知
   */
  private eventToNotification(event: UnifiedEvent): PushNotification {
    const formatted = formatEvent(event);
    
    return {
      title: formatted.title,
      body: formatted.body,
      data: {
        eventId: event.id,
        eventType: event.type,
        source: event.source,
        sessionId: event.session.id,
        timestamp: event.timestamp,
      },
      priority: this.getEventPriority(event),
    };
  }
  
  private getEventPriority(event: UnifiedEvent): 'high' | 'normal' | 'low' {
    switch (event.type) {
      case 'approval.request':
        return 'high';
      case 'task.complete':
      case 'task.error':
        return 'normal';
      default:
        return 'low';
    }
  }
}

// 全局实例
export const pushManager = new PushServiceManager();
