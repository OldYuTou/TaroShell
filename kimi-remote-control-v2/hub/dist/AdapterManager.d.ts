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
export declare class AdapterManager extends EventEmitter {
    private adapters;
    private userAdapters;
    registerAdapter(info: Omit<AdapterInfo, 'connectedAt' | 'lastPing'>): AdapterInfo;
    unregisterAdapter(adapterId: string): void;
    getAdapter(adapterId: string): AdapterInfo | undefined;
    getUserAdapters(userId: string): AdapterInfo[];
    getAllAdapters(): AdapterInfo[];
    forwardEventToUser(userId: string, event: UnifiedEvent, excludeAdapterId?: string): void;
    forwardCommandToAdapter(adapterId: string, command: UnifiedCommand): boolean;
    sendToAdapter(adapterId: string, message: any): boolean;
    sendToUser(userId: string, message: any, filter?: (adapter: AdapterInfo) => boolean): number;
    updatePing(adapterId: string): void;
    cleanupStaleAdapters(maxAgeMs?: number): string[];
    private isMobileClient;
    getStats(): {
        total: number;
        byUser: Record<string, number>;
    };
}
