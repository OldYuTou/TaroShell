/**
 * Kimi Code CLI Adapter
 * 
 * 使用方法:
 * ```bash
 * npm install
 * npm run build
 * npm start
 * ```
 * 
 * 环境变量:
 * - HUB_URL: 推送服务地址 (默认: ws://localhost:8081)
 * - USER_ID: 用户ID
 * - KIMI_PATH: Kimi CLI 路径
 * - WORK_DIR: 工作目录
 */

import { KimiAdapter } from './KimiAdapter';

async function main() {
  const adapter = new KimiAdapter();
  
  // 从环境变量读取配置
  const config = {
    userId: process.env.USER_ID || 'default_user',
    deviceName: process.env.DEVICE_NAME || 'Kimi Desktop',
    hubUrl: process.env.HUB_URL || 'ws://localhost:8081',
    toolConfig: {
      kimiPath: process.env.KIMI_PATH,
      workDir: process.env.WORK_DIR,
    },
  };
  
  // 初始化
  await adapter.initialize(config);
  
  // 启动
  await adapter.start();
  
  // 优雅退出
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await adapter.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await adapter.stop();
    process.exit(0);
  });
  
  console.log('[KimiAdapter] Running. Press Ctrl+C to exit.');
}

main().catch(console.error);

export { KimiAdapter };
