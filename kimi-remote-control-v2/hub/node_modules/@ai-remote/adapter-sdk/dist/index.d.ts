/**
 * AI Remote Control Adapter SDK
 *
 * 使用方式:
 * ```typescript
 * import { BaseAdapter, UnifiedEvent, EventType } from '@ai-remote/adapter-sdk';
 *
 * class MyAdapter extends BaseAdapter {
 *   name = 'my-tool';
 *   version = '1.0.0';
 *   supportedEvents = ['task.complete', 'approval.request'];
 *   supportedCommands = ['approval.respond'];
 *
 *   protected async onInitialize() {
 *     // 初始化你的 AI 工具
 *   }
 *
 *   protected onHubConnect() {
 *     // 连接成功后发送一个测试事件
 *     this.sendEvent('task.complete', {
 *       title: '适配器已连接',
 *       description: 'MyAdapter 已成功连接到 Hub'
 *     });
 *   }
 *
 *   protected async onCommand(command) {
 *     // 处理来自手机的命令
 *     if (command.type === 'approval.respond') {
 *       // 处理审批响应
 *     }
 *   }
 * }
 * ```
 */
export * from './types';
export { BaseAdapter } from './BaseAdapter';
export { isImportantEvent, getEventPriority, formatEvent, generateId, delay, retry, } from './utils';
export * from './push';
export * from './protocol';
export { FullFeatureAdapter } from './FullFeatureAdapter';
