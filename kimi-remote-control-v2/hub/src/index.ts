/**
 * AI Remote Control Hub
 * 
 * 多适配器推送服务入口
 */

import { HubServer } from './HubServer';

async function main() {
  const hub = new HubServer({
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

export { HubServer };
export * from './AdapterManager';
