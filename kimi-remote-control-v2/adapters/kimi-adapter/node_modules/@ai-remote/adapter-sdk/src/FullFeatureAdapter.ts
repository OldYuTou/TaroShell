/**
 * 完整功能适配器基类
 * 
 * 支持：
 * - 实时对话流
 * - 完整历史记录
 * - 多会话管理
 * - 工具输出
 * - 文件上传/预览
 * - 斜杠命令
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { UnifiedEvent, EventType } from './types';
import {
  IFullFeatureAdapter,
  Message,
  ContentBlock,
  Session,
  StreamChunk,
  FileUpload,
  FileReference,
  ToolOutput,
  SlashCommand,
  HistorySync,
  ApprovalRequest,
  ApprovalDecision,
  ProtocolMessage,
  ProtocolResponse,
  ProtocolMethod,
} from './protocol/FullProtocol';

export abstract class FullFeatureAdapter extends BaseAdapter implements IFullFeatureAdapter {
  // 数据存储
  protected sessions: Map<string, Session> = new Map();
  protected messages: Map<string, Message[]> = new Map(); // sessionId -> messages
  protected files: Map<string, FileReference> = new Map();
  protected toolOutputs: Map<string, ToolOutput> = new Map();
  protected slashCommands: Map<string, SlashCommand> = new Map();
  protected currentStream: Map<string, Message> = new Map(); // sessionId -> streaming message
  
  // 事件发射器（用于内部通信）
  protected internalEvents = new EventEmitter();
  
  // ============ 生命周期 ============
  
  protected async onHubConnect(): Promise<void> {
    // 同步斜杠命令
    const commands = await this.listSlashCommands();
    for (const cmd of commands) {
      this.slashCommands.set(cmd.name, cmd);
    }
    
    // 通知手机端适配器已就绪
    this.sendEvent('system.notification', {
      title: '适配器已连接',
      description: `${this.name} 已就绪，支持 ${commands.length} 个斜杠命令`,
    });
  }
  
  // ============ 消息操作 ============
  
  async sendMessage(sessionId: string, content: string, files?: FileReference[]): Promise<Message> {
    // 创建用户消息
    const userMessage: Message = {
      id: uuidv4(),
      sessionId,
      role: 'user',
      content: [
        { type: 'text', text: content },
        ...(files?.map(f => ({ type: 'file' as const, name: f.name, url: f.url, mimeType: f.mimeType, size: f.size })) || []),
      ],
      timestamp: Date.now(),
    };
    
    this.addMessage(sessionId, userMessage);
    
    // 通知手机端
    this.emitMessageEvent(userMessage);
    
    // 发送到 AI 工具
    await this.doSendMessage(sessionId, content, files);
    
    return userMessage;
  }
  
  abstract doSendMessage(sessionId: string, content: string, files?: FileReference[]): Promise<void>;
  
  async streamMessage(
    sessionId: string, 
    content: string, 
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const messageId = uuidv4();
    let index = 0;
    
    // 创建流式消息占位
    const streamingMessage: Message = {
      id: messageId,
      sessionId,
      role: 'assistant',
      content: [],
      timestamp: Date.now(),
    };
    
    this.currentStream.set(sessionId, streamingMessage);
    
    // 开始流式传输
    await this.doStreamMessage(sessionId, content, (block) => {
      const chunk: StreamChunk = {
        messageId,
        sessionId,
        chunk: block,
        index: index++,
        isComplete: false,
      };
      
      // 追加到消息
      streamingMessage.content.push(block);
      
      // 回调
      onChunk(chunk);
      
      // 发送事件到手机
      this.sendEvent('message.stream', {
        messageId,
        sessionId,
        chunk: block,
        index,
      });
    });
    
    // 流完成
    streamingMessage.timestamp = Date.now();
    this.addMessage(sessionId, streamingMessage);
    this.currentStream.delete(sessionId);
    
    // 发送完成事件
    this.sendEvent('message.complete', {
      messageId,
      sessionId,
      content: streamingMessage.content,
    });
  }
  
  abstract doStreamMessage(
    sessionId: string, 
    content: string, 
    onChunk: (block: ContentBlock) => void
  ): Promise<void>;
  
  async editMessage(messageId: string, newContent: string): Promise<Message> {
    // 找到消息并编辑
    for (const [sessionId, messages] of this.messages) {
      const index = messages.findIndex(m => m.id === messageId);
      if (index >= 0) {
        messages[index] = {
          ...messages[index],
          content: [{ type: 'text', text: newContent }],
          timestamp: Date.now(),
        };
        
        this.emitMessageEvent(messages[index]);
        return messages[index];
      }
    }
    
    throw new Error(`Message not found: ${messageId}`);
  }
  
  async deleteMessage(messageId: string): Promise<void> {
    for (const [sessionId, messages] of this.messages) {
      const index = messages.findIndex(m => m.id === messageId);
      if (index >= 0) {
        messages.splice(index, 1);
        this.sendEvent('message.deleted', { messageId, sessionId });
        return;
      }
    }
  }
  
  // ============ 会话操作 ============
  
  async createSession(name?: string, workDir?: string): Promise<Session> {
    const session: Session = {
      id: uuidv4(),
      name: name || `Session ${this.sessions.size + 1}`,
      workDir: workDir || this.getConfig()?.toolConfig.workDir,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    };
    
    this.sessions.set(session.id, session);
    this.messages.set(session.id, []);
    
    // 通知手机端
    this.sendEvent('session.created', {
      sessionId: session.id,
      name: session.name,
      workDir: session.workDir,
    });
    
    return session;
  }
  
  async listSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  
  async getSession(sessionId: string): Promise<Session> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return session;
  }
  
  async switchSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    session.status = 'active';
    session.updatedAt = Date.now();
    
    this.sendEvent('session.switched', { sessionId });
  }
  
  async renameSession(sessionId: string, newName: string): Promise<void> {
    const session = await this.getSession(sessionId);
    session.name = newName;
    session.updatedAt = Date.now();
    
    this.sendEvent('session.renamed', { sessionId, newName });
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
    
    this.sendEvent('session.deleted', { sessionId });
  }
  
  async clearSession(sessionId: string): Promise<void> {
    this.messages.set(sessionId, []);
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount = 0;
      session.updatedAt = Date.now();
    }
    
    this.sendEvent('session.cleared', { sessionId });
  }
  
  async forkSession(sessionId: string, messageId?: string): Promise<Session> {
    const original = await this.getSession(sessionId);
    const newSession = await this.createSession(
      `Fork of ${original.name}`,
      original.workDir
    );
    
    // 复制消息（到指定 messageId 或全部）
    const messages = this.messages.get(sessionId) || [];
    let messagesToCopy = messages;
    
    if (messageId) {
      const index = messages.findIndex(m => m.id === messageId);
      if (index >= 0) {
        messagesToCopy = messages.slice(0, index + 1);
      }
    }
    
    this.messages.set(newSession.id, [...messagesToCopy]);
    newSession.messageCount = messagesToCopy.length;
    
    this.sendEvent('session.forked', {
      originalSessionId: sessionId,
      newSessionId: newSession.id,
      messageId,
    });
    
    return newSession;
  }
  
  // ============ 历史记录 ============
  
  async syncHistory(sessionId: string, cursor?: string, limit: number = 50): Promise<HistorySync> {
    const messages = this.messages.get(sessionId) || [];
    
    // 简单的分页实现
    const startIndex = cursor ? parseInt(cursor) : 0;
    const endIndex = Math.min(startIndex + limit, messages.length);
    const page = messages.slice(startIndex, endIndex);
    
    return {
      sessionId,
      messages: page,
      cursor: endIndex < messages.length ? String(endIndex) : undefined,
      hasMore: endIndex < messages.length,
    };
  }
  
  async getHistory(sessionId: string): Promise<Message[]> {
    return this.messages.get(sessionId) || [];
  }
  
  // ============ 文件操作 ============
  
  async uploadFile(file: FileUpload): Promise<FileReference> {
    const ref: FileReference = {
      id: uuidv4(),
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      url: await this.doUploadFile(file),
    };
    
    this.files.set(ref.id, ref);
    
    this.sendEvent('file.uploaded', {
      fileId: ref.id,
      name: ref.name,
      sessionId: file.sessionId,
    });
    
    return ref;
  }
  
  abstract doUploadFile(file: FileUpload): Promise<string>;
  
  async downloadFile(fileId: string): Promise<Buffer> {
    const file = this.files.get(fileId);
    if (!file) throw new Error(`File not found: ${fileId}`);
    
    return this.doDownloadFile(file.url);
  }
  
  abstract doDownloadFile(url: string): Promise<Buffer>;
  
  async deleteFile(fileId: string): Promise<void> {
    this.files.delete(fileId);
    this.sendEvent('file.deleted', { fileId });
  }
  
  async listFiles(sessionId: string): Promise<FileReference[]> {
    return Array.from(this.files.values());
  }
  
  // ============ 工具操作 ============
  
  async getToolOutput(toolCallId: string): Promise<ToolOutput> {
    const output = this.toolOutputs.get(toolCallId);
    if (!output) throw new Error(`Tool output not found: ${toolCallId}`);
    return output;
  }
  
  async cancelTool(toolCallId: string): Promise<void> {
    await this.doCancelTool(toolCallId);
    
    const output = this.toolOutputs.get(toolCallId);
    if (output) {
      output.status = 'error';
      output.endTime = Date.now();
    }
    
    this.sendEvent('tool.cancelled', { toolCallId });
  }
  
  abstract doCancelTool(toolCallId: string): Promise<void>;
  
  // ============ 审批操作 ============
  
  async requestApproval(request: ApprovalRequest): Promise<void> {
    this.sendEvent('approval.request', {
      requestId: request.id,
      sessionId: request.sessionId,
      action: request.action,
      description: request.description,
      toolName: request.toolName,
      parameters: request.parameters,
    });
  }
  
  async respondApproval(requestId: string, decision: ApprovalDecision): Promise<void> {
    await this.doRespondApproval(requestId, decision);
    
    this.sendEvent(decision.type.startsWith('approve') ? 'approval.granted' : 'approval.denied', {
      requestId,
      decision: decision.type,
      reason: (decision as any).reason,
    });
  }
  
  abstract doRespondApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
  
  // ============ 斜杠命令 ============
  
  async listSlashCommands(): Promise<SlashCommand[]> {
    return Array.from(this.slashCommands.values());
  }
  
  async executeSlashCommand(command: string, args?: Record<string, any>): Promise<void> {
    const cmd = this.slashCommands.get(command);
    if (!cmd) throw new Error(`Unknown command: ${command}`);
    
    if (cmd.handler) {
      await cmd.handler(args || {});
    } else {
      await this.doExecuteSlashCommand(command, args);
    }
    
    this.sendEvent('command.executed', { command, args });
  }
  
  abstract doExecuteSlashCommand(command: string, args?: Record<string, any>): Promise<void>;
  
  // ============ 辅助方法 ============
  
  protected addMessage(sessionId: string, message: Message): void {
    if (!this.messages.has(sessionId)) {
      this.messages.set(sessionId, []);
    }
    this.messages.get(sessionId)!.push(message);
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount = this.messages.get(sessionId)!.length;
      session.updatedAt = Date.now();
    }
  }
  
  protected emitMessageEvent(message: Message): void {
    this.sendEvent('message.received', {
      messageId: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
    });
  }
  
  // ============ 命令处理 ============
  
  protected async onCommand(command: any): Promise<void> {
    const { type, payload } = command;
    
    switch (type) {
      case 'message.send':
        await this.sendMessage(payload.sessionId, payload.content, payload.files);
        break;
        
      case 'message.stream':
        await this.streamMessage(payload.sessionId, payload.content, () => {});
        break;
        
      case 'session.create':
        await this.createSession(payload.name, payload.workDir);
        break;
        
      case 'session.switch':
        await this.switchSession(payload.sessionId);
        break;
        
      case 'history.sync':
        await this.syncHistory(payload.sessionId, payload.cursor, payload.limit);
        break;
        
      case 'file.upload':
        await this.uploadFile(payload.file);
        break;
        
      case 'command.execute':
        await this.executeSlashCommand(payload.command, payload.args);
        break;
        
      default:
        console.warn(`Unknown command type: ${type}`);
    }
  }
}
