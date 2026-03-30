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
  String? _errorMessage;
  String _statusMessage = '未连接';
  List<String> _logs = [];
  
  // 最大日志条数
  static const int _maxLogs = 50;

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

  void _addLog(String log) {
    setState(() {
      _logs.add('[${DateTime.now().toString().substring(11, 19)}] $log');
      if (_logs.length > _maxLogs) {
        _logs.removeAt(0);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('连接设置'),
      ),
      body: BlocListener<RemoteBloc, RemoteState>(
        listener: (context, state) {
          setState(() {
            if (state is RemoteInitial) {
              _isConnected = false;
              _statusMessage = '未连接';
              _errorMessage = null;
            } else if (state is RemoteConnecting) {
              _isConnected = false;
              _statusMessage = '正在连接...';
              _errorMessage = null;
              _addLog('正在连接到服务器...');
            } else if (state is RemoteConnected) {
              _isConnected = true;
              _statusMessage = '已连接';
              _errorMessage = null;
              _addLog('连接成功！');
            } else if (state is RemoteDisconnected) {
              _isConnected = false;
              _statusMessage = '已断开';
              _addLog('连接已断开');
            } else if (state is RemoteError) {
              _isConnected = false;
              _statusMessage = '连接失败';
              _errorMessage = state.message;
              _addLog('错误: ${state.message}');
            }
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
                  color: _isConnected ? Colors.green[50] : (_errorMessage != null ? Colors.red[50] : null),
                  child: Column(
                    children: [
                      ListTile(
                        leading: Icon(
                          _isConnected ? Icons.cloud_done : (_errorMessage != null ? Icons.error : Icons.cloud_off),
                          color: _isConnected ? Colors.green : (_errorMessage != null ? Colors.red : Colors.grey),
                          size: 32,
                        ),
                        title: Text(
                          _statusMessage,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: _isConnected ? Colors.green[700] : (_errorMessage != null ? Colors.red[700] : null),
                          ),
                        ),
                        subtitle: Text(_isConnected
                            ? '正在接收 Kimi 通知'
                            : (_errorMessage ?? '请配置并连接到服务器')),
                      ),
                      if (_errorMessage != null)
                        Container(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          alignment: Alignment.centerLeft,
                          child: Text(
                            '错误详情: $_errorMessage',
                            style: TextStyle(color: Colors.red[600], fontSize: 12),
                          ),
                        ),
                    ],
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

                const SizedBox(height: 16),
                
                // 调试日志
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      '连接日志',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    TextButton.icon(
                      onPressed: () => setState(() => _logs.clear()),
                      icon: const Icon(Icons.clear, size: 16),
                      label: const Text('清除'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  height: 150,
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey[300]!),
                  ),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: _logs.length,
                    itemBuilder: (context, index) {
                      return Text(
                        _logs[index],
                        style: TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: _logs[index].contains('错误') || _logs[index].contains('失败')
                              ? Colors.red
                              : _logs[index].contains('成功')
                                  ? Colors.green
                                  : Colors.black87,
                        ),
                      );
                    },
                  ),
                ),

                const SizedBox(height: 24),

                // 使用说明
                const Text(
                  '使用说明',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  '1. 确保手机和电脑在同一 WiFi 网络\n'
                  '2. 在电脑端运行 start-all.bat 启动服务\n'
                  '3. 输入电脑的 IP 地址（如 ws://192.168.1.5:8081）\n'
                  '4. 点击连接按钮',
                  style: TextStyle(color: Colors.grey, height: 1.5, fontSize: 13),
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
