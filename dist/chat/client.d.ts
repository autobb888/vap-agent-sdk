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
export interface SessionEndingEvent {
    jobId: string;
    requestedBy: string;
    reason: string;
    timestamp: string;
}
export interface SessionExpiringEvent {
    jobId: string;
    expiresAt: string;
    remainingSeconds: number;
}
export interface JobStatusChangedEvent {
    jobId: string;
    status: string;
    reason?: string;
}
export interface ReviewReceivedEvent {
    inboxId: string;
    jobHash: string;
    rating: number | null;
    buyerVerusId: string;
}
export type MessageHandler = (message: IncomingMessage) => void | Promise<void>;
export type SessionEndingHandler = (event: SessionEndingEvent) => void | Promise<void>;
export type SessionExpiringHandler = (event: SessionExpiringEvent) => void | Promise<void>;
export type JobStatusChangedHandler = (event: JobStatusChangedEvent) => void | Promise<void>;
export type ReviewReceivedHandler = (event: ReviewReceivedEvent) => void | Promise<void>;
export declare class ChatClient {
    private socket;
    private config;
    private joinedRooms;
    private messageHandlers;
    private globalHandler;
    private sessionEndingHandler;
    private sessionExpiringHandler;
    private jobStatusChangedHandler;
    private reviewReceivedHandler;
    /** Callback invoked when auto-reconnect fails permanently (S4) */
    onReconnectFailed: ((error: Error) => void) | null;
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
     * Register a handler for session ending events.
     * Fired when either party calls POST /v1/jobs/:id/end-session.
     */
    onSessionEnding(handler: SessionEndingHandler): void;
    /**
     * Register a handler for session expiring events.
     * Fired 2 minutes before session timeout.
     */
    onSessionExpiring(handler: SessionExpiringHandler): void;
    /**
     * Register a handler for job status change events.
     * Fired on job state transitions (deliver, complete, etc.).
     */
    onJobStatusChanged(handler: JobStatusChangedHandler): void;
    /**
     * Register a handler for review received events.
     * Fired when a buyer submits a review that goes to the agent's inbox.
     */
    onReviewReceived(handler: ReviewReceivedHandler): void;
    /**
     * Send a typing indicator.
     */
    sendTyping(jobId: string): void;
    /**
     * Mark messages as read.
     */
    markRead(jobId: string): void;
    /**
     * Check if connected (uses Socket.IO's own state as source of truth).
     */
    get isConnected(): boolean;
    /**
     * Disconnect from chat.
     */
    disconnect(): void;
}
//# sourceMappingURL=client.d.ts.map