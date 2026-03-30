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
  final _errorController = StreamController<String>.broadcast(); // 错误消息流
  final _logController = StreamController<String>.broadcast(); // 日志流

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
  Stream<String> get errorStream => _errorController.stream; // 错误消息
  Stream<String> get logStream => _logController.stream; // 日志消息
  
  // 最后一条错误消息
  String? _lastError;
  String? get lastError => _lastError;

  ConnectionState get state => _state;
  String? get deviceId => _deviceId;
  bool get isConnected => _state == ConnectionState.connected;

  /// 连接到服务器
  Future<void> connect() async {
    if (_state == ConnectionState.connecting || _state == ConnectionState.connected) {
      _log('Already connecting or connected, skipping');
      return;
    }

    _setState(ConnectionState.connecting);
    _clearError();
    _log('Connecting to $serverUrl...');

    try {
      final wsUrl = serverUrl.replaceFirst('http://', 'ws://').replaceFirst('https://', 'wss://');
      _log('WebSocket URL: $wsUrl');
      
      _channel = IOWebSocketChannel.connect(
        wsUrl,
        pingInterval: const Duration(seconds: 30),
      );

      _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
      );

      _log('WebSocket channel created, waiting for connection...');
      // 开始心跳
      _startPing();
    } catch (e) {
      _setError('Connection failed: $e');
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
    _log('Registering device...');
    
    final registerMsg = {
      'type': 'register',
      'payload': {
        'adapterName': 'mobile_client',
        'adapterVersion': '1.0.0',
        'userId': userId,
        'deviceName': deviceName,
        'supportedEvents': ['message.stream', 'message.complete', 'task.complete', 'approval.request'],
        'supportedCommands': ['message.send', 'approval.respond'],
      },
    };
    _log('Sending register: $registerMsg');
    _send(registerMsg);
    _log('Register message sent');
    
    // 设置超时检查
    Future.delayed(const Duration(seconds: 5), () {
      if (_state == ConnectionState.connecting) {
        _setError('服务器没有响应注册请求，请检查服务器日志');
        _setState(ConnectionState.error);
      }
    });
  }

  /// 发送消息到服务器
  void _send(Map<String, dynamic> message) {
    if (_channel != null) {
      try {
        _channel!.sink.add(jsonEncode(message));
        _log('Sent: ${message['type']}');
      } catch (e) {
        _log('Send error: $e');
      }
    } else {
      _log('Cannot send: channel is null');
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
      final msgStr = message.toString();
      _log('Received: ${msgStr.length > 200 ? msgStr.substring(0, 200) + '...' : msgStr}');
      final data = jsonDecode(message as String);
      _handleMessage(data);
    } catch (e) {
      _log('Message parse error: $e');
    }
  }

  /// 处理消息
  void _handleMessage(Map<String, dynamic> data) {
    final type = data['type'];
    _log('Handling message type: $type');

    switch (type) {
      case 'connected':
        final clientId = data['clientId'] ?? data['deviceId'];
        _log('Got connected, clientId: $clientId');
        _deviceId = clientId;
        _register();
        break;

      case 'registered':
        _log('Successfully registered with server');
        _setState(ConnectionState.connected);
        _clearError();
        break;

      case 'pong':
        _log('Received pong');
        break;

      case 'kimi_event':
        _log('Received Kimi event');
        final event = KimiEvent.fromJson(data);
        _eventController.add(event);
        break;

      case 'push':
        _log('Received push message');
        final push = PushMessage.fromJson(data);
        _pushController.add(push);
        break;

      case 'device_online':
      case 'device_offline':
        _log('Device status changed: $type');
        final device = DeviceInfo.fromJson(data);
        _deviceController.add(device);
        break;

      case 'error':
        final errorMsg = 'Server error: ${data['message']}';
        _log(errorMsg);
        _setError(errorMsg);
        break;
      
      default:
        _log('Unknown message type: $type');
    }
  }

  /// 错误处理
  void _onError(error) {
    final errorMsg = 'WebSocket error: $error';
    print(errorMsg);
    _log(errorMsg);
    _setError(errorMsg);
    _setState(ConnectionState.error);
    _scheduleReconnect();
  }

  /// 连接关闭
  void _onDone() {
    _log('Connection closed');
    _setState(ConnectionState.disconnected);
    _scheduleReconnect();
  }
  
  /// 设置错误消息
  void _setError(String error) {
    _lastError = error;
    _errorController.add(error);
  }
  
  /// 清除错误消息
  void _clearError() {
    _lastError = null;
  }
  
  /// 添加日志
  void _log(String message) {
    final logMsg = '[${DateTime.now().toIso8601String()}] $message';
    print(logMsg);
    _logController.add(logMsg);
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
    _errorController.close();
    _logController.close();
  }
}
