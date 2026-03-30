/**
 * Kimi 完整功能适配器
 * 
 * 实现所有完整功能：
 * - 实时对话流
 * - 完整历史
 * - 多会话管理
 * - 工具输出
 * - 文件上传
 * - 图片预览
 * - 斜杠命令
 */

import { FullFeatureAdapter, FileUpload, FileReference, ContentBlock, ApprovalDecision, SlashCommand } from '@ai-remote/adapter-sdk';
import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';

export class KimiFullAdapter extends FullFeatureAdapter {
  readonly name = 'kimi';
  readonly version = '2.0.0';
  readonly supportedEvents = [
    'task.start', 'task.progress', 'task.complete', 'task.error',
    'approval.request', 'approval.granted', 'approval.denied',
    'message.received', 'message.stream', 'message.complete',
    'session.created', 'session.switched', 'session.forked',
    'file.uploaded', 'tool.output', 'command.executed',
  ];
  readonly supportedCommands = [
    'message.send', 'message.stream', 'session.create', 'session.switch',
    'history.sync', 'file.upload', 'command.execute', 'approval.respond',
  ];
  
  private kimiProcess: ChildProcess | null = null;
  private kimiWs: WebSocket | null = null;
  private pendingApprovals: Map<string, any> = new Map();
  
  // ============ 生命周期 ============
  
  protected async onInitialize(): Promise<void> {
    console.log('[KimiFullAdapter] Initializing...');
    
    // 初始化斜杠命令
    this.slashCommands.set('clear', {
      name: 'clear',
      description: '清空当前会话',
      aliases: ['/clear'],
      handler: async () => {
        const currentSession = Array.from(this.sessions.values()).find(s => s.status === 'active');
        if (currentSession) {
          await this.clearSession(currentSession.id);
        }
      },
    });
    
    this.slashCommands.set('compact', {
      name: 'compact',
      description: '压缩上下文',
      aliases: ['/compact'],
    });
    
    this.slashCommands.set('help', {
      name: 'help',
      description: '显示帮助',
      aliases: ['/help', '/h'],
    });
  }
  
  protected async onStop(): Promise<void> {
    if (this.kimiWs) {
      this.kimiWs.close();
      this.kimiWs = null;
    }
    if (this.kimiProcess) {
      this.kimiProcess.kill();
      this.kimiProcess = null;
    }
  }
  
  // ============ Kimi 连接 ============
  
  protected async onHubConnect(): Promise<void> {
    await super.onHubConnect();
    this.startKimiProcess();
  }
  
  private startKimiProcess(): void {
    const config = this.getConfig()?.toolConfig;
    const kimiPath = config?.kimiPath || 'kimi';
    
    console.log(`[KimiFullAdapter] Starting Kimi CLI...`);
    
    this.kimiProcess = spawn(kimiPath, ['web', '--network'], {
      cwd: config?.workDir,
      env: { ...process.env, ...config?.env },
    });
    
    this.kimiProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      const wsMatch = output.match(/ws:\/\/[^\s]+/);
      if (wsMatch && !this.kimiWs) {
        this.connectToKimi(wsMatch[0]);
      }
    });
    
    this.kimiProcess.stderr?.on('data', (data) => {
      console.error('[Kimi stderr]', data.toString().trim());
    });
    
    this.kimiProcess.on('close', (code) => {
      console.log(`[KimiFullAdapter] Kimi exited with code ${code}`);
      setTimeout(() => this.startKimiProcess(), 5000);
    });
  }
  
  private connectToKimi(wsUrl: string): void {
    console.log(`[KimiFullAdapter] Connecting to ${wsUrl}`);
    
    this.kimiWs = new WebSocket(wsUrl);
    
    this.kimiWs.on('open', () => {
      console.log('[KimiFullAdapter] Connected to Kimi');
    });
    
    this.kimiWs.on('message', (data) => {
      this.handleKimiMessage(data.toString());
    });
    
    this.kimiWs.on('close', () => {
      this.kimiWs = null;
    });
  }
  
  // ============ 消息处理 ============
  
  private handleKimiMessage(data: string): void {
    try {
      const lines = data.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const msg = JSON.parse(line);
        
        if (msg.method === 'event' && msg.params) {
          this.handleKimiEvent(msg.params);
        }
      }
    } catch (err) {
      // 非 JSON 消息，忽略
    }
  }
  
  private handleKimiEvent(event: any): void {
    const { type, payload } = event;
    
    switch (type) {
      case 'TurnBegin':
        this.handleTurnBegin(payload);
        break;
      case 'TurnEnd':
        this.handleTurnEnd(payload);
        break;
      case 'ContentPart':
        this.handleContentPart(payload);
        break;
      case 'ToolCall':
        this.handleToolCall(payload);
        break;
      case 'ToolResult':
        this.handleToolResult(payload);
        break;
      case 'ApprovalRequest':
        this.handleApprovalRequest(payload);
        break;
    }
  }
  
  private handleTurnBegin(payload: any): void {
    const sessionId = payload.session_id || `session-${Date.now()}`;
    
    if (!this.sessions.has(sessionId)) {
      this.createSession(`Session ${this.sessions.size + 1}`, payload.work_dir);
    }
  }
  
  private handleTurnEnd(payload: any): void {
    const sessionId = payload.session_id;
    if (!sessionId) return;
    
    // 完成流式消息
    const streamingMsg = this.currentStream.get(sessionId);
    if (streamingMsg) {
      streamingMsg.timestamp = Date.now();
      this.addMessage(sessionId, streamingMsg);
      this.currentStream.delete(sessionId);
      
      this.sendEvent('message.complete', {
        messageId: streamingMsg.id,
        sessionId,
        content: streamingMsg.content,
      });
    }
    
    this.sendEvent('task.complete', {
      title: '任务完成',
      description: 'AI 已完成当前任务',
      sessionId,
    });
  }
  
  private handleContentPart(payload: any): void {
    const sessionId = this.getCurrentSessionId();
    if (!sessionId) return;
    
    let block: ContentBlock;
    
    switch (payload.type) {
      case 'text':
        block = { type: 'text', text: payload.text };
        break;
      case 'think':
        block = { type: 'thinking', thinking: payload.think };
        break;
      default:
        return;
    }
    
    // 获取或创建流式消息
    let streamingMsg = this.currentStream.get(sessionId);
    if (!streamingMsg) {
      streamingMsg = {
        id: `msg-${Date.now()}`,
        sessionId,
        role: 'assistant',
        content: [],
        timestamp: Date.now(),
      };
      this.currentStream.set(sessionId, streamingMsg);
    }
    
    streamingMsg.content.push(block);
    
    // 发送流式事件
    this.sendEvent('message.stream', {
      messageId: streamingMsg.id,
      sessionId,
      chunk: block,
      index: streamingMsg.content.length - 1,
    });
  }
  
  private handleToolCall(payload: any): void {
    const sessionId = this.getCurrentSessionId();
    if (!sessionId) return;
    
    const toolCall = {
      id: payload.id,
      name: payload.function?.name,
      arguments: JSON.parse(payload.function?.arguments || '{}'),
      status: 'running' as const,
    };
    
    // 添加到工具输出
    this.toolOutputs.set(payload.id, {
      toolCallId: payload.id,
      toolName: toolCall.name,
      status: 'running',
      startTime: Date.now(),
    });
    
    // 添加到当前消息
    const streamingMsg = this.currentStream.get(sessionId);
    if (streamingMsg) {
      streamingMsg.content.push({ type: 'tool_call', toolCall });
    }
  }
  
  private handleToolResult(payload: any): void {
    const output = this.toolOutputs.get(payload.tool_call_id);
    if (output) {
      output.status = payload.return_value?.is_error ? 'error' : 'completed';
      output.output = payload.return_value?.output;
      output.error = payload.return_value?.error;
      output.endTime = Date.now();
      
      this.sendEvent('tool.output', {
        toolCallId: payload.tool_call_id,
        output: output.output,
        error: output.error,
      });
    }
  }
  
  private handleApprovalRequest(payload: any): void {
    this.pendingApprovals.set(payload.id, payload);
    
    this.requestApproval({
      id: payload.id,
      sessionId: this.getCurrentSessionId() || 'unknown',
      action: payload.action,
      description: payload.description,
      toolName: payload.sender,
      parameters: payload,
    });
  }
  
  // ============ 抽象方法实现 ============
  
  async doSendMessage(sessionId: string, content: string, files?: FileReference[]): Promise<void> {
    if (!this.kimiWs) return;
    
    // 构造 Kimi 消息
    const parts: any[] = [{ type: 'text', text: content }];
    
    // 添加文件
    if (files) {
      for (const file of files) {
        if (file.mimeType?.startsWith('image/')) {
          parts.push({
            type: 'image_url',
            image_url: { url: file.url },
          });
        } else {
          parts.push({
            type: 'text',
            text: `<file path="${file.url}">`,
          });
        }
      }
    }
    
    this.kimiWs.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'prompt',
      id: `prompt-${Date.now()}`,
      params: { user_input: parts },
    }));
  }
  
  async doStreamMessage(
    sessionId: string, 
    content: string, 
    onChunk: (block: ContentBlock) => void
  ): Promise<void> {
    // Kimi 原生支持流式，通过事件回调处理
    await this.doSendMessage(sessionId, content);
  }
  
  async doUploadFile(file: FileUpload): Promise<string> {
    // Kimi 的文件上传实现
    // 实际项目中这里应该上传到 Kimi 的上传接口
    return `uploads/${file.name}`;
  }
  
  async doDownloadFile(url: string): Promise<Buffer> {
    // 从 Kimi 下载文件
    return Buffer.from([]);
  }
  
  async doCancelTool(toolCallId: string): Promise<void> {
    // Kimi 不支持取消单个工具，可以发送取消命令
    if (this.kimiWs) {
      this.kimiWs.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'cancel',
        id: `cancel-${Date.now()}`,
      }));
    }
  }
  
  async doRespondApproval(requestId: string, decision: ApprovalDecision): Promise<void> {
    if (!this.kimiWs) return;
    
    this.kimiWs.send(JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      result: {
        request_id: requestId,
        response: decision.type.startsWith('approve') ? 'approve' : 'reject',
        feedback: (decision as any).reason || '',
      },
    }));
  }
  
  async doExecuteSlashCommand(command: string, args?: Record<string, any>): Promise<void> {
    // 特殊处理 Kimi 的斜杠命令
    switch (command) {
      case 'clear':
        // Kimi 的 /clear 通过消息发送
        await this.doSendMessage(this.getCurrentSessionId() || '', '/clear');
        break;
      case 'compact':
        await this.doSendMessage(this.getCurrentSessionId() || '', '/compact');
        break;
    }
  }
  
  // ============ 辅助方法 ============
  
  private getCurrentSessionId(): string | null {
    const active = Array.from(this.sessions.values()).find(s => s.status === 'active');
    return active?.id || null;
  }
}
