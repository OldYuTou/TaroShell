"""
Kimi CLI Wire 协议桥接器

将 Kimi CLI 的 Wire 协议事件转发到远程推送服务
"""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any

# 简单的 JSON-RPC 消息处理
class WireBridge:
    """Wire 协议桥接器"""
    
    def __init__(self):
        self.buffer = ""
        
    def process_line(self, line: str) -> dict[str, Any] | None:
        """处理一行输入"""
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            return None
            
    def is_event_message(self, msg: dict[str, Any]) -> bool:
        """检查是否为事件消息"""
        return msg.get('method') == 'event'
        
    def extract_event(self, msg: dict[str, Any]) -> dict[str, Any] | None:
        """提取事件数据"""
        params = msg.get('params', {})
        return {
            'type': params.get('type'),
            'payload': params.get('payload')
        }


async def main():
    """主函数：从 stdin 读取 Wire 消息并处理"""
    bridge = WireBridge()
    
    # 导入并启动远程桥接
    try:
        from kimi_remote_bridge import get_bridge
        remote = get_bridge()
        await remote.start()
    except ImportError:
        print("[WireBridge] Warning: kimi_remote_bridge not available", file=sys.stderr)
        remote = None
    
    print("[WireBridge] Started, waiting for Wire messages...", file=sys.stderr)
    
    # 读取 stdin
    loop = asyncio.get_event_loop()
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)
    
    try:
        while True:
            line = await reader.readline()
            if not line:
                break
                
            line_str = line.decode('utf-8').strip()
            if not line_str:
                continue
                
            # 处理消息
            msg = bridge.process_line(line_str)
            if not msg:
                continue
                
            # 透传原始消息
            print(line_str)
            
            # 如果是事件，转发到远程服务
            if bridge.is_event_message(msg) and remote:
                event = bridge.extract_event(msg)
                if event:
                    # 从事件中提取会话ID（如果有）
                    session_id = event.get('payload', {}).get('session_id', 'unknown')
                    await remote.send_kimi_event(
                        event['type'],
                        session_id,
                        event.get('payload', {})
                    )
                    
    except asyncio.CancelledError:
        pass
    finally:
        if remote:
            await remote.stop()


if __name__ == '__main__':
    asyncio.run(main())
