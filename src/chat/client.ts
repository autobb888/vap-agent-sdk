/**
 * SafeChat WebSocket client for VAP agents.
 * Connects to the platform's Socket.IO chat server.
 */

import { io, Socket } from 'socket.io-client';
import type { ChatMessage } from './types.js';

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

export class ChatClient {
  private socket: Socket | null = null;
  private config: ChatClientConfig;
  private joinedRooms = new Set<string>();
  private messageHandlers = new Map<string, MessageHandler[]>(); // jobId -> handlers
  private globalHandler: MessageHandler | null = null;
  private connected = false;

  constructor(config: ChatClientConfig) {
    this.config = config;
  }

  /**
   * Connect to the chat server.
   * Gets a one-time token first, then establishes WebSocket.
   */
  async connect(): Promise<void> {
    // Step 1: Get a one-time chat token via REST API
    const tokenRes = await fetch(`${this.config.vapUrl}/v1/chat/token`, {
      headers: {
        'Cookie': `verus_session=${this.config.sessionToken}`,
      },
    });

    if (!tokenRes.ok) {
      throw new Error(`Failed to get chat token: ${tokenRes.status}`);
    }

    const tokenData = (await tokenRes.json()) as any;
    const chatToken = tokenData.data?.token;
    if (!chatToken) {
      throw new Error('No chat token in response');
    }

    // Step 2: Connect Socket.IO with the token
    return new Promise((resolve, reject) => {
      this.socket = io(this.config.vapUrl, {
        auth: { token: chatToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 10,
      });

      this.socket.on('connect', () => {
        this.connected = true;
        // Re-join any rooms we were in
        for (const jobId of this.joinedRooms) {
          this.socket!.emit('join_job', { jobId });
        }
        resolve();
      });

      this.socket.on('disconnect', (reason: string) => {
        this.connected = false;
        console.log(`[CHAT] Disconnected: ${reason}`);
      });

      this.socket.on('connect_error', (err: Error) => {
        console.error(`[CHAT] Connection error: ${err.message}`);
        if (!this.connected) {
          reject(err);
        }
      });

      this.socket.on('message', (msg: IncomingMessage) => {
        // Route to job-specific handlers
        const handlers = this.messageHandlers.get(msg.jobId);
        if (handlers) {
          for (const h of handlers) {
            try { h(msg); } catch (e) { console.error('[CHAT] Handler error:', e); }
          }
        }
        // Route to global handler
        if (this.globalHandler) {
          try { this.globalHandler(msg); } catch (e) { console.error('[CHAT] Handler error:', e); }
        }
      });

      this.socket.on('joined', (data: { jobId: string; room: string }) => {
        console.log(`[CHAT] Joined room for job ${data.jobId}`);
      });

      this.socket.on('error', (data: { message: string }) => {
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
   * Check if connected.
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from chat.
   */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
    this.joinedRooms.clear();
    this.messageHandlers.clear();
  }
}
