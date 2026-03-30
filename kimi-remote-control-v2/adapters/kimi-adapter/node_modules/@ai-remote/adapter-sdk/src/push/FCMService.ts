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

export class FCMService extends BasePushService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  
  constructor(config: PushServiceConfig) {
    super(config);
    if (!config.fcm) {
      throw new Error('FCM config required');
    }
  }
  
  async initialize(): Promise<void> {
    console.log('[FCM] Initializing...');
    await this.refreshAccessToken();
    console.log('[FCM] Initialized');
  }
  
  /**
   * 获取 OAuth2 Access Token
   */
  private async refreshAccessToken(): Promise<void> {
    const { clientEmail, privateKey } = this.config.fcm!;
    
    // JWT 构造
    const now = Math.floor(Date.now() / 1000);
    const jwt = await this.createJWT(clientEmail, privateKey, now);
    
    // 请求 token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }
    
    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = now + data.expires_in;
  }
  
  /**
   * 创建 JWT
   */
  private async createJWT(clientEmail: string, privateKey: string, now: number): Promise<string> {
    // 简化的 JWT 实现
    // 实际生产环境建议使用 google-auth-library
    const header = Buffer.from(JSON.stringify({
      alg: 'RS256',
      typ: 'JWT',
    })).toString('base64url');
    
    const claim = Buffer.from(JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })).toString('base64url');
    
    // 注意：这里需要 crypto 库签名，简化起见
    // 实际使用请安装: npm install google-auth-library
    return `${header}.${claim}.signature`;
  }
  
  /**
   * 确保 token 有效
   */
  private async ensureToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (!this.accessToken || now >= this.tokenExpiry - 60) {
      await this.refreshAccessToken();
    }
    return this.accessToken!;
  }
  
  /**
   * 发送推送
   */
  async send(device: PushDevice, notification: PushNotification): Promise<boolean> {
    try {
      const token = await this.ensureToken();
      const { projectId } = this.config.fcm!;
      
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: device.token,
              notification: {
                title: notification.title,
                body: notification.body,
              },
              data: notification.data ? 
                Object.fromEntries(
                  Object.entries(notification.data).map(([k, v]) => [k, String(v)])
                ) : undefined,
              android: {
                priority: notification.priority === 'high' ? 'high' : 'normal',
                notification: {
                  channelId: 'kimi_remote_channel',
                  sound: notification.sound || 'default',
                },
              },
            },
          }),
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        console.error('[FCM] Send failed:', error);
        return false;
      }
      
      console.log(`[FCM] Sent to ${device.deviceId}`);
      return true;
      
    } catch (err) {
      console.error('[FCM] Send error:', err);
      return false;
    }
  }
  
  /**
   * 发送给用户（FCM 支持多设备批量发送，但这里简化处理）
   */
  async sendToUser(userId: string, notification: PushNotification): Promise<number> {
    // 实际应该通过 topic 或 condition 批量发送
    // 这里简化处理
    return 0;
  }
  
  async registerDevice(device: PushDevice): Promise<void> {
    // FCM 不需要服务器端注册，token 在客户端生成
    console.log(`[FCM] Device registered: ${device.deviceId}`);
  }
  
  async unregisterDevice(deviceId: string): Promise<void> {
    console.log(`[FCM] Device unregistered: ${deviceId}`);
  }
}
