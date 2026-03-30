import 'package:flutter_bloc/flutter_bloc.dart';

import '../models/kimi_event.dart';
import '../services/notification_service.dart';
import '../services/websocket_service.dart';

// ============ 事件 ============
abstract class RemoteEvent {}

class ConnectEvent extends RemoteEvent {
  final String serverUrl;
  final String userId;
  ConnectEvent({required this.serverUrl, required this.userId});
}

class DisconnectEvent extends RemoteEvent {}

class KimiEventReceived extends RemoteEvent {
  final KimiEvent event;
  KimiEventReceived(this.event);
}

class PushReceived extends RemoteEvent {
  final PushMessage push;
  PushReceived(this.push);
}

class DeviceStatusChanged extends RemoteEvent {
  final DeviceInfo device;
  DeviceStatusChanged(this.device);
}

class SendApprovalResponse extends RemoteEvent {
  final String requestId;
  final String response;
  final String? feedback;
  SendApprovalResponse({
    required this.requestId,
    required this.response,
    this.feedback,
  });
}

class SendMessageEvent extends RemoteEvent {
  final String message;
  final String? sessionId;
  SendMessageEvent({required this.message, this.sessionId});
}

// ============ 状态 ============
abstract class RemoteState {}

class RemoteInitial extends RemoteState {}

class RemoteConnecting extends RemoteState {}

class RemoteConnected extends RemoteState {
  final List<KimiEvent> events;
  final List<DeviceInfo> devices;
  final List<PushMessage> notifications;

  RemoteConnected({
    this.events = const [],
    this.devices = const [],
    this.notifications = const [],
  });

  RemoteConnected copyWith({
    List<KimiEvent>? events,
    List<DeviceInfo>? devices,
    List<PushMessage>? notifications,
  }) {
    return RemoteConnected(
      events: events ?? this.events,
      devices: devices ?? this.devices,
      notifications: notifications ?? this.notifications,
    );
  }

  // 获取待处理的审批请求
  List<KimiEvent> get pendingApprovals =>
      events.where((e) => e.needsApproval).toList();

  // 获取最近完成的任务
  List<KimiEvent> get recentCompletions =>
      events.where((e) => e.isTaskComplete).toList();
}

class RemoteDisconnected extends RemoteState {}

class RemoteError extends RemoteState {
  final String message;
  RemoteError(this.message);
}

// ============ BLoC ============
class RemoteBloc extends Bloc<RemoteEvent, RemoteState> {
  WebSocketService? _webSocket;
  final _notificationService = NotificationService();

  RemoteBloc() : super(RemoteInitial()) {
    on<ConnectEvent>(_onConnect);
    on<DisconnectEvent>(_onDisconnect);
    on<KimiEventReceived>(_onKimiEvent);
    on<PushReceived>(_onPushReceived);
    on<DeviceStatusChanged>(_onDeviceStatusChanged);
    on<SendApprovalResponse>(_onSendApprovalResponse);
    on<SendMessageEvent>(_onSendMessage);
  }

  Future<void> _onConnect(ConnectEvent event, Emitter<RemoteState> emit) async {
    emit(RemoteConnecting());

    await _notificationService.initialize();

    _webSocket = WebSocketService(
      serverUrl: event.serverUrl,
      userId: event.userId,
    );

    // 监听连接状态
    _webSocket!.stateStream.listen((state) {
      if (state == ConnectionState.disconnected) {
        emit(RemoteDisconnected());
      }
    });

    // 监听 Kimi 事件
    _webSocket!.eventStream.listen((kimiEvent) {
      add(KimiEventReceived(kimiEvent));
    });

    // 监听推送
    _webSocket!.pushStream.listen((push) {
      add(PushReceived(push));
    });

    // 监听设备状态
    _webSocket!.deviceStream.listen((device) {
      add(DeviceStatusChanged(device));
    });

    await _webSocket!.connect();

    if (_webSocket!.isConnected) {
      emit(RemoteConnected());
    } else {
      emit(RemoteError('连接失败'));
    }
  }

  Future<void> _onDisconnect(DisconnectEvent event, Emitter<RemoteState> emit) async {
    await _webSocket?.disconnect();
    emit(RemoteDisconnected());
  }

  Future<void> _onKimiEvent(KimiEventReceived event, Emitter<RemoteState> emit) async {
    if (state is RemoteConnected) {
      final current = state as RemoteConnected;
      emit(current.copyWith(
        events: [event.event, ...current.events],
      ));

      // 显示本地通知
      await _notificationService.showKimiEvent(event.event);
    }
  }

  Future<void> _onPushReceived(PushReceived event, Emitter<RemoteState> emit) async {
    if (state is RemoteConnected) {
      final current = state as RemoteConnected;
      emit(current.copyWith(
        notifications: [event.push, ...current.notifications],
      ));

      // 显示推送通知
      await _notificationService.showNotification(
        title: event.push.title,
        body: event.push.body,
      );
    }
  }

  Future<void> _onDeviceStatusChanged(DeviceStatusChanged event, Emitter<RemoteState> emit) async {
    if (state is RemoteConnected) {
      final current = state as RemoteConnected;
      final devices = [...current.devices];

      // 更新或添加设备
      final index = devices.indexWhere((d) => d.deviceId == event.device.deviceId);
      if (index >= 0) {
        devices[index] = event.device;
      } else {
        devices.add(event.device);
      }

      emit(current.copyWith(devices: devices));
    }
  }

  Future<void> _onSendApprovalResponse(SendApprovalResponse event, Emitter<RemoteState> emit) async {
    _webSocket?.sendApprovalResponse(
      event.requestId,
      event.response,
      feedback: event.feedback,
    );
  }
  
  Future<void> _onSendMessage(SendMessageEvent event, Emitter<RemoteState> emit) async {
    _webSocket?.sendMessage(event.message, sessionId: event.sessionId);
  }

  @override
  Future<void> close() async {
    await _webSocket?.dispose();
    return super.close();
  }
}
