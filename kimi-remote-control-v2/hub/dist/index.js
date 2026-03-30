"use strict";
/**
 * AI Remote Control Hub
 *
 * 多适配器推送服务入口
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
exports.HubServer = void 0;
const HubServer_1 = require("./HubServer");
Object.defineProperty(exports, "HubServer", { enumerable: true, get: function () { return HubServer_1.HubServer; } });
async function main() {
    const hub = new HubServer_1.HubServer({
        httpPort: parseInt(process.env.HTTP_PORT || '8080'),
        wsPort: parseInt(process.env.WS_PORT || '8081'),
        heartbeatInterval: 30000,
        cleanupInterval: 60000,
    });
    // 事件监听
    hub.on('adapter:connected', (adapter) => {
        console.log(`[Hub] Adapter connected: ${adapter.name} (${adapter.deviceName})`);
    });
    hub.on('adapter:disconnected', (adapter) => {
        console.log(`[Hub] Adapter disconnected: ${adapter.name}`);
    });
    hub.on('event', (event, adapter) => {
        console.log(`[Hub] Event from ${adapter.name}: ${event.type}`);
    });
    // 启动
    await hub.start();
    // 优雅退出
    process.on('SIGINT', async () => {
        console.log('\n[Hub] Shutting down...');
        await hub.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await hub.stop();
        process.exit(0);
    });
}
main().catch(console.error);
__exportStar(require("./AdapterManager"), exports);
