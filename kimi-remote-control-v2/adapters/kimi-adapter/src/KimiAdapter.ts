/**
 * Kimi Code CLI 适配器
 * 
 * 功能：
 * 1. 连接到 Kimi CLI 的 WebSocket 服务器
 * 2. 将 Kimi 事件转换为统一格式
 * 3. 将手机命令转换为 Kimi 命令
 */

import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import {
  BaseAdapter,
  UnifiedCommand,
  UnifiedEvent,
  EventType,
  EventPayload,
  CommandType,
  ToolConfig,
} from '@ai-remote/adapter-sdk';

// Kimi 原始事件类型
interface KimiWireEvent {
  type: string;
  payload: any;
}

// Kimi JSON-RPC 消息
interface KimiJsonRpcMessage {
  jsonrpc: '2.0';
  method?: string;
  id?: string;
  params?: any;
  result?: any;
  error?: any;
}

export class KimiAdapter extends BaseAdapter {
  readonly name = 'kimi';
  readonly version = '1.0.0';
  readonly supportedEvents: EventType[] = [
    'task.start',
    'task.progress',
    'task.complete',
    'task.error',
    'approval.request',
    'approval.granted',
    'approval.denied',
    'tool.call',
    'tool.result',
    'message.user',
    'message.assistant',
    'system.notification',
  ];
  readonly supportedCommands: CommandType[] = [
    'approval.respond',
    'task.cancel',
    'message.send',
    'session.list',
    'session.switch',
  ];
  
  private kimiProcess: ChildProcess | null = null;
  private kimiWs: WebSocket | null = null;
  private pendingApprovals: Map<string, any> = new Map();
  private sessionId: string | null = null;
  
  // ============ 生命周期 ============
  
  protected async onInitialize(): Promise<void> {
    console.log('[KimiAdapter] Initializing...');
    // 初始化配置检查
    const config = this.getConfig()?.toolConfig;
    if (!config?.kimiPath) {
      console.warn('[KimiAdapter] kimiPath not specified, will try to find kimi in PATH');
    }
  }
  
  protected async onStop(): Promise<void> {
    console.log('[KimiAdapter] Stopping...');
    
    if (this.kimiWs) {
      this.kimiWs.close();
      this.kimiWs = null;
    }
    
    if (this.kimiProcess) {
      this.kimiProcess.kill();
      this.kimiProcess = null;
    }
  }
  
  // ============ Hub 连接 ============
  
  protected onHubConnect(): void {
    console.log('[KimiAdapter] Hub connected, starting Kimi CLI...');
    this.startKimiProcess();
  }
  
  protected onHubDisconnect(): void {
    console.log('[KimiAdapter] Hub disconnected');
  }
  
  // ============ Kimi 进程管理 ============
  
  private startKimiProcess(): void {
    const config = this.getConfig()?.toolConfig;
    const kimiPath = config?.kimiPath || 'kimi';
    const workDir = config?.workDir;
    
    const args = ['web', '--network'];
    if (workDir) {
      args.push('--work-dir', workDir);
    }
    
    console.log(`[KimiAdapter] Starting: ${kimiPath} ${args.join(' ')}`);
    
    this.kimiProcess = spawn(kimiPath, args, {
      cwd: workDir,
      env: { ...process.env, ...config?.env },
    });
    
    this.kimiProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[Kimi stdout]', output.trim());
      
      // 解析 WebSocket URL
      const wsMatch = output.match(/ws:\/\/[^\s]+/);
      if (wsMatch && !this.kimiWs) {
        this.connectToKimi(wsMatch[0]);
      }
    });
    
    this.kimiProcess.stderr?.on('data', (data) => {
      console.error('[Kimi stderr]', data.toString().trim());
    });
    
    this.kimiProcess.on('close', (code) => {
      console.log(`[KimiAdapter] Kimi process exited with code ${code}`);
      this.kimiProcess = null;
      
      // 尝试重启
      if (this.getStatus() === 'connected') {
        setTimeout(() => this.startKimiProcess(), 5000);
      }
    });
  }
  
  private connectToKimi(wsUrl: string): void {
    console.log(`[KimiAdapter] Connecting to Kimi WebSocket: ${wsUrl}`);
    
    try {
      this.kimiWs = new WebSocket(wsUrl);
      
      this.kimiWs.on('open', () => {
        console.log('[KimiAdapter] Connected to Kimi WebSocket');
        this.sendEvent('system.notification', {
          title: 'Kimi 已连接',
          description: '适配器已成功连接到 Kimi CLI',
        });
      });
      
      this.kimiWs.on('message', (data) => {
        this.handleKimiMessage(data.toString());
      });
      
      this.kimiWs.on('close', () => {
        console.log('[KimiAdapter] Kimi WebSocket closed');
        this.kimiWs = null;
      });
      
      this.kimiWs.on('error', (err) => {
        console.error('[KimiAdapter] Kimi WebSocket error:', err);
      });
      
    } catch (err) {
      console.error('[KimiAdapter] Failed to connect to Kimi:', err);
    }
  }
  
  // ============ 消息处理 ============
  
  private handleKimiMessage(data: string): void {
    try {
      // Kimi 使用 JSON-RPC 2.0
      const lines = data.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const msg: KimiJsonRpcMessage = JSON.parse(line);
        
        if (msg.method === 'event' && msg.params) {
          this.handleKimiEvent(msg.params as KimiWireEvent);
        } else if (msg.method === 'request' && msg.params) {
          this.handleKimiRequest(msg.id, msg.params);
        }
      }
    } catch (err) {
      // 可能不是 JSON，忽略
    }
  }
  
  private handleKimiEvent(event: KimiWireEvent): void {
    const { type, payload } = event;
    
    switch (type) {
      case 'TurnBegin':
        this.sessionId = payload.session_id || `session-${Date.now()}`;
        this.createSession(this.sessionId, undefined, payload.work_dir);
        this.sendEvent('task.start', {
          title: '任务开始',
          description: '新的 AI 任务已开始',
          taskId: this.sessionId,
          raw: event,
        }, this.sessionId);
        break;
        
      case 'TurnEnd':
        this.sendEvent('task.complete', {
          title: '任务完成',
          description: 'AI 已完成当前任务',
          taskId: this.sessionId || undefined,
          raw: event,
        }, this.sessionId || undefined);
        break;
        
      case 'StepBegin':
        this.sendEvent('task.progress', {
          title: '执行中',
          description: `步骤 ${payload.n || 1}`,
          progress: payload.progress,
          raw: event,
        }, this.sessionId || undefined);
        break;
        
      case 'StepInterrupted':
        this.sendEvent('task.error', {
          title: '任务中断',
          description: '任务执行被中断',
          raw: event,
        }, this.sessionId || undefined);
        break;
        
      case 'ApprovalRequest':
        const requestId = payload.id || `approval-${Date.now()}`;
        this.pendingApprovals.set(requestId, payload);
        this.sendEvent('approval.request', {
          title: '需要确认',
          description: `操作: ${payload.action || '未知操作'}`,
          action: payload.action,
          toolName: payload.sender,
          parameters: payload,
          raw: event,
        }, this.sessionId || undefined);
        break;
        
      case 'ApprovalResponse':
        this.sendEvent(payload.response === 'approve' ? 'approval.granted' : 'approval.denied', {
          title: payload.response === 'approve' ? '已批准' : '已拒绝',
          description: `审批请求已${payload.response === 'approve' ? '批准' : '拒绝'}`,
          raw: event,
        }, this.sessionId || undefined);
        break;
        
      case 'ToolCall':
        this.sendEvent('tool.call', {
          title: '工具调用',
          description: `${payload.sender || 'AI'} 调用了 ${payload.action || '工具'}`,
          toolName: payload.action,
          parameters: payload,
          raw: event,
        }, this.sessionId || undefined);
        break;
        
      case 'ToolResult':
        this.sendEvent('tool.result', {
          title: '工具结果',
          description: payload.error ? `错误: ${payload.error}` : '工具执行完成',
          error: payload.error,
          result: payload.result,
          raw: event,
        }, this.sessionId || undefined);
        break;
        
      case 'ContentPart':
        if (payload.type === 'text') {
          this.sendEvent('message.assistant', {
            content: payload.text,
            raw: event,
          }, this.sessionId || undefined);
        }
        break;
        
      case 'StatusUpdate':
        // 状态更新，可以发送进度通知
        if (payload.context_usage !== undefined) {
          this.sendEvent('task.progress', {
            title: '处理中',
            description: `上下文使用: ${Math.round(payload.context_usage * 100)}%`,
            progress: Math.round(payload.context_usage * 100),
            raw: event,
          }, this.sessionId || undefined);
        }
        break;
    }
  }
  
  private handleKimiRequest(requestId: string | undefined, params: any): void {
    // 处理 Kimi 的请求（如审批请求）
    if (params.type === 'ApprovalRequest') {
      this.pendingApprovals.set(params.id || requestId, { requestId, params });
    }
  }
  
  // ============ 命令处理 ============
  
  protected async onCommand(command: UnifiedCommand): Promise<void> {
    console.log(`[KimiAdapter] Received command: ${command.type}`);
    
    switch (command.type) {
      case 'approval.respond':
        await this.handleApprovalResponse(command);
        break;
        
      case 'task.cancel':
        await this.handleCancelTask(command);
        break;
        
      case 'message.send':
        await this.handleSendMessage(command);
        break;
        
      case 'session.list':
        // 可以获取会话列表
        break;
        
      case 'session.switch':
        // 切换会话
        break;
    }
  }
  
  private async handleApprovalResponse(command: UnifiedCommand): Promise<void> {
    const { requestId, decision, feedback } = command.payload;
    
    if (!requestId || !this.kimiWs) return;
    
    // 构造 Kimi 格式的响应
    const response: KimiJsonRpcMessage = {
      jsonrpc: '2.0',
      id: requestId,
      result: {
        request_id: requestId,
        response: decision === 'approve' || decision === 'approve_session' ? 'approve' : 'reject',
        feedback: feedback || '',
      },
    };
    
    this.kimiWs.send(JSON.stringify(response));
    console.log(`[KimiAdapter] Approval response sent: ${decision}`);
  }
  
  private async handleCancelTask(command: UnifiedCommand): Promise<void> {
    if (!this.kimiWs || !this.sessionId) return;
    
    // 发送取消命令到 Kimi
    const cancelMsg: KimiJsonRpcMessage = {
      jsonrpc: '2.0',
      id: `cancel-${Date.now()}`,
      method: 'cancel',
      params: {
        session_id: this.sessionId,
      },
    };
    
    this.kimiWs.send(JSON.stringify(cancelMsg));
    console.log(`[KimiAdapter] Cancel command sent for session ${this.sessionId}`);
  }
  
  private async handleSendMessage(command: UnifiedCommand): Promise<void> {
    const { message } = command.payload;
    
    if (!this.kimiWs || !message) return;
    
    // 发送消息到 Kimi
    const promptMsg: KimiJsonRpcMessage = {
      jsonrpc: '2.0',
      id: `prompt-${Date.now()}`,
      method: 'prompt',
      params: {
        user_input: message,
      },
    };
    
    this.kimiWs.send(JSON.stringify(promptMsg));
    console.log(`[KimiAdapter] Message sent: ${message.substring(0, 50)}...`);
  }
}
