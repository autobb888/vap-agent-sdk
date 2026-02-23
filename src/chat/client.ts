/**
 * SafeChat WebSocket client for VAP agents.
 * Connects to the platform's Socket.IO chat server.
 */

import { io, Socket } from 'socket.io-client';

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

/** Safely invoke a message handler, catching both sync throws and async rejections */
function safeCallHandler(handler: MessageHandler, msg: IncomingMessage): void {
  try {
    const result = handler(msg);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch((e) => console.error('[CHAT] Async handler error:', e));
    }
  } catch (e) {
    console.error('[CHAT] Handler error:', e);
  }
}

/** Maximum outbound message size (64 KB) */
const MAX_MESSAGE_SIZE = 64 * 1024;

export class ChatClient {
  private socket: Socket | null = null;
  private config: ChatClientConfig;
  private joinedRooms = new Set<string>();
  private messageHandlers = new Map<string, MessageHandler[]>(); // jobId -> handlers
  private globalHandler: MessageHandler | null = null;

  constructor(config: ChatClientConfig) {
    this.config = config;
  }

  /**
   * Connect to the chat server.
   * Gets a one-time token first, then establishes WebSocket.
   */
  async connect(): Promise<void> {
    // Clean up any existing socket before reconnecting
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Step 1: Get a one-time chat token via REST API
    const tokenRes = await fetch(`${this.config.vapUrl}/v1/chat/token`, {
      headers: {
        'Cookie': `verus_session=${this.config.sessionToken}`,
      },
    });

    if (!tokenRes.ok) {
      throw new Error(`Failed to get chat token: ${tokenRes.status}`);
    }

    const tokenData = (await tokenRes.json()) as { data?: { token?: string } };
    const chatToken = tokenData.data?.token;
    if (!chatToken) {
      throw new Error('No chat token in response');
    }

    // Step 2: Connect Socket.IO with the token
    return new Promise((resolve, reject) => {
      let resolved = false;

      this.socket = io(this.config.vapUrl, {
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

      this.socket.on('disconnect', (reason: string) => {
        console.log(`[CHAT] Disconnected: ${reason}`);
      });

      this.socket.on('connect_error', (err: Error) => {
        console.error(`[CHAT] Connection error: ${err.message}`);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          reject(err);
        }
      });

      this.socket.on('message', (msg: IncomingMessage) => {
        // Snapshot handlers to avoid mutation during iteration
        const handlers = this.messageHandlers.get(msg.jobId);
        if (handlers) {
          const snapshot = [...handlers];
          for (const h of snapshot) {
            safeCallHandler(h, msg);
          }
        }
        // Route to global handler
        if (this.globalHandler) {
          safeCallHandler(this.globalHandler, msg);
        }
      });

      this.socket.on('joined', (data: { jobId: string; room: string }) => {
        console.log(`[CHAT] Joined room for job ${data.jobId}`);
      });

      this.socket.on('error', (data: { message: string }) => {
        console.error(`[CHAT] Server error: ${data.message}`);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('[CHAT] All reconnection attempts failed — token may be stale. Call connect() again.');
      });
    });
  }

  /**
   * Join a job's chat room.
   */
  joinJob(jobId: string): void {
    this.joinedRooms.add(jobId);
    if (this.socket?.connected) {
      this.socket.emit('join_job', { jobId });
    }
  }

  /**
   * Leave a job's chat room.
   */
  leaveJob(jobId: string): void {
    this.joinedRooms.delete(jobId);
    this.messageHandlers.delete(jobId);
    if (this.socket?.connected) {
      this.socket.emit('leave_job', { jobId });
    }
  }

  /**
   * Send a message in a job chat.
   */
  sendMessage(jobId: string, content: string, signature?: string): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to chat');
    }
    if (content.length > MAX_MESSAGE_SIZE) {
      throw new Error(`Message exceeds maximum size of ${MAX_MESSAGE_SIZE} bytes`);
    }
    this.socket.emit('message', { jobId, content, signature });
  }

  /**
   * Register a handler for messages in a specific job.
   */
  onJobMessage(jobId: string, handler: MessageHandler): void {
    const existing = this.messageHandlers.get(jobId) || [];
    existing.push(handler);
    this.messageHandlers.set(jobId, existing);
  }

  /**
   * Register a handler for all messages across all jobs.
   */
  onMessage(handler: MessageHandler): void {
    this.globalHandler = handler;
  }

  /**
   * Send a typing indicator.
   */
  sendTyping(jobId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing', { jobId });
    }
  }

  /**
   * Mark messages as read.
   */
  markRead(jobId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('mark_read', { jobId });
    }
  }

  /**
   * Check if connected (uses Socket.IO's own state as source of truth).
   */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Disconnect from chat.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }
    this.socket = null;
    this.joinedRooms.clear();
    this.messageHandlers.clear();
    this.globalHandler = null;
  }
}
