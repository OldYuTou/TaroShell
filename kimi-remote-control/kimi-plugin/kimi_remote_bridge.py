"""
Kimi CLI 远程控制桥接插件

功能：
1. 连接到远程推送服务
2. 转发 Kimi CLI 的事件到推送服务
3. 接收手机端的控制命令

使用方法：
1. 将本文件放在 Kimi CLI 的插件目录
2. 配置 KIMI_PUSH_SERVICE_URL 环境变量
3. 启动 Kimi CLI Web 模式
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
import time
from typing import Any

import websockets
from websockets.exceptions import ConnectionClosed

# 配置
PUSH_SERVICE_URL = os.environ.get('KIMI_PUSH_SERVICE_URL', 'ws://localhost:8081')
USER_ID = os.environ.get('KIMI_REMOTE_USER_ID', 'default_user')
DEVICE_NAME = os.environ.get('KIMI_REMOTE_DEVICE_NAME', 'Kimi Desktop')

class KimiRemoteBridge:
    """Kimi CLI 远程控制桥接器"""
    
    def __init__(self):
        self.ws = None
        self.connected = False
        self.reconnect_delay = 5
        self.message_queue = asyncio.Queue()
        self.running = False
        self._lock = asyncio.Lock()
        
    async def start(self):
        """启动桥接器"""
        self.running = True
        asyncio.create_task(self._connect_loop())
        asyncio.create_task(self._send_loop())
        print(f"[KimiRemote] Bridge started, connecting to {PUSH_SERVICE_URL}")
        
    async def stop(self):
        """停止桥接器"""
        self.running = False
        if self.ws:
            await self.ws.close()
        print("[KimiRemote] Bridge stopped")
        
    async def _connect_loop(self):
        """保持连接循环"""
        while self.running:
            try:
                await self._connect()
                await self._receive_loop()
            except Exception as e:
                print(f"[KimiRemote] Connection error: {e}")
            
            self.connected = False
            print(f"[KimiRemote] Reconnecting in {self.reconnect_delay}s...")
            await asyncio.sleep(self.reconnect_delay)
            
    async def _connect(self):
        """建立 WebSocket 连接"""
        print(f"[KimiRemote] Connecting to {PUSH_SERVICE_URL}...")
        
        self.ws = await websockets.connect(PUSH_SERVICE_URL)
        self.connected = True
        
        # 发送注册消息
        await self.ws.send(json.dumps({
            'type': 'register',
            'clientType': 'kimi',
            'userId': USER_ID,
            'deviceInfo': {
                'name': DEVICE_NAME,
                'platform': 'desktop',
                'version': '1.0.0'
            }
        }))
        
        print("[KimiRemote] Connected and registered")
        
    async def _receive_loop(self):
        """接收消息循环"""
        try:
            async for message in self.ws:
                await self._handle_message(json.loads(message))
        except ConnectionClosed:
            print("[KimiRemote] Connection closed")
            
    async def _handle_message(self, message: dict[str, Any]):
        """处理来自推送服务的消息"""
        msg_type = message.get('type')
        
        if msg_type == 'registered':
            print(f"[KimiRemote] Registered: {message.get('deviceId')}")
            
        elif msg_type == 'mobile_request':
            # 手机端发来的请求
            await self._handle_mobile_request(message)
            
        elif msg_type == 'approval_response':
            # 审批响应（需要转发到 Kimi CLI）
            await self._handle_approval_response(message)
            
        elif msg_type == 'pong':
            pass  # 心跳响应
            
    async def _handle_mobile_request(self, message: dict[str, Any]):
        """处理手机端请求"""
        action = message.get('action')
        request_id = message.get('requestId')
        
        print(f"[KimiRemote] Mobile request: {action}")
        
        # 这些请求需要与 Kimi CLI 的核心交互
        # 这里提供一个框架，实际实现需要接入 Kimi CLI 的 Wire 协议
        
        response = {
            'type': 'mobile_response',
            'requestId': request_id,
            'action': action,
            'status': 'received'
        }
        
        await self._send_message(response)
        
    async def _handle_approval_response(self, message: dict[str, Any]):
        """处理审批响应"""
        print(f"[KimiRemote] Approval response: {message.get('response')}")
        # 需要将响应转发到 Kimi CLI 的审批系统
        
    async def _send_loop(self):
        """发送消息循环"""
        while self.running:
            try:
                message = await asyncio.wait_for(self.message_queue.get(), timeout=30)
                if self.connected and self.ws:
                    await self.ws.send(json.dumps(message))
            except asyncio.TimeoutError:
                # 发送心跳
                if self.connected and self.ws:
                    await self.ws.send(json.dumps({'type': 'ping'}))
                    
    async def _send_message(self, message: dict[str, Any]):
        """发送消息到队列"""
        await self.message_queue.put(message)
        
    # ============ 对外接口 ============
    
    async def send_kimi_event(self, event: str, session_id: str, payload: dict[str, Any]):
        """发送 Kimi 事件到推送服务"""
        if not self.connected:
            return
            
        await self._send_message({
            'type': 'kimi_event',
            'event': event,
            'sessionId': session_id,
            'payload': payload,
            'timestamp': time.time()
        })


# 全局实例
_bridge_instance: KimiRemoteBridge | None = None


def get_bridge() -> KimiRemoteBridge:
    """获取桥接器实例"""
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = KimiRemoteBridge()
    return _bridge_instance


# ============ Hook 集成 ============

class RemoteNotificationHook:
    """
    Kimi CLI Hook 实现
    
    在 config.toml 中配置：
    
    [[hooks]]
    event = "Stop"
    command = "python -m kimi_remote_bridge"
    """
    
    def __init__(self):
        self.bridge = get_bridge()
        
    async def on_turn_end(self, session_id: str, data: dict[str, Any]):
        """任务完成时调用"""
        await self.bridge.send_kimi_event('TurnEnd', session_id, data)
        
    async def on_approval_request(self, session_id: str, request_data: dict[str, Any]):
        """需要审批时调用"""
        await self.bridge.send_kimi_event('ApprovalRequest', session_id, request_data)


# ============ CLI 入口 ============

if __name__ == '__main__':
    import signal
    
    bridge = get_bridge()
    
    # 设置信号处理
    loop = asyncio.get_event_loop()
    
    def signal_handler():
        print("\n[KimiRemote] Shutting down...")
        asyncio.create_task(bridge.stop())
        loop.stop()
        
    signal.signal(signal.SIGINT, lambda s, f: signal_handler())
    signal.signal(signal.SIGTERM, lambda s, f: signal_handler())
    
    # 启动
    try:
        loop.run_until_complete(bridge.start())
        loop.run_forever()
    except KeyboardInterrupt:
        pass
    finally:
        loop.run_until_complete(bridge.stop())
