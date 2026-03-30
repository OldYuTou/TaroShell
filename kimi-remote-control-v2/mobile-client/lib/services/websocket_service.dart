import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/io.dart';

import '../models/kimi_event.dart';

/// WebSocket 连接状态
enum ConnectionState {
  disconnected,
  connecting,
  connected,
  error,
}

/// WebSocket 服务
class WebSocketService {
  final String serverUrl;
  final String userId;
  final String deviceName;

  WebSocketChannel? _channel;
  ConnectionState _state = ConnectionState.disconnected;
  String? _deviceId;

  // 流控制器
  final _stateController = StreamController<ConnectionState>.broadcast();
  final _eventController = StreamController<KimiEvent>.broadcast();
  final _pushController = StreamController<PushMessage>.broadcast();
  final _deviceController = StreamController<DeviceInfo>.broadcast();

  Timer? _pingTimer;
  Timer? _reconnectTimer;

  WebSocketService({
    required this.serverUrl,
    required this.userId,
    this.deviceName = 'Mobile Device',
  });

  // 公开流
  Stream<ConnectionState> get stateStream => _stateController.stream;
  Stream<KimiEvent> get eventStream => _eventController.stream;
  Stream<PushMessage> get pushStream => _pushController.stream;
  Stream<DeviceInfo> get deviceStream => _deviceController.stream;

  ConnectionState get state => _state;
  String? get deviceId => _deviceId;
  bool get isConnected => _state == ConnectionState.connected;

  /// 连接到服务器
  Future<void> connect() async {
    if (_state == ConnectionState.connecting || _state == ConnectionState.connected) {
      return;
    }

    _setState(ConnectionState.connecting);

    try {
      final wsUrl = serverUrl.replaceFirst('http://', 'ws://').replaceFirst('https://', 'wss://');
      _channel = IOWebSocketChannel.connect(wsUrl);

      _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
      );

      // 开始心跳
      _startPing();
    } catch (e) {
      _setState(ConnectionState.error);
      _scheduleReconnect();
    }
  }

  /// 断开连接
  Future<void> disconnect() async {
    _reconnectTimer?.cancel();
    _pingTimer?.cancel();
    await _channel?.sink.close();
    _channel = null;
    _setState(ConnectionState.disconnected);
  }

  /// 注册设备
  void _register() {
    _send({
      'type': 'register',
      'payload': {
        'adapterName': 'mobile_client',
        'adapterVersion': '1.0.0',
        'userId': userId,
        'deviceName': deviceName,
        'supportedEvents': ['message.stream', 'message.complete', 'task.complete', 'approval.request'],
        'supportedCommands': ['message.send', 'approval.respond'],
      },
    });
  }

  /// 发送消息到服务器
  void _send(Map<String, dynamic> message) {
    if (_channel != null && isConnected) {
      _channel!.sink.add(jsonEncode(message));
    }
  }

  /// 发送审批响应
  void sendApprovalResponse(String requestId, String response, {String? feedback}) {
    _send({
      'type': 'approval_response',
      'requestId': requestId,
      'response': response,
      'feedback': feedback,
    });
  }

  /// 发送命令到 Kimi
  void sendCommand(String action, {String? sessionId, Map<String, dynamic>? data}) {
    _send({
      'type': 'mobile_request',
      'action': action,
      'sessionId': sessionId,
      'data': data,
      'requestId': DateTime.now().millisecondsSinceEpoch.toString(),
    });
  }
  
  /// 发送消息给 AI
  void sendMessage(String message, {String? sessionId}) {
    _send({
      'type': 'mobile_request',
      'action': 'send_message',
      'sessionId': sessionId,
      'message': message,
      'requestId': DateTime.now().millisecondsSinceEpoch.toString(),
    });
  }
  
  /// 注册推送 Token
  void registerPushToken(String token, String platform) {
    _send({
      'type': 'push_register',
      'token': token,
      'platform': platform,
    });
  }

  /// 消息处理
  void _onMessage(dynamic message) {
    try {
      final data = jsonDecode(message as String);
      _handleMessage(data);
    } catch (e) {
      print('WebSocket message error: $e');
    }
  }

  /// 处理消息
  void _handleMessage(Map<String, dynamic> data) {
    final type = data['type'];

    switch (type) {
      case 'connected':
        _deviceId = data['clientId'] ?? data['deviceId'];
        _register();
        break;

      case 'registered':
        _setState(ConnectionState.connected);
        break;

      case 'pong':
        // 心跳响应
        break;

      case 'kimi_event':
        final event = KimiEvent.fromJson(data);
        _eventController.add(event);
        break;

      case 'push':
        final push = PushMessage.fromJson(data);
        _pushController.add(push);
        break;

      case 'device_online':
      case 'device_offline':
        final device = DeviceInfo.fromJson(data);
        _deviceController.add(device);
        break;

      case 'error':
        print('Server error: ${data['message']}');
        break;
    }
  }

  /// 错误处理
  void _onError(error) {
    print('WebSocket error: $error');
    _setState(ConnectionState.error);
    _scheduleReconnect();
  }

  /// 连接关闭
  void _onDone() {
    _setState(ConnectionState.disconnected);
    _scheduleReconnect();
  }

  /// 设置状态
  void _setState(ConnectionState state) {
    _state = state;
    _stateController.add(state);
  }

  /// 开始心跳
  void _startPing() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _send({'type': 'ping'});
    });
  }

  /// 计划重连
  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      connect();
    });
  }

  /// 释放资源
  void dispose() {
    disconnect();
    _stateController.close();
    _eventController.close();
    _pushController.close();
    _deviceController.close();
  }
}
