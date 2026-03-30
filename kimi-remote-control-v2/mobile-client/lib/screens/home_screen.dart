import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/remote_bloc.dart';
import '../models/kimi_event.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _messageController = TextEditingController();
  bool _showInput = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kimi 远程控制'),
        actions: [
          IconButton(
            icon: Icon(_showInput ? Icons.close : Icons.send),
            onPressed: () {
              setState(() {
                _showInput = !_showInput;
              });
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
        ],
      ),
      bottomSheet: _showInput ? _buildMessageInput(context) : null,
      body: BlocBuilder<RemoteBloc, RemoteState>(
        builder: (context, state) {
          if (state is RemoteInitial) {
            return _buildInitial(context);
          }

          if (state is RemoteConnecting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is RemoteDisconnected) {
            return _buildDisconnected(context);
          }

          if (state is RemoteError) {
            return _buildError(context, state.message);
          }

          if (state is RemoteConnected) {
            return _buildConnected(context, state);
          }

          return const Center(child: Text('未知状态'));
        },
      ),
    );
  }

  Widget _buildInitial(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.computer, size: 80, color: Colors.grey),
          const SizedBox(height: 20),
          const Text(
            '连接到 Kimi CLI',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          const Text(
            '请先配置服务器地址',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 30),
          ElevatedButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
            icon: const Icon(Icons.settings),
            label: const Text('去设置'),
          ),
        ],
      ),
    );
  }

  Widget _buildDisconnected(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.cloud_off, size: 80, color: Colors.orange),
          const SizedBox(height: 20),
          const Text(
            '连接已断开',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          const Text(
            '点击重新连接',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 30),
          ElevatedButton.icon(
            onPressed: () => _showConnectDialog(context),
            icon: const Icon(Icons.refresh),
            label: const Text('重新连接'),
          ),
        ],
      ),
    );
  }

  Widget _buildError(BuildContext context, String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 80, color: Colors.red),
          const SizedBox(height: 20),
          const Text(
            '连接失败',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          Text(message, style: const TextStyle(color: Colors.grey)),
          const SizedBox(height: 30),
          ElevatedButton.icon(
            onPressed: () => _showConnectDialog(context),
            icon: const Icon(Icons.refresh),
            label: const Text('重试'),
          ),
        ],
      ),
    );
  }

  Widget _buildConnected(BuildContext context, RemoteConnected state) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.notifications), text: '通知'),
              Tab(icon: Icon(Icons.check_circle), text: '完成'),
              Tab(icon: Icon(Icons.devices), text: '设备'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                _buildNotificationsTab(state),
                _buildCompletedTab(state),
                _buildDevicesTab(state),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationsTab(RemoteConnected state) {
    final pending = state.pendingApprovals;

    if (pending.isEmpty) {
      return const Center(
        child: Text('暂无待处理的通知', style: TextStyle(color: Colors.grey)),
      );
    }

    return ListView.builder(
      itemCount: pending.length,
      itemBuilder: (context, index) {
        final event = pending[index];
        return _ApprovalCard(
          event: event,
          onApprove: () => _handleApproval(context, event, 'approve'),
          onReject: () => _handleApproval(context, event, 'reject'),
        );
      },
    );
  }

  Widget _buildCompletedTab(RemoteConnected state) {
    final completed = state.recentCompletions;

    if (completed.isEmpty) {
      return const Center(
        child: Text('暂无完成的任务', style: TextStyle(color: Colors.grey)),
      );
    }

    return ListView.builder(
      itemCount: completed.length,
      itemBuilder: (context, index) {
        final event = completed[index];
        return ListTile(
          leading: const Icon(Icons.check_circle, color: Colors.green),
          title: Text(event.title),
          subtitle: Text(event.description),
          trailing: Text(
            _formatTime(event.timestamp),
            style: const TextStyle(fontSize: 12, color: Colors.grey),
          ),
        );
      },
    );
  }

  Widget _buildDevicesTab(RemoteConnected state) {
    if (state.devices.isEmpty) {
      return const Center(
        child: Text('暂无连接的设备', style: TextStyle(color: Colors.grey)),
      );
    }

    return ListView.builder(
      itemCount: state.devices.length,
      itemBuilder: (context, index) {
        final device = state.devices[index];
        return ListTile(
          leading: Icon(
            device.isKimi ? Icons.computer : Icons.phone_android,
            color: device.isKimi ? Colors.blue : Colors.green,
          ),
          title: Text(device.name ?? device.deviceId.substring(0, 8)),
          subtitle: Text(device.type),
          trailing: Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: device.lastPing != null &&
                      DateTime.now().difference(device.lastPing!).inSeconds < 60
                  ? Colors.green
                  : Colors.grey,
            ),
          ),
        );
      },
    );
  }

  void _showConnectDialog(BuildContext context) {
    // 从设置中读取并连接
    // 简化实现，实际应从 SharedPreferences 读取
    context.read<RemoteBloc>().add(ConnectEvent(
      serverUrl: 'ws://192.168.100.4:8081',
      userId: 'default_user',
    ));
  }

  void _handleApproval(BuildContext context, KimiEvent event, String response) {
    context.read<RemoteBloc>().add(SendApprovalResponse(
      requestId: event.payload['id'] ?? '',
      response: response,
    ));

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已$response')),
    );
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);

    if (diff.inSeconds < 60) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    return '${diff.inDays}天前';
  }
  
  Widget _buildMessageInput(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _messageController,
                decoration: const InputDecoration(
                  hintText: '发送消息给 Kimi...',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
                minLines: 1,
                textInputAction: TextInputAction.send,
                onSubmitted: (text) => _sendMessage(context, text),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              onPressed: () => _sendMessage(context, _messageController.text),
              icon: const Icon(Icons.send),
              color: Theme.of(context).primaryColor,
            ),
          ],
        ),
      ),
    );
  }
  
  void _sendMessage(BuildContext context, String text) {
    if (text.trim().isEmpty) return;
    
    // 通过 BLoC 发送消息
    context.read<RemoteBloc>().add(SendMessageEvent(message: text));
    
    _messageController.clear();
    setState(() {
      _showInput = false;
    });
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('消息已发送')),
    );
  }
  
  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }
}

class _ApprovalCard extends StatelessWidget {
  final KimiEvent event;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  const _ApprovalCard({
    required this.event,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.warning, color: Colors.orange),
                const SizedBox(width: 8),
                Text(
                  event.title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(event.description),
            if (event.payload['description'] != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  event.payload['description'].toString(),
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: onReject,
                  child: const Text('拒绝', style: TextStyle(color: Colors.red)),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: onApprove,
                  child: const Text('批准'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
