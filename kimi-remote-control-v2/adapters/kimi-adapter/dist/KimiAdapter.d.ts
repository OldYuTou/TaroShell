/**
 * Kimi Code CLI 适配器
 *
 * 功能：
 * 1. 连接到 Kimi CLI 的 WebSocket 服务器
 * 2. 将 Kimi 事件转换为统一格式
 * 3. 将手机命令转换为 Kimi 命令
 */
import { BaseAdapter, UnifiedCommand, EventType, CommandType } from '@ai-remote/adapter-sdk';
export declare class KimiAdapter extends BaseAdapter {
    readonly name = "kimi";
    readonly version = "1.0.0";
    readonly supportedEvents: EventType[];
    readonly supportedCommands: CommandType[];
    private kimiProcess;
    private kimiWs;
    private pendingApprovals;
    private sessionId;
    protected onInitialize(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onHubConnect(): void;
    protected onHubDisconnect(): void;
    private startKimiProcess;
    private connectToKimi;
    private handleKimiMessage;
    private handleKimiEvent;
    private handleKimiRequest;
    protected onCommand(command: UnifiedCommand): Promise<void>;
    private handleApprovalResponse;
    private handleCancelTask;
    private handleSendMessage;
}
