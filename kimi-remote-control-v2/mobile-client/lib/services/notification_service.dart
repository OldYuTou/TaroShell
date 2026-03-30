import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../models/kimi_event.dart';

/// 本地通知服务
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  /// 初始化
  Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notifications.initialize(
      settings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    _initialized = true;
  }

  /// 显示通知
  Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
    Importance importance = Importance.defaultImportance,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'kimi_remote_channel',
      'Kimi Remote',
      channelDescription: 'Kimi 远程控制通知',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
      enableVibration: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(
      DateTime.now().millisecond,
      title,
      body,
      details,
      payload: payload,
    );
  }

  /// 显示 Kimi 事件通知
  Future<void> showKimiEvent(KimiEvent event) async {
    // 只有重要事件才显示通知
    if (!event.isTaskComplete && !event.needsApproval && !event.isInterrupted) {
      return;
    }

    await showNotification(
      title: event.title,
      body: event.description,
      payload: event.type,
      importance: event.needsApproval ? Importance.max : Importance.high,
    );
  }

  /// 处理通知点击
  void _onNotificationTap(NotificationResponse response) {
    // TODO: 导航到相应页面
    print('Notification tapped: ${response.payload}');
  }

  /// 取消所有通知
  Future<void> cancelAll() async {
    await _notifications.cancelAll();
  }
}
