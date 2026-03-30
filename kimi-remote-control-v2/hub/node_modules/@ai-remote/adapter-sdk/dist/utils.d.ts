/**
 * 适配器工具函数
 */
import { UnifiedEvent } from './types';
/**
 * 判断事件是否重要（需要通知用户）
 */
export declare function isImportantEvent(event: UnifiedEvent): boolean;
/**
 * 获取事件的优先级
 */
export declare function getEventPriority(event: UnifiedEvent): 'high' | 'normal' | 'low';
/**
 * 格式化事件为可读文本
 */
export declare function formatEvent(event: UnifiedEvent): {
    title: string;
    body: string;
};
/**
 * 生成唯一 ID
 */
export declare function generateId(): string;
/**
 * 延迟函数
 */
export declare function delay(ms: number): Promise<void>;
/**
 * 重试函数
 */
export declare function retry<T>(fn: () => Promise<T>, options?: {
    retries?: number;
    delay?: number;
}): Promise<T>;
