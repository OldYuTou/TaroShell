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
import { BaseAdapter } from './BaseAdapter';
import { IFullFeatureAdapter, Message, ContentBlock, Session, StreamChunk, FileUpload, FileReference, ToolOutput, SlashCommand, HistorySync, ApprovalRequest, ApprovalDecision } from './protocol/FullProtocol';
export declare abstract class FullFeatureAdapter extends BaseAdapter implements IFullFeatureAdapter {
    protected sessions: Map<string, Session>;
    protected messages: Map<string, Message[]>;
    protected files: Map<string, FileReference>;
    protected toolOutputs: Map<string, ToolOutput>;
    protected slashCommands: Map<string, SlashCommand>;
    protected currentStream: Map<string, Message>;
    protected internalEvents: EventEmitter<[never]>;
    protected onHubConnect(): Promise<void>;
    sendMessage(sessionId: string, content: string, files?: FileReference[]): Promise<Message>;
    abstract doSendMessage(sessionId: string, content: string, files?: FileReference[]): Promise<void>;
    streamMessage(sessionId: string, content: string, onChunk: (chunk: StreamChunk) => void): Promise<void>;
    abstract doStreamMessage(sessionId: string, content: string, onChunk: (block: ContentBlock) => void): Promise<void>;
    editMessage(messageId: string, newContent: string): Promise<Message>;
    deleteMessage(messageId: string): Promise<void>;
    createSession(name?: string, workDir?: string): Promise<Session>;
    listSessions(): Promise<Session[]>;
    getSession(sessionId: string): Promise<Session>;
    switchSession(sessionId: string): Promise<void>;
    renameSession(sessionId: string, newName: string): Promise<void>;
    deleteSession(sessionId: string): Promise<void>;
    clearSession(sessionId: string): Promise<void>;
    forkSession(sessionId: string, messageId?: string): Promise<Session>;
    syncHistory(sessionId: string, cursor?: string, limit?: number): Promise<HistorySync>;
    getHistory(sessionId: string): Promise<Message[]>;
    uploadFile(file: FileUpload): Promise<FileReference>;
    abstract doUploadFile(file: FileUpload): Promise<string>;
    downloadFile(fileId: string): Promise<Buffer>;
    abstract doDownloadFile(url: string): Promise<Buffer>;
    deleteFile(fileId: string): Promise<void>;
    listFiles(sessionId: string): Promise<FileReference[]>;
    getToolOutput(toolCallId: string): Promise<ToolOutput>;
    cancelTool(toolCallId: string): Promise<void>;
    abstract doCancelTool(toolCallId: string): Promise<void>;
    requestApproval(request: ApprovalRequest): Promise<void>;
    respondApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
    abstract doRespondApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
    listSlashCommands(): Promise<SlashCommand[]>;
    executeSlashCommand(command: string, args?: Record<string, any>): Promise<void>;
    abstract doExecuteSlashCommand(command: string, args?: Record<string, any>): Promise<void>;
    protected addMessage(sessionId: string, message: Message): void;
    protected emitMessageEvent(message: Message): void;
    protected onCommand(command: any): Promise<void>;
}
