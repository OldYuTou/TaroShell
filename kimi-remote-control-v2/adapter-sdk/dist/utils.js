"use strict";
/**
 * 适配器工具函数
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isImportantEvent = isImportantEvent;
exports.getEventPriority = getEventPriority;
exports.formatEvent = formatEvent;
exports.generateId = generateId;
exports.delay = delay;
exports.retry = retry;
/**
 * 判断事件是否重要（需要通知用户）
 */
function isImportantEvent(event) {
    const importantTypes = [
        'task.complete',
        'task.error',
        'approval.request',
        'system.notification',
    ];
    return importantTypes.includes(event.type);
}
/**
 * 获取事件的优先级
 */
function getEventPriority(event) {
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
 * 格式化事件为可读文本
 */
function formatEvent(event) {
    const { type, payload } = event;
    switch (type) {
        case 'task.start':
            return {
                title: payload.title || '任务开始',
                body: payload.description || '新的任务已开始',
            };
        case 'task.progress':
            return {
                title: payload.title || '任务进度',
                body: `${payload.description || '处理中'} ${payload.progress ? `(${payload.progress}%)` : ''}`,
            };
        case 'task.complete':
            return {
                title: payload.title || '任务完成',
                body: payload.description || 'AI 已完成当前任务',
            };
        case 'task.error':
            return {
                title: payload.title || '任务出错',
                body: payload.error || payload.description || '执行过程中发生错误',
            };
        case 'approval.request':
            return {
                title: payload.title || '需要确认',
                body: payload.description || `操作: ${payload.action || '未知操作'}`,
            };
        case 'tool.call':
            return {
                title: payload.title || '工具调用',
                body: `${payload.toolName || '未知工具'} 被调用`,
            };
        case 'tool.result':
            return {
                title: payload.title || '工具结果',
                body: payload.error
                    ? `错误: ${payload.error}`
                    : payload.description || '工具执行完成',
            };
        default:
            return {
                title: payload.title || '通知',
                body: payload.description || payload.message || '',
            };
    }
}
/**
 * 生成唯一 ID
 */
function generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * 延迟函数
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 重试函数
 */
async function retry(fn, options = {}) {
    const { retries = 3, delay: delayMs = 1000 } = options;
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            if (i < retries - 1) {
                await delay(delayMs * (i + 1));
            }
        }
    }
    throw lastError;
}
