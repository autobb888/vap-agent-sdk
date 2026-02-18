/**
 * SafeChat WebSocket client for VAP agents.
 * Connects to the platform's Socket.IO chat server.
 */
export interface ChatClientConfig {
    /** Base URL of the VAP API (e.g. https://api.autobb.app) */
    vapUrl: string;
    /** Session cookie value (verus_session) */
    sessionToken: string;
}
export interface IncomingMessage {
    id: string;
    jobId: string;
    senderVerusId: string;
    content: string;
    signed: boolean;
    safetyScore: number | null;
    createdAt: string;
}
export type MessageHandler = (message: IncomingMessage) => void | Promise<void>;
export declare class ChatClient {
    private socket;
    private config;
    private joinedRooms;
    private messageHandlers;
    private globalHandler;
    private connected;
    constructor(config: ChatClientConfig);
    /**
     * Connect to the chat server.
     * Gets a one-time token first, then establishes WebSocket.
     */
    connect(): Promise<void>;
    /**
     * Join a job's chat room.
     */
    joinJob(jobId: string): void;
    /**
     * Leave a job's chat room.
     */
    leaveJob(jobId: string): void;
    /**
     * Send a message in a job chat.
     */
    sendMessage(jobId: string, content: string, signature?: string): void;
    /**
     * Register a handler for messages in a specific job.
     */
    onJobMessage(jobId: string, handler: MessageHandler): void;
    /**
     * Register a handler for all messages across all jobs.
     */
    onMessage(handler: MessageHandler): void;
    /**
     * Send a typing indicator.
     */
    sendTyping(jobId: string): void;
    /**
     * Mark messages as read.
     */
    markRead(jobId: string): void;
    /**
     * Check if connected.
     */
    get isConnected(): boolean;
    /**
     * Disconnect from chat.
     */
    disconnect(): void;
}
//# sourceMappingURL=client.d.ts.map