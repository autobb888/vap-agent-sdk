"use strict";
/**
 * SafeChat WebSocket client for VAP agents.
 * Connects to the platform's Socket.IO chat server.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatClient = void 0;
const socket_io_client_1 = require("socket.io-client");
class ChatClient {
    socket = null;
    config;
    joinedRooms = new Set();
    messageHandlers = new Map(); // jobId -> handlers
    globalHandler = null;
    connected = false;
    constructor(config) {
        this.config = config;
    }
    /**
     * Connect to the chat server.
     * Gets a one-time token first, then establishes WebSocket.
     */
    async connect() {
        // Step 1: Get a one-time chat token via REST API
        const tokenRes = await fetch(`${this.config.vapUrl}/v1/chat/token`, {
            headers: {
                'Cookie': `verus_session=${this.config.sessionToken}`,
            },
        });
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
            this.socket.on('connect', () => {
                this.connected = true;
                // Re-join any rooms we were in
                for (const jobId of this.joinedRooms) {
                    this.socket.emit('join_job', { jobId });
                }
                resolve();
            });
            this.socket.on('disconnect', (reason) => {
                this.connected = false;
                console.log(`[CHAT] Disconnected: ${reason}`);
            });
            this.socket.on('connect_error', (err) => {
                console.error(`[CHAT] Connection error: ${err.message}`);
                if (!this.connected) {
                    reject(err);
                }
            });
            this.socket.on('message', (msg) => {
                // Route to job-specific handlers
                const handlers = this.messageHandlers.get(msg.jobId);
                if (handlers) {
                    for (const h of handlers) {
                        try {
                            h(msg);
                        }
                        catch (e) {
                            console.error('[CHAT] Handler error:', e);
                        }
                    }
                }
                // Route to global handler
                if (this.globalHandler) {
                    try {
                        this.globalHandler(msg);
                    }
                    catch (e) {
                        console.error('[CHAT] Handler error:', e);
                    }
                }
            });
            this.socket.on('joined', (data) => {
                console.log(`[CHAT] Joined room for job ${data.jobId}`);
            });
            this.socket.on('error', (data) => {
                console.error(`[CHAT] Server error: ${data.message}`);
            });
            // Timeout if connection takes too long
            setTimeout(() => {
                if (!this.connected) {
                    this.socket?.disconnect();
                    reject(new Error('Chat connection timeout'));
                }
            }, 10000);
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
            this.socket.emit('mark_read', { jobId });
        }
    }
    /**
     * Check if connected.
     */
    get isConnected() {
        return this.connected;
    }
    /**
     * Disconnect from chat.
     */
    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
        this.connected = false;
        this.joinedRooms.clear();
        this.messageHandlers.clear();
    }
}
exports.ChatClient = ChatClient;
//# sourceMappingURL=client.js.map