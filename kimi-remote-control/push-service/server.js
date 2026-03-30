/**
 * Kimi Code 远程控制推送服务
 * 
 * 功能：
 * 1. 接收 Kimi CLI 的 WebSocket 连接（电脑端）
 * 2. 接收手机客户端的 WebSocket 连接
 * 3. 消息转发和推送通知（FCM/APNs）
 */

const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

// ============ 配置 ============
const PORT = process.env.PORT || 8080;
const WS_PORT = process.env.WS_PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ============ 存储 ============
const clients = new Map(); // deviceId -> {ws, type, userId, lastPing}
const userDevices = new Map(); // userId -> Set<deviceId>

// ============ Express HTTP 服务器 ============
const app = express();
app.use(cors());
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connections: clients.size,
    timestamp: new Date().toISOString()
  });
});

// 获取在线设备列表
app.get('/api/devices/:userId', (req, res) => {
  const { userId } = req.params;
  const devices = [];
  const deviceSet = userDevices.get(userId);
  
  if (deviceSet) {
    for (const deviceId of deviceSet) {
      const client = clients.get(deviceId);
      if (client) {
        devices.push({
          deviceId,
          type: client.type,
          connectedAt: client.connectedAt,
          lastPing: client.lastPing
        });
      }
    }
  }
  
  res.json({ devices });
});

// 发送推送通知（HTTP API）
app.post('/api/push/:userId', (req, res) => {
  const { userId } = req.params;
  const { title, body, data = {} } = req.body;
  
  const result = sendPushToUser(userId, { title, body, data });
  res.json({ success: true, sent: result.sent });
});

// ============ WebSocket 服务器 ============
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws, req) => {
  const deviceId = uuidv4();
  console.log(`[WS] New connection: ${deviceId}`);
  
  // 存储连接信息
  clients.set(deviceId, {
    ws,
    type: 'unknown',
    userId: null,
    deviceInfo: null,
    connectedAt: new Date(),
    lastPing: Date.now()
  });
  
  // 发送连接成功消息
  sendToClient(deviceId, {
    type: 'connected',
    deviceId,
    message: 'Connected to Kimi Push Service'
  });
  
  // 消息处理
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(deviceId, message);
    } catch (err) {
      console.error('[WS] Invalid message:', err.message);
      sendToClient(deviceId, { type: 'error', message: 'Invalid JSON' });
    }
  });
  
  // 断开连接
  ws.on('close', () => {
    handleDisconnect(deviceId);
  });
  
  // 错误处理
  ws.on('error', (err) => {
    console.error(`[WS] Error for ${deviceId}:`, err.message);
  });
});

// ============ 消息处理 ============
function handleMessage(deviceId, message) {
  const client = clients.get(deviceId);
  if (!client) return;
  
  // 更新最后活动时间
  client.lastPing = Date.now();
  
  switch (message.type) {
    // 客户端注册
    case 'register':
      handleRegister(deviceId, message);
      break;
      
    // 心跳
    case 'ping':
      sendToClient(deviceId, { type: 'pong', timestamp: Date.now() });
      break;
      
    // Kimi 事件转发
    case 'kimi_event':
      handleKimiEvent(deviceId, message);
      break;
      
    // 手机客户端请求
    case 'mobile_request':
      handleMobileRequest(deviceId, message);
      break;
      
    // 审批响应
    case 'approval_response':
      handleApprovalResponse(deviceId, message);
      break;
      
    default:
      console.log(`[WS] Unknown message type: ${message.type}`);
  }
}

// 注册客户端
function handleRegister(deviceId, message) {
  const { clientType, userId, deviceInfo, token } = message;
  const client = clients.get(deviceId);
  
  if (!client) return;
  
  // TODO: 验证 token
  
  client.type = clientType; // 'kimi' 或 'mobile'
  client.userId = userId;
  client.deviceInfo = deviceInfo;
  
  // 添加到用户设备列表
  if (!userDevices.has(userId)) {
    userDevices.set(userId, new Set());
  }
  userDevices.get(userId).add(deviceId);
  
  console.log(`[WS] Registered: ${clientType} (${deviceId}) for user ${userId}`);
  
  sendToClient(deviceId, {
    type: 'registered',
    deviceId,
    clientType,
    userId
  });
  
  // 通知其他设备（多端同步）
  notifyOtherDevices(userId, deviceId, {
    type: 'device_online',
    deviceId,
    clientType,
    deviceInfo
  });
}

// 处理 Kimi 事件
function handleKimiEvent(deviceId, message) {
  const client = clients.get(deviceId);
  if (!client || client.type !== 'kimi') {
    sendToClient(deviceId, { type: 'error', message: 'Not authorized as Kimi client' });
    return;
  }
  
  const { event, sessionId, payload } = message;
  const userId = client.userId;
  
  console.log(`[Kimi] Event: ${event} from session ${sessionId}`);
  
  // 关键事件：发送推送到手机
  if (['TurnEnd', 'ApprovalRequest', 'StepInterrupted'].includes(event)) {
    const pushData = {
      title: getEventTitle(event),
      body: getEventBody(event, payload),
      data: {
        type: 'kimi_event',
        event,
        sessionId,
        payload,
        timestamp: Date.now()
      }
    };
    
    // 发送给用户的所有手机设备
    sendPushToUser(userId, pushData);
  }
  
  // 转发给手机客户端（实时同步）
  forwardToMobileClients(userId, {
    type: 'kimi_event',
    event,
    sessionId,
    payload,
    timestamp: Date.now()
  });
}

// 处理手机客户端请求
function handleMobileRequest(deviceId, message) {
  const client = clients.get(deviceId);
  if (!client || client.type !== 'mobile') {
    sendToClient(deviceId, { type: 'error', message: 'Not authorized as mobile client' });
    return;
  }
  
  const { action, targetDeviceId, data } = message;
  const userId = client.userId;
  
  console.log(`[Mobile] Request: ${action} from ${deviceId}`);
  
  switch (action) {
    case 'list_sessions':
      // 转发给 Kimi 客户端
      forwardToKimiClients(userId, {
        type: 'mobile_request',
        action: 'list_sessions',
        requestId: message.requestId
      });
      break;
      
    case 'send_message':
      // 转发消息到 Kimi
      forwardToKimiClients(userId, {
        type: 'mobile_request',
        action: 'send_message',
        sessionId: message.sessionId,
        message: message.message,
        requestId: message.requestId
      });
      break;
      
    case 'cancel_task':
      forwardToKimiClients(userId, {
        type: 'mobile_request',
        action: 'cancel_task',
        sessionId: message.sessionId,
        requestId: message.requestId
      });
      break;
      
    default:
      sendToClient(deviceId, { type: 'error', message: `Unknown action: ${action}` });
  }
}

// 处理审批响应
function handleApprovalResponse(deviceId, message) {
  const client = clients.get(deviceId);
  if (!client || client.type !== 'mobile') return;
  
  const { requestId, response, feedback } = message;
  const userId = client.userId;
  
  console.log(`[Mobile] Approval response: ${response} for ${requestId}`);
  
  // 转发给 Kimi 客户端
  forwardToKimiClients(userId, {
    type: 'approval_response',
    requestId,
    response,
    feedback
  });
}

// ============ 工具函数 ============

function sendToClient(deviceId, message) {
  const client = clients.get(deviceId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

function sendPushToUser(userId, pushData) {
  const deviceSet = userDevices.get(userId);
  if (!deviceSet) return { sent: 0 };
  
  let sent = 0;
  for (const deviceId of deviceSet) {
    const client = clients.get(deviceId);
    if (client && client.type === 'mobile') {
      // 发送推送消息
      if (sendToClient(deviceId, {
        type: 'push',
        ...pushData
      })) {
        sent++;
      }
    }
  }
  
  // TODO: 集成 FCM/APNs 发送离线推送
  
  return { sent };
}

function forwardToMobileClients(userId, message) {
  const deviceSet = userDevices.get(userId);
  if (!deviceSet) return;
  
  for (const deviceId of deviceSet) {
    const client = clients.get(deviceId);
    if (client && client.type === 'mobile') {
      sendToClient(deviceId, message);
    }
  }
}

function forwardToKimiClients(userId, message) {
  const deviceSet = userDevices.get(userId);
  if (!deviceSet) return;
  
  for (const deviceId of deviceSet) {
    const client = clients.get(deviceId);
    if (client && client.type === 'kimi') {
      sendToClient(deviceId, message);
    }
  }
}

function notifyOtherDevices(userId, excludeDeviceId, message) {
  const deviceSet = userDevices.get(userId);
  if (!deviceSet) return;
  
  for (const deviceId of deviceSet) {
    if (deviceId !== excludeDeviceId) {
      sendToClient(deviceId, message);
    }
  }
}

function handleDisconnect(deviceId) {
  const client = clients.get(deviceId);
  if (!client) return;
  
  console.log(`[WS] Disconnected: ${deviceId}`);
  
  // 从用户设备列表中移除
  if (client.userId) {
    const deviceSet = userDevices.get(client.userId);
    if (deviceSet) {
      deviceSet.delete(deviceId);
      
      // 通知其他设备
      notifyOtherDevices(client.userId, deviceId, {
        type: 'device_offline',
        deviceId,
        clientType: client.type
      });
    }
  }
  
  clients.delete(deviceId);
}

// 事件标题映射
function getEventTitle(event) {
  const titles = {
    'TurnEnd': 'Kimi 任务完成',
    'ApprovalRequest': '需要您的确认',
    'StepInterrupted': '任务被中断'
  };
  return titles[event] || 'Kimi 通知';
}

// 事件内容生成
function getEventBody(event, payload) {
  switch (event) {
    case 'TurnEnd':
      return 'AI 已完成当前任务';
    case 'ApprovalRequest':
      return `操作: ${payload?.action || '未知操作'}`;
    case 'StepInterrupted':
      return '任务执行被中断';
    default:
      return JSON.stringify(payload).slice(0, 100);
  }
}

// ============ 心跳清理 ============
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 60秒无响应断开
  
  for (const [deviceId, client] of clients) {
    if (now - client.lastPing > timeout) {
      console.log(`[WS] Timeout: ${deviceId}`);
      client.ws.close();
      handleDisconnect(deviceId);
    }
  }
}, 30000);

// ============ 启动 ============
app.listen(PORT, () => {
  console.log(`[HTTP] Server running on port ${PORT}`);
});

console.log(`[WS] WebSocket server running on port ${WS_PORT}`);
console.log(`[Config] JWT_SECRET: ${JWT_SECRET === 'your-secret-key-change-in-production' ? 'DEFAULT (change in production!)' : 'Set'}`);
