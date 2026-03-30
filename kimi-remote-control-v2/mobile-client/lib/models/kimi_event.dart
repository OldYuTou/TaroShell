/// Kimi CLI 事件模型
class KimiEvent {
  final String type;
  final String? sessionId;
  final Map<String, dynamic> payload;
  final DateTime timestamp;

  KimiEvent({
    required this.type,
    this.sessionId,
    required this.payload,
    required this.timestamp,
  });

  factory KimiEvent.fromJson(Map<String, dynamic> json) {
    return KimiEvent(
      type: json['event'] ?? json['type'] ?? 'unknown',
      sessionId: json['sessionId'],
      payload: json['payload'] ?? {},
      timestamp: DateTime.fromMillisecondsSinceEpoch(
        (json['timestamp'] ?? DateTime.now().millisecondsSinceEpoch) as int,
      ),
    );
  }

  /// 是否为任务完成事件
  bool get isTaskComplete => type == 'TurnEnd';

  /// 是否需要审批
  bool get needsApproval => type == 'ApprovalRequest';

  /// 是否被中断
  bool get isInterrupted => type == 'StepInterrupted';

  /// 获取事件标题
  String get title {
    switch (type) {
      case 'TurnEnd':
        return '任务完成';
      case 'ApprovalRequest':
        return '需要确认';
      case 'StepInterrupted':
        return '任务中断';
      case 'TurnBegin':
        return '任务开始';
      case 'ToolCall':
        return '工具调用';
      case 'ToolResult':
        return '工具结果';
      default:
        return 'Kimi 通知';
    }
  }

  /// 获取事件描述
  String get description {
    switch (type) {
      case 'TurnEnd':
        return 'AI 已完成当前任务';
      case 'ApprovalRequest':
        final action = payload['action'] ?? '未知操作';
        return '操作: $action';
      case 'StepInterrupted':
        return '任务执行被中断';
      case 'TurnBegin':
        return '新任务已开始';
      default:
        return payload.toString();
    }
  }
}

/// 推送消息模型
class PushMessage {
  final String title;
  final String body;
  final KimiEvent? event;
  final DateTime receivedAt;

  PushMessage({
    required this.title,
    required this.body,
    this.event,
    required this.receivedAt,
  });

  factory PushMessage.fromJson(Map<String, dynamic> json) {
    return PushMessage(
      title: json['title'] ?? '通知',
      body: json['body'] ?? '',
      event: json['data'] != null ? KimiEvent.fromJson(json['data']) : null,
      receivedAt: DateTime.now(),
    );
  }
}

/// 设备信息模型
class DeviceInfo {
  final String deviceId;
  final String type; // 'kimi' 或 'mobile'
  final String? name;
  final DateTime connectedAt;
  final DateTime? lastPing;

  DeviceInfo({
    required this.deviceId,
    required this.type,
    this.name,
    required this.connectedAt,
    this.lastPing,
  });

  factory DeviceInfo.fromJson(Map<String, dynamic> json) {
    return DeviceInfo(
      deviceId: json['deviceId'] ?? '',
      type: json['clientType'] ?? json['type'] ?? 'unknown',
      name: json['deviceInfo']?['name'],
      connectedAt: DateTime.parse(json['connectedAt'] ?? DateTime.now().toIso8601String()),
      lastPing: json['lastPing'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['lastPing'] as int)
          : null,
    );
  }

  bool get isKimi => type == 'kimi';
  bool get isMobile => type == 'mobile';
}
