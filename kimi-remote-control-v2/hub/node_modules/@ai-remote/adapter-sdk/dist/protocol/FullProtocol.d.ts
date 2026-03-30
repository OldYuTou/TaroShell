/**
 * 完整功能协议规范
 *
 * 目标：支持移动端作为主力操作界面
 * 适用：Kimi、Codex、Claude、OpenCode 等所有适配器
 */
export interface Message {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: ContentBlock[];
    timestamp: number;
    metadata?: {
        model?: string;
        tokens?: number;
        latency?: number;
        [key: string]: any;
    };
}
export type ContentBlock = {
    type: 'text';
    text: string;
} | {
    type: 'thinking';
    thinking: string;
} | {
    type: 'code';
    code: string;
    language?: string;
} | {
    type: 'image';
    url: string;
    mimeType?: string;
} | {
    type: 'file';
    name: string;
    url: string;
    size?: number;
    mimeType?: string;
} | {
    type: 'tool_call';
    toolCall: ToolCall;
} | {
    type: 'tool_result';
    toolResult: ToolResult;
} | {
    type: 'markdown';
    markdown: string;
} | {
    type: 'error';
    error: string;
};
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
    status: 'pending' | 'running' | 'completed' | 'error';
}
export interface ToolResult {
    toolCallId: string;
    output?: string;
    error?: string;
    display?: DisplayBlock[];
}
export interface DisplayBlock {
    type: 'diff' | 'shell' | 'todo' | 'file_tree' | 'mermaid';
    data: any;
}
export interface Session {
    id: string;
    name: string;
    description?: string;
    workDir?: string;
    status: 'active' | 'paused' | 'completed' | 'error';
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    contextUsage?: number;
    maxContextTokens?: number;
    metadata?: {
        gitBranch?: string;
        lastCommand?: string;
        [key: string]: any;
    };
}
export interface ToolOutput {
    toolCallId: string;
    toolName: string;
    status: 'running' | 'completed' | 'error';
    output?: string;
    error?: string;
    display?: DisplayBlock[];
    startTime: number;
    endTime?: number;
}
export interface FileUpload {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    data: Buffer | string;
    sessionId: string;
}
export interface FileReference {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    url: string;
    thumbnailUrl?: string;
}
export interface SlashCommand {
    name: string;
    description: string;
    aliases?: string[];
    args?: CommandArg[];
    handler?: (args: Record<string, any>) => Promise<void>;
}
export interface CommandArg {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'file';
    required?: boolean;
    description?: string;
    default?: any;
}
export interface StreamChunk {
    messageId: string;
    sessionId: string;
    chunk: ContentBlock;
    index: number;
    isComplete: boolean;
}
export interface HistorySync {
    sessionId: string;
    messages: Message[];
    cursor?: string;
    hasMore: boolean;
}
export type ProtocolMethod = 'message.send' | 'message.stream' | 'message.edit' | 'message.delete' | 'session.create' | 'session.list' | 'session.get' | 'session.switch' | 'session.rename' | 'session.delete' | 'session.clear' | 'session.fork' | 'history.sync' | 'history.get' | 'file.upload' | 'file.download' | 'file.delete' | 'file.list' | 'tool.output' | 'tool.cancel' | 'approval.request' | 'approval.respond' | 'commands.list' | 'command.execute' | 'status.get' | 'config.get' | 'config.set';
export interface ProtocolMessage {
    id: string;
    method: ProtocolMethod;
    payload: any;
    timestamp: number;
}
export interface ProtocolResponse {
    id: string;
    success: boolean;
    data?: any;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}
export interface IFullFeatureAdapter {
    sendMessage(sessionId: string, content: string, files?: FileReference[]): Promise<Message>;
    streamMessage(sessionId: string, content: string, onChunk: (chunk: StreamChunk) => void): Promise<void>;
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
    downloadFile(fileId: string): Promise<Buffer>;
    deleteFile(fileId: string): Promise<void>;
    listFiles(sessionId: string): Promise<FileReference[]>;
    getToolOutput(toolCallId: string): Promise<ToolOutput>;
    cancelTool(toolCallId: string): Promise<void>;
    requestApproval(request: ApprovalRequest): Promise<void>;
    respondApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
    listSlashCommands(): Promise<SlashCommand[]>;
    executeSlashCommand(command: string, args?: Record<string, any>): Promise<void>;
    getStatus(): Promise<AdapterStatus>;
    getConfig(): Promise<AdapterConfig>;
    setConfig(config: Partial<AdapterConfig>): Promise<void>;
}
export interface ApprovalRequest {
    id: string;
    sessionId: string;
    action: string;
    description: string;
    toolName?: string;
    parameters?: Record<string, any>;
    timeout?: number;
}
export type ApprovalDecision = {
    type: 'approve';
} | {
    type: 'deny';
    reason?: string;
} | {
    type: 'approve_once';
} | {
    type: 'approve_session';
};
export interface AdapterStatus {
    connected: boolean;
    sessionId?: string;
    currentTask?: string;
    queueLength?: number;
    contextUsage?: number;
}
export interface AdapterConfig {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    contextWindow?: number;
    approvalMode?: 'always' | 'never' | 'sensitive';
    [key: string]: any;
}
