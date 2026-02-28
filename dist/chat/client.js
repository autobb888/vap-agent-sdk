"use strict";
/**
 * SafeChat WebSocket client for VAP agents.
 * Connects to the platform's Socket.IO chat server.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatClient = void 0;
const socket_io_client_1 = require("socket.io-client");
/** Safely invoke any async/sync callback, catching both sync throws and async rejections */
function safeCall(fn) {
    try {
        const result = fn();
        if (result && typeof result.catch === 'function') {
            result.catch((e) => console.error('[CHAT] Async handler error:', e));
        }
    }
    catch (e) {
        console.error('[CHAT] Handler error:', e);
    }
}
/** Maximum outbound message size (64 KB) */
const MAX_MESSAGE_SIZE = 64 * 1024;
class ChatClient {
    socket = null;
    config;
    joinedRooms = new Set();
    messageHandlers = new Map(); // jobId -> handlers
    globalHandler = null;
    sessionEndingHandler = null;
    sessionExpiringHandler = null;
    jobStatusChangedHandler = null;
    constructor(config) {
        this.config = config;
    }
    /**
     * Connect to the chat server.
     * Gets a one-time token first, then establishes WebSocket.
     */
    async connect() {
        // Clean up any existing socket before reconnecting
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        // Step 1: Get a one-time chat token via REST API
        const tokenController = new AbortController();
        const tokenTimer = setTimeout(() => tokenController.abort(), 15_000);
        let tokenRes;
        try {
            tokenRes = await fetch(`${this.config.vapUrl}/v1/chat/token`, {
                headers: {
                    'Cookie': `verus_session=${this.config.sessionToken}`,
                },
                signal: tokenController.signal,
            });
        }
        catch (err) {
            clearTimeout(tokenTimer);
            if (err.name === 'AbortError') {
                throw new Error('Chat token request timed out after 15s');
            }
            throw err;
        }
        finally {
            clearTimeout(tokenTimer);
        }
        if (!tokenRes.ok) {
            throw new Error(`Failed to get chat token: ${tokenRes.status}`);
        }
        const tokenData = (await tokenRes.json());
        const chatToken = tokenData.data?.token;
        if (!chatToken) {
            throw new Error('No chat token in response');
        }
        // Step 2: Connect Socket.IO with the token
        return new Promise((resolve, reject) => {
            let resolved = false;
            this.socket = (0, socket_io_client_1.io)(this.config.vapUrl, {
                path: '/ws',
                auth: { token: chatToken },
                extraHeaders: {
                    'Cookie': `verus_session=${this.config.sessionToken}`,
                },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 2000,
                reconnectionAttempts: 10,
            });
            // Timeout if connection takes too long
            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.socket?.disconnect();
                    reject(new Error('Chat connection timeout'));
                }
            }, 10000);
            this.socket.on('connect', () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    // Re-join any rooms we were in
                    for (const jobId of this.joinedRooms) {
                        this.socket?.emit('join_job', { jobId });
                    }
                    resolve();
                }
            });
            this.socket.on('disconnect', (reason) => {
                console.log(`[CHAT] Disconnected: ${reason}`);
            });
            this.socket.on('connect_error', (err) => {
                console.error(`[CHAT] Connection error: ${err.message}`);
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    reject(err);
                }
            });
            this.socket.on('message', (msg) => {
                // Snapshot handlers to avoid mutation during iteration
                const handlers = this.messageHandlers.get(msg.jobId);
                if (handlers) {
                    const snapshot = [...handlers];
                    for (const h of snapshot) {
                        safeCall(() => h(msg));
                    }
                }
                // Route to global handler
                const global = this.globalHandler;
                if (global) {
                    safeCall(() => global(msg));
                }
            });
            this.socket.on('joined', (data) => {
                console.log(`[CHAT] Joined room for job ${data.jobId}`);
            });
            this.socket.on('error', (data) => {
                console.error(`[CHAT] Server error: ${data.message}`);
            });
            this.socket.on('reconnect_failed', () => {
                console.error('[CHAT] All reconnection attempts failed — token may be stale. Call connect() again.');
            });
            this.socket.on('session_ending', (data) => {
                const handler = this.sessionEndingHandler;
                if (handler) {
                    safeCall(() => handler(data));
                }
            });
            this.socket.on('session_expiring', (data) => {
                const handler = this.sessionExpiringHandler;
                if (handler) {
                    safeCall(() => handler(data));
                }
            });
            this.socket.on('job_status_changed', (data) => {
                const handler = this.jobStatusChangedHandler;
                if (handler) {
                    safeCall(() => handler(data));
                }
            });
        });
    }
    /**
     * Join a job's chat room.
     */
    joinJob(jobId) {
        this.joinedRooms.add(jobId);
        if (this.socket?.connected) {
            this.socket.emit('join_job', { jobId });
        }
    }
    /**
     * Leave a job's chat room.
     */
    leaveJob(jobId) {
        this.joinedRooms.delete(jobId);
        this.messageHandlers.delete(jobId);
        if (this.socket?.connected) {
            this.socket.emit('leave_job', { jobId });
        }
    }
    /**
     * Send a message in a job chat.
     */
    sendMessage(jobId, content, signature) {
        if (!this.socket?.connected) {
            throw new Error('Not connected to chat');
        }
        const byteLength = new TextEncoder().encode(content).byteLength;
        if (byteLength > MAX_MESSAGE_SIZE) {
            throw new Error(`Message exceeds maximum size of ${MAX_MESSAGE_SIZE} bytes (got ${byteLength})`);
        }
        this.socket.emit('message', { jobId, content, signature });
    }
    /**
     * Register a handler for messages in a specific job.
     */
    onJobMessage(jobId, handler) {
        const existing = this.messageHandlers.get(jobId) || [];
        existing.push(handler);
        this.messageHandlers.set(jobId, existing);
    }
    /**
     * Register a handler for all messages across all jobs.
     */
    onMessage(handler) {
        this.globalHandler = handler;
    }
    /**
     * Register a handler for session ending events.
     * Fired when either party calls POST /v1/jobs/:id/end-session.
     */
    onSessionEnding(handler) {
        this.sessionEndingHandler = handler;
    }
    /**
     * Register a handler for session expiring events.
     * Fired 2 minutes before session timeout.
     */
    onSessionExpiring(handler) {
        this.sessionExpiringHandler = handler;
    }
    /**
     * Register a handler for job status change events.
     * Fired on job state transitions (deliver, complete, etc.).
     */
    onJobStatusChanged(handler) {
        this.jobStatusChangedHandler = handler;
    }
    /**
     * Send a typing indicator.
     */
    sendTyping(jobId) {
        if (this.socket?.connected) {
            this.socket.emit('typing', { jobId });
        }
    }
    /**
     * Mark messages as read.
     */
    markRead(jobId) {
        if (this.socket?.connected) {
            this.socket.emit('read', { jobId });
        }
    }
    /**
     * Check if connected (uses Socket.IO's own state as source of truth).
     */
    get isConnected() {
        return this.socket?.connected ?? false;
    }
    /**
     * Disconnect from chat.
     */
    disconnect() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
        }
        this.socket = null;
        this.joinedRooms.clear();
        this.messageHandlers.clear();
        this.globalHandler = null;
        this.sessionEndingHandler = null;
        this.sessionExpiringHandler = null;
        this.jobStatusChangedHandler = null;
    }
}
exports.ChatClient = ChatClient;
//# sourceMappingURL=client.js.map