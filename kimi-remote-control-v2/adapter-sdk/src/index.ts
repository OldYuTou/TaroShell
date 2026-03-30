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

// 类型导出
export * from './types';

// 基类导出
export { BaseAdapter } from './BaseAdapter';

// 工具函数导出
export {
  isImportantEvent,
  getEventPriority,
  formatEvent,
  generateId,
  delay,
  retry,
} from './utils';

// 推送服务导出
export * from './push';

// 协议导出
export * from './protocol';

// 完整功能适配器
export { FullFeatureAdapter } from './FullFeatureAdapter';
