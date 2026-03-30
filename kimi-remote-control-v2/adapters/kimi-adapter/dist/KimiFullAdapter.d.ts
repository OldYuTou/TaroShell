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
import { FullFeatureAdapter, FileUpload, FileReference, ContentBlock, ApprovalDecision } from '@ai-remote/adapter-sdk';
export declare class KimiFullAdapter extends FullFeatureAdapter {
    readonly name = "kimi";
    readonly version = "2.0.0";
    readonly supportedEvents: string[];
    readonly supportedCommands: string[];
    private kimiProcess;
    private kimiWs;
    private pendingApprovals;
    protected onInitialize(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onHubConnect(): Promise<void>;
    private startKimiProcess;
    private connectToKimi;
    private handleKimiMessage;
    private handleKimiEvent;
    private handleTurnBegin;
    private handleTurnEnd;
    private handleContentPart;
    private handleToolCall;
    private handleToolResult;
    private handleApprovalRequest;
    doSendMessage(sessionId: string, content: string, files?: FileReference[]): Promise<void>;
    doStreamMessage(sessionId: string, content: string, onChunk: (block: ContentBlock) => void): Promise<void>;
    doUploadFile(file: FileUpload): Promise<string>;
    doDownloadFile(url: string): Promise<Buffer>;
    doCancelTool(toolCallId: string): Promise<void>;
    doRespondApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
    doExecuteSlashCommand(command: string, args?: Record<string, any>): Promise<void>;
    private getCurrentSessionId;
}
