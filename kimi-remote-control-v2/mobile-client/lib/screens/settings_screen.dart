import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../bloc/remote_bloc.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _serverController = TextEditingController();
  final _userIdController = TextEditingController();

  bool _isConnected = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _serverController.text = prefs.getString('server_url') ?? 'ws://192.168.100.4:8081';
      _userIdController.text = prefs.getString('user_id') ?? '';
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', _serverController.text);
    await prefs.setString('user_id', _userIdController.text);
  }

  void _connect() {
    if (_formKey.currentState?.validate() ?? false) {
      _saveSettings();
      context.read<RemoteBloc>().add(ConnectEvent(
        serverUrl: _serverController.text,
        userId: _userIdController.text,
      ));
    }
  }

  void _disconnect() {
    context.read<RemoteBloc>().add(DisconnectEvent());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('设置'),
      ),
      body: BlocListener<RemoteBloc, RemoteState>(
        listener: (context, state) {
          setState(() {
            _isConnected = state is RemoteConnected;
          });
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 连接状态
                Card(
                  child: ListTile(
                    leading: Icon(
                      _isConnected ? Icons.cloud_done : Icons.cloud_off,
                      color: _isConnected ? Colors.green : Colors.grey,
                    ),
                    title: Text(_isConnected ? '已连接' : '未连接'),
                    subtitle: Text(_isConnected
                        ? '正在接收 Kimi 通知'
                        : '请配置并连接到服务器'),
                  ),
                ),
                const SizedBox(height: 24),

                // 服务器地址
                TextFormField(
                  controller: _serverController,
                  decoration: const InputDecoration(
                    labelText: '推送服务器地址',
                    hintText: 'ws://your-server:8081',
                    prefixIcon: Icon(Icons.dns),
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return '请输入服务器地址';
                    }
                    if (!value.startsWith('ws://') && !value.startsWith('wss://')) {
                      return '地址必须以 ws:// 或 wss:// 开头';
                    }
                    return null;
                  },
                  enabled: !_isConnected,
                ),
                const SizedBox(height: 16),

                // 用户ID
                TextFormField(
                  controller: _userIdController,
                  decoration: const InputDecoration(
                    labelText: '用户ID',
                    hintText: '与电脑端配置相同的用户ID',
                    prefixIcon: Icon(Icons.person),
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return '请输入用户ID';
                    }
                    return null;
                  },
                  enabled: !_isConnected,
                ),
                const SizedBox(height: 24),

                // 连接/断开按钮
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isConnected ? _disconnect : _connect,
                    icon: Icon(_isConnected ? Icons.stop : Icons.play_arrow),
                    label: Text(_isConnected ? '断开连接' : '连接'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: _isConnected ? Colors.red : null,
                    ),
                  ),
                ),

                const SizedBox(height: 32),

                // 使用说明
                const Text(
                  '使用说明',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  '1. 在电脑端启动 Kimi CLI 并配置推送服务插件\n'
                  '2. 部署推送服务器（Node.js 服务）\n'
                  '3. 在手机端配置相同的服务器地址和用户ID\n'
                  '4. 点击连接，即可接收 Kimi 通知',
                  style: TextStyle(color: Colors.grey, height: 1.5),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _serverController.dispose();
    _userIdController.dispose();
    super.dispose();
  }
}
