/**
 * 适配器管理器
 * 
 * 管理所有连接到 Hub 的适配器
 */

import { EventEmitter } from 'events';
import { UnifiedEvent, UnifiedCommand } from '@ai-remote/adapter-sdk';

export interface AdapterInfo {
  id: string;
  name: string;
  version: string;
  userId: string;
  deviceName: string;
  supportedEvents: string[];
  supportedCommands: string[];
  connectedAt: Date;
  lastPing: Date;
  socket: any;
}

export class AdapterManager extends EventEmitter {
  private adapters: Map<string, AdapterInfo> = new Map();
  private userAdapters: Map<string, Set<string>> = new Map();
  
  // ============ 适配器注册 ============
  
  registerAdapter(info: Omit<AdapterInfo, 'connectedAt' | 'lastPing'>): AdapterInfo {
    const adapter: AdapterInfo = {
      ...info,
      connectedAt: new Date(),
      lastPing: new Date(),
    };
    
    this.adapters.set(info.id, adapter);
    
    // 添加到用户索引
    if (!this.userAdapters.has(info.userId)) {
      this.userAdapters.set(info.userId, new Set());
    }
    this.userAdapters.get(info.userId)!.add(info.id);
    
    console.log(`[Hub] Adapter registered: ${info.name} (${info.id}) for user ${info.userId}`);
    
    this.emit('adapter:connected', adapter);
    
    return adapter;
  }
  
  unregisterAdapter(adapterId: string): void {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) return;
    
    // 从用户索引中移除
    const userSet = this.userAdapters.get(adapter.userId);
    if (userSet) {
      userSet.delete(adapterId);
      if (userSet.size === 0) {
        this.userAdapters.delete(adapter.userId);
      }
    }
    
    this.adapters.delete(adapterId);
    
    console.log(`[Hub] Adapter unregistered: ${adapter.name} (${adapterId})`);
    
    this.emit('adapter:disconnected', adapter);
  }
  
  // ============ 查询 ============
  
  getAdapter(adapterId: string): AdapterInfo | undefined {
    return this.adapters.get(adapterId);
  }
  
  getUserAdapters(userId: string): AdapterInfo[] {
    const ids = this.userAdapters.get(userId);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.adapters.get(id))
      .filter((a): a is AdapterInfo => a !== undefined);
  }
  
  getAllAdapters(): AdapterInfo[] {
    return Array.from(this.adapters.values());
  }
  
  // ============ 事件转发 ============
  
  forwardEventToUser(userId: string, event: UnifiedEvent, excludeAdapterId?: string): void {
    const userAdapters = this.getUserAdapters(userId);
    
    for (const adapter of userAdapters) {
      // 跳过排除的适配器
      if (excludeAdapterId && adapter.id === excludeAdapterId) continue;
      
      // 只转发给手机客户端
      if (this.isMobileClient(adapter)) {
        this.sendToAdapter(adapter.id, {
          type: 'event',
          payload: event,
        });
      }
    }
  }
  
  forwardCommandToAdapter(adapterId: string, command: UnifiedCommand): boolean {
    return this.sendToAdapter(adapterId, {
      type: 'command',
      payload: command,
    });
  }
  
  // ============ 消息发送 ============
  
  sendToAdapter(adapterId: string, message: any): boolean {
    const adapter = this.adapters.get(adapterId);
    if (!adapter || adapter.socket.readyState !== 1) {
      return false;
    }
    
    try {
      adapter.socket.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error(`[Hub] Failed to send to ${adapterId}:`, err);
      return false;
    }
  }
  
  sendToUser(userId: string, message: any, filter?: (adapter: AdapterInfo) => boolean): number {
    const adapters = this.getUserAdapters(userId);
    let sent = 0;
    
    for (const adapter of adapters) {
      if (filter && !filter(adapter)) continue;
      
      if (this.sendToAdapter(adapter.id, message)) {
        sent++;
      }
    }
    
    return sent;
  }
  
  // ============ 心跳管理 ============
  
  updatePing(adapterId: string): void {
    const adapter = this.adapters.get(adapterId);
    if (adapter) {
      adapter.lastPing = new Date();
    }
  }
  
  cleanupStaleAdapters(maxAgeMs: number = 60000): string[] {
    const now = Date.now();
    const staleIds: string[] = [];
    
    for (const [id, adapter] of this.adapters) {
      if (now - adapter.lastPing.getTime() > maxAgeMs) {
        staleIds.push(id);
      }
    }
    
    for (const id of staleIds) {
      const adapter = this.adapters.get(id);
      if (adapter) {
        adapter.socket.close();
        this.unregisterAdapter(id);
      }
    }
    
    return staleIds;
  }
  
  // ============ 辅助方法 ============
  
  private isMobileClient(adapter: AdapterInfo): boolean {
    // 根据设备名称或其他特征判断
    return adapter.deviceName.toLowerCase().includes('mobile') ||
           adapter.deviceName.toLowerCase().includes('phone') ||
           adapter.deviceName.toLowerCase().includes('ios') ||
           adapter.deviceName.toLowerCase().includes('android');
  }
  
  getStats(): { total: number; byUser: Record<string, number> } {
    const byUser: Record<string, number> = {};
    
    for (const [userId, ids] of this.userAdapters) {
      byUser[userId] = ids.size;
    }
    
    return {
      total: this.adapters.size,
      byUser,
    };
  }
}
