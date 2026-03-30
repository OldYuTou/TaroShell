# Kimi CLI 远程控制插件

将 Kimi CLI 的事件推送到远程服务，实现手机通知。

## 安装

```bash
pip install websockets

# 复制插件文件到合适位置
cp kimi_remote_bridge.py ~/.config/kimi/plugins/
cp kimi_wire_bridge.py ~/.config/kimi/plugins/
```

## 配置

在 `~/.config/kimi/config.toml` 中添加：

```toml
[notifications]
enabled = true

# 远程推送服务配置
[notifications.sinks.remote]
url = "ws://your-push-server:8081"
user_id = "your_user_id"
```

或在启动 Kimi CLI 前设置环境变量：

```bash
export KIMI_PUSH_SERVICE_URL="ws://your-push-server:8081"
export KIMI_REMOTE_USER_ID="your_user_id"
export KIMI_REMOTE_DEVICE_NAME="My Desktop"

kimi web --network
```

## 使用 Wire Bridge（高级）

如果你想拦截所有 Wire 协议消息：

```bash
# 启动 Kimi CLI 并通过桥接器
kimi --wire | python kimi_wire_bridge.py
```

## 事件类型

插件会自动转发以下事件到手机：

- `TurnEnd` - AI 任务完成
- `ApprovalRequest` - 需要用户审批
- `StepInterrupted` - 任务被中断
- `ToolResult` - 工具执行结果

## 故障排查

1. **连接失败**：检查 PUSH_SERVICE_URL 是否正确
2. **收不到通知**：确认手机和电脑使用相同的 user_id
3. **网络问题**：确保服务器端口在防火墙中开放
