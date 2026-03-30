"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FullFeatureAdapter = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const BaseAdapter_1 = require("./BaseAdapter");
class FullFeatureAdapter extends BaseAdapter_1.BaseAdapter {
    constructor() {
        super(...arguments);
        // 数据存储
        this.sessions = new Map();
        this.messages = new Map(); // sessionId -> messages
        this.files = new Map();
        this.toolOutputs = new Map();
        this.slashCommands = new Map();
        this.currentStream = new Map(); // sessionId -> streaming message
        // 事件发射器（用于内部通信）
        this.internalEvents = new events_1.EventEmitter();
    }
    // ============ 生命周期 ============
    async onHubConnect() {
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
    async sendMessage(sessionId, content, files) {
        // 创建用户消息
        const userMessage = {
            id: (0, uuid_1.v4)(),
            sessionId,
            role: 'user',
            content: [
                { type: 'text', text: content },
                ...(files?.map(f => ({ type: 'file', name: f.name, url: f.url, mimeType: f.mimeType, size: f.size })) || []),
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
    async streamMessage(sessionId, content, onChunk) {
        const messageId = (0, uuid_1.v4)();
        let index = 0;
        // 创建流式消息占位
        const streamingMessage = {
            id: messageId,
            sessionId,
            role: 'assistant',
            content: [],
            timestamp: Date.now(),
        };
        this.currentStream.set(sessionId, streamingMessage);
        // 开始流式传输
        await this.doStreamMessage(sessionId, content, (block) => {
            const chunk = {
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
    async editMessage(messageId, newContent) {
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
    async deleteMessage(messageId) {
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
    async createSession(name, workDir) {
        const session = {
            id: (0, uuid_1.v4)(),
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
    async listSessions() {
        return Array.from(this.sessions.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }
    async getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error(`Session not found: ${sessionId}`);
        return session;
    }
    async switchSession(sessionId) {
        const session = await this.getSession(sessionId);
        session.status = 'active';
        session.updatedAt = Date.now();
        this.sendEvent('session.switched', { sessionId });
    }
    async renameSession(sessionId, newName) {
        const session = await this.getSession(sessionId);
        session.name = newName;
        session.updatedAt = Date.now();
        this.sendEvent('session.renamed', { sessionId, newName });
    }
    async deleteSession(sessionId) {
        this.sessions.delete(sessionId);
        this.messages.delete(sessionId);
        this.sendEvent('session.deleted', { sessionId });
    }
    async clearSession(sessionId) {
        this.messages.set(sessionId, []);
        const session = this.sessions.get(sessionId);
        if (session) {
            session.messageCount = 0;
            session.updatedAt = Date.now();
        }
        this.sendEvent('session.cleared', { sessionId });
    }
    async forkSession(sessionId, messageId) {
        const original = await this.getSession(sessionId);
        const newSession = await this.createSession(`Fork of ${original.name}`, original.workDir);
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
    async syncHistory(sessionId, cursor, limit = 50) {
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
    async getHistory(sessionId) {
        return this.messages.get(sessionId) || [];
    }
    // ============ 文件操作 ============
    async uploadFile(file) {
        const ref = {
            id: (0, uuid_1.v4)(),
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
    async downloadFile(fileId) {
        const file = this.files.get(fileId);
        if (!file)
            throw new Error(`File not found: ${fileId}`);
        return this.doDownloadFile(file.url);
    }
    async deleteFile(fileId) {
        this.files.delete(fileId);
        this.sendEvent('file.deleted', { fileId });
    }
    async listFiles(sessionId) {
        return Array.from(this.files.values());
    }
    // ============ 工具操作 ============
    async getToolOutput(toolCallId) {
        const output = this.toolOutputs.get(toolCallId);
        if (!output)
            throw new Error(`Tool output not found: ${toolCallId}`);
        return output;
    }
    async cancelTool(toolCallId) {
        await this.doCancelTool(toolCallId);
        const output = this.toolOutputs.get(toolCallId);
        if (output) {
            output.status = 'error';
            output.endTime = Date.now();
        }
        this.sendEvent('tool.cancelled', { toolCallId });
    }
    // ============ 审批操作 ============
    async requestApproval(request) {
        this.sendEvent('approval.request', {
            requestId: request.id,
            sessionId: request.sessionId,
            action: request.action,
            description: request.description,
            toolName: request.toolName,
            parameters: request.parameters,
        });
    }
    async respondApproval(requestId, decision) {
        await this.doRespondApproval(requestId, decision);
        this.sendEvent(decision.type.startsWith('approve') ? 'approval.granted' : 'approval.denied', {
            requestId,
            decision: decision.type,
            reason: decision.reason,
        });
    }
    // ============ 斜杠命令 ============
    async listSlashCommands() {
        return Array.from(this.slashCommands.values());
    }
    async executeSlashCommand(command, args) {
        const cmd = this.slashCommands.get(command);
        if (!cmd)
            throw new Error(`Unknown command: ${command}`);
        if (cmd.handler) {
            await cmd.handler(args || {});
        }
        else {
            await this.doExecuteSlashCommand(command, args);
        }
        this.sendEvent('command.executed', { command, args });
    }
    // ============ 辅助方法 ============
    addMessage(sessionId, message) {
        if (!this.messages.has(sessionId)) {
            this.messages.set(sessionId, []);
        }
        this.messages.get(sessionId).push(message);
        const session = this.sessions.get(sessionId);
        if (session) {
            session.messageCount = this.messages.get(sessionId).length;
            session.updatedAt = Date.now();
        }
    }
    emitMessageEvent(message) {
        this.sendEvent('message.received', {
            messageId: message.id,
            sessionId: message.sessionId,
            role: message.role,
            content: message.content,
        });
    }
    // ============ 命令处理 ============
    async onCommand(command) {
        const { type, payload } = command;
        switch (type) {
            case 'message.send':
                await this.sendMessage(payload.sessionId, payload.content, payload.files);
                break;
            case 'message.stream':
                await this.streamMessage(payload.sessionId, payload.content, () => { });
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
exports.FullFeatureAdapter = FullFeatureAdapter;
