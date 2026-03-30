/**
 * Apple Push Notification Service (APNs) 推送服务
 * 
 * 用于 iOS 设备推送
 */

import https from 'https';
import { BasePushService, PushDevice, PushNotification, PushServiceConfig } from './PushService';

export interface APNsConfig {
  keyId: string;
  teamId: string;
  privateKey: string;
  bundleId: string;
  production?: boolean;
}

export class APNsService extends BasePushService {
  private jwt: string | null = null;
  private jwtExpiry: number = 0;
  
  constructor(config: PushServiceConfig) {
    super(config);
    if (!config.apns) {
      throw new Error('APNs config required');
    }
  }
  
  async initialize(): Promise<void> {
    console.log('[APNs] Initializing...');
    await this.refreshJWT();
    console.log('[APNs] Initialized');
  }
  
  /**
   * 生成 JWT
   */
  private async refreshJWT(): Promise<void> {
    const { keyId, teamId, privateKey } = this.config.apns!;
    
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
  private async ensureJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (!this.jwt || now >= this.jwtExpiry - 60) {
      await this.refreshJWT();
    }
    return this.jwt!;
  }
  
  /**
   * 获取 APNs 主机
   */
  private getHost(): string {
    return this.config.apns!.production 
      ? 'api.push.apple.com' 
      : 'api.sandbox.push.apple.com';
  }
  
  /**
   * 发送推送
   */
  async send(device: PushDevice, notification: PushNotification): Promise<boolean> {
    try {
      const jwt = await this.ensureJWT();
      const { bundleId } = this.config.apns!;
      
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
        const req = https.request({
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
          } else {
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
      
    } catch (err) {
      console.error('[APNs] Send error:', err);
      return false;
    }
  }
  
  async sendToUser(userId: string, notification: PushNotification): Promise<number> {
    return 0;
  }
  
  async registerDevice(device: PushDevice): Promise<void> {
    console.log(`[APNs] Device registered: ${device.deviceId}`);
  }
  
  async unregisterDevice(deviceId: string): Promise<void> {
    console.log(`[APNs] Device unregistered: ${deviceId}`);
  }
}
