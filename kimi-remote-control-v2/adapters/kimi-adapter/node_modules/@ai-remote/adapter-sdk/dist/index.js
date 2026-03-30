"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FullFeatureAdapter = exports.retry = exports.delay = exports.generateId = exports.formatEvent = exports.getEventPriority = exports.isImportantEvent = exports.BaseAdapter = void 0;
// 类型导出
__exportStar(require("./types"), exports);
// 基类导出
var BaseAdapter_1 = require("./BaseAdapter");
Object.defineProperty(exports, "BaseAdapter", { enumerable: true, get: function () { return BaseAdapter_1.BaseAdapter; } });
// 工具函数导出
var utils_1 = require("./utils");
Object.defineProperty(exports, "isImportantEvent", { enumerable: true, get: function () { return utils_1.isImportantEvent; } });
Object.defineProperty(exports, "getEventPriority", { enumerable: true, get: function () { return utils_1.getEventPriority; } });
Object.defineProperty(exports, "formatEvent", { enumerable: true, get: function () { return utils_1.formatEvent; } });
Object.defineProperty(exports, "generateId", { enumerable: true, get: function () { return utils_1.generateId; } });
Object.defineProperty(exports, "delay", { enumerable: true, get: function () { return utils_1.delay; } });
Object.defineProperty(exports, "retry", { enumerable: true, get: function () { return utils_1.retry; } });
// 推送服务导出
__exportStar(require("./push"), exports);
// 协议导出
__exportStar(require("./protocol"), exports);
// 完整功能适配器
var FullFeatureAdapter_1 = require("./FullFeatureAdapter");
Object.defineProperty(exports, "FullFeatureAdapter", { enumerable: true, get: function () { return FullFeatureAdapter_1.FullFeatureAdapter; } });
