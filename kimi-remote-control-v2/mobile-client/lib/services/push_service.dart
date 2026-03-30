import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';

/// 推送服务
/// 
/// 管理 FCM (Android) / APNs (iOS) 推送
class PushService {
  static final PushService _instance = PushService._internal();
  factory PushService() => _instance;
  PushService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  String? _fcmToken;
  Function(Map<String, dynamic>)? _onMessageHandler;

  /// 初始化推送服务
  Future<void> initialize({
    required Function(Map<String, dynamic>) onMessage,
  }) async {
    _onMessageHandler = onMessage;

    // 请求权限 (iOS)
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // 获取 FCM Token
    _fcmToken = await _messaging.getToken();
    print('FCM Token: $_fcmToken');

    // 监听 Token 刷新
    _messaging.onTokenRefresh.listen((token) {
      _fcmToken = token;
      print('FCM Token refreshed: $token');
    });

    // 前台消息处理
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Foreground message: ${message.notification?.title}');
      _onMessageHandler?.call(message.data);
    });

    // 后台/终止状态点击处理
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('Message opened app: ${message.notification?.title}');
      _onMessageHandler?.call(message.data);
    });
  }

  /// 获取 FCM Token
  String? getFcmToken() => _fcmToken;

  /// 订阅主题
  Future<void> subscribeToTopic(String topic) async {
    await _messaging.subscribeToTopic(topic);
  }

  /// 取消订阅
  Future<void> unsubscribeFromTopic(String topic) async {
    await _messaging.unsubscribeFromTopic(topic);
  }
}
