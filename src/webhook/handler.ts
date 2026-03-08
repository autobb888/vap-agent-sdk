/**
 * WebhookAgent — Event-driven agent for external framework integration.
 *
 * Unlike VAPAgent which polls for jobs, WebhookAgent receives webhook
 * payloads from VAP and dispatches them to a handler. This lets frameworks
 * like n8n, LangChain, CrewAI, and AutoGen integrate without running
 * a persistent polling loop.
 *
 * The agent still holds its own WIF key and signs all operations locally.
 *
 * @example
 * ```typescript
 * const agent = new WebhookAgent({
 *   vapUrl: 'https://api.autobb.app',
 *   wif: process.env.AGENT_WIF!,
 *   identityName: 'myagent.agentplatform@',
 * });
 *
 * await agent.login();
 *
 * // In your HTTP handler (Express, Fastify, n8n, etc.):
 * app.post('/webhook', async (req, res) => {
 *   const result = await agent.handleWebhook(req.body);
 *   res.json(result);
 * });
 * ```
 */

import { EventEmitter } from 'node:events';
import { VAPClient } from '../client/index.js';
import { keypairFromWIF, type Keypair } from '../identity/keypair.js';
import { signMessage } from '../identity/signer.js';
import { ChatClient, type IncomingMessage } from '../chat/client.js';
import type { JobHandler } from '../jobs/types.js';
import type { Job } from '../client/index.js';

export interface WebhookAgentConfig {
  /** VAP API base URL */
  vapUrl: string;
  /** WIF private key (required — agent holds its own key) */
  wif: string;
  /** Identity name (e.g. myagent.agentplatform@) */
  identityName?: string;
  /** i-address */
  iAddress?: string;
  /** Job handler implementation */
  handler?: JobHandler;
  /** Network */
  network?: 'verus' | 'verustest';
  /** Webhook secret for HMAC verification (optional) */
  webhookSecret?: string;
}

/** Webhook event payload from VAP */
export interface WebhookPayload {
  event: string;
  timestamp: string;
  jobId?: string;
  data?: Record<string, unknown>;
}

/** Result of processing a webhook */
export interface WebhookResult {
  handled: boolean;
  action?: string;
  jobId?: string;
  error?: string;
}

export class WebhookAgent extends EventEmitter {
  private readonly client: VAPClient;
  private readonly keypair: Keypair;
  private readonly wif: string;
  private readonly networkType: 'verus' | 'verustest';
  private readonly webhookSecret?: string;
  private identityName: string | null;
  private iAddress: string | null;
  private handler: JobHandler | null;
  private chatClient: ChatClient | null = null;
  private loginPromise: Promise<string> | null = null;

  constructor(config: WebhookAgentConfig) {
    super();

    if (!config.wif) {
      throw new Error('WIF key is required — WebhookAgent signs all operations locally');
    }

    this.wif = config.wif;
    this.networkType = config.network || 'verustest';
    this.keypair = keypairFromWIF(config.wif, this.networkType);
    this.identityName = config.identityName || null;
    this.iAddress = config.iAddress || null;
    this.handler = config.handler || null;
    this.webhookSecret = config.webhookSecret;

    this.client = new VAPClient({ vapUrl: config.vapUrl });

    // Safe default error handler
    this.on('error', () => {});
  }

  /** Set/replace the job handler */
  setHandler(handler: JobHandler): void {
    this.handler = handler;
  }

  /** Get the underlying VAPClient for direct API calls */
  getClient(): VAPClient {
    return this.client;
  }

  /** Login to VAP (call once, session is reused) */
  async login(): Promise<string> {
    if (this.client.getSessionToken()) {
      return this.client.getSessionToken()!;
    }

    // Deduplicate concurrent login calls
    if (this.loginPromise) return this.loginPromise;

    this.loginPromise = (async () => {
      try {
        const identity = this.identityName || this.iAddress;
        if (!identity) throw new Error('identityName or iAddress required for login');

        const { challenge, challengeId } = await this.client.getAuthChallenge();
        const signature = signMessage(this.wif, challenge, this.networkType);

        const res = await fetch(`${this.client.getBaseUrl()}/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId, signature, verusId: identity }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(`Login failed: ${(err as any)?.error?.message || res.statusText}`);
        }

        const cookies = res.headers.get('set-cookie') || '';
        const match = cookies.match(/verus_session=([^;]+)/);
        if (!match) throw new Error('No session cookie in login response');

        this.client.setSessionToken(match[1]);
        this.emit('authenticated');
        return match[1];
      } finally {
        this.loginPromise = null;
      }
    })();

    return this.loginPromise;
  }

  /**
   * Handle an incoming webhook payload from VAP.
   * Dispatches to the registered JobHandler based on event type.
   *
   * Call this from your HTTP webhook endpoint.
   */
  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    const { event, jobId } = payload;

    if (!event) {
      return { handled: false, error: 'Missing event type' };
    }

    // Ensure logged in
    try {
      await this.login();
    } catch (err) {
      return { handled: false, error: `Login failed: ${(err as Error).message}` };
    }

    try {
      switch (event) {
        case 'job.requested':
          return this.handleJobRequested(jobId!);

        case 'job.accepted':
          return this.handleJobEvent(jobId!, 'accepted');

        case 'job.started':
        case 'job.in_progress':
          return this.handleJobStarted(jobId!);

        case 'job.delivered':
          return this.handleJobEvent(jobId!, 'delivered');

        case 'job.completed':
          return this.handleJobCompleted(jobId!);

        case 'job.disputed':
          return this.handleJobDisputed(jobId!, payload.data);

        case 'job.cancelled':
          return this.handleJobCancelled(jobId!, payload.data);

        case 'job.end_session_request':
          return this.handleSessionEnding(jobId!, payload.data);

        case 'message.new':
          return this.handleNewMessage(jobId!, payload.data);

        default:
          this.emit('webhook', payload);
          return { handled: false, jobId, action: 'unknown_event' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emit('error', err instanceof Error ? err : new Error(msg));
      return { handled: false, jobId, error: msg };
    }
  }

  // ─── Job Operations (stateless, sign-per-call) ───

  /** Accept a job — signs and submits */
  async acceptJob(jobId: string): Promise<Job> {
    await this.login();
    const job = await this.client.getJob(jobId);
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `VAP-ACCEPT|Job:${job.jobHash}|Buyer:${job.buyerVerusId}|Amt:${job.amount} ${job.currency}|Ts:${timestamp}|I accept this job and commit to delivering the work.`;
    const signature = signMessage(this.wif, message, this.networkType);
    return this.client.acceptJob(jobId, signature, timestamp);
  }

  /** Deliver a job — signs and submits */
  async deliverJob(jobId: string, deliveryContent: string): Promise<Job> {
    await this.login();
    const job = await this.client.getJob(jobId);
    const timestamp = Math.floor(Date.now() / 1000);
    const deliveryHash = Buffer.from(deliveryContent).toString('base64url').slice(0, 32);
    const message = `VAP-DELIVER|Job:${job.jobHash}|Delivery:${deliveryHash}|Ts:${timestamp}|I have delivered the work for this job.`;
    const signature = signMessage(this.wif, message, this.networkType);
    return this.client.deliverJob(jobId, deliveryHash, signature, timestamp, deliveryContent);
  }

  /** Send a chat message to a job */
  async sendMessage(jobId: string, content: string): Promise<void> {
    await this.login();
    await this.client.sendChatMessage(jobId, content);
  }

  /** Get messages for a job */
  async getMessages(jobId: string) {
    await this.login();
    return this.client.getChatMessages(jobId);
  }

  /** Get job details */
  async getJob(jobId: string): Promise<Job> {
    await this.login();
    return this.client.getJob(jobId);
  }

  /** Get all pending jobs for this agent */
  async getPendingJobs(): Promise<Job[]> {
    await this.login();
    const res = await this.client.getMyJobs({ status: 'requested', role: 'seller' });
    return res.data || [];
  }

  /** Get all active jobs (accepted/in_progress) */
  async getActiveJobs(): Promise<Job[]> {
    await this.login();
    const [accepted, inProgress] = await Promise.all([
      this.client.getMyJobs({ status: 'accepted', role: 'seller' }),
      this.client.getMyJobs({ status: 'in_progress', role: 'seller' }),
    ]);
    return [...(accepted.data || []), ...(inProgress.data || [])];
  }

  // ─── Internal Webhook Dispatch ───

  private async handleJobRequested(jobId: string): Promise<WebhookResult> {
    if (!this.handler?.onJobRequested) {
      return { handled: false, jobId, action: 'no_handler' };
    }

    const job = await this.client.getJob(jobId);
    const decision = await this.handler.onJobRequested(job);

    if (decision === 'accept') {
      await this.acceptJob(jobId);
      this.emit('job:accepted', job);
      return { handled: true, jobId, action: 'accepted' };
    } else if (decision === 'reject') {
      this.emit('job:rejected', job);
      return { handled: true, jobId, action: 'rejected' };
    } else {
      return { handled: true, jobId, action: 'hold' };
    }
  }

  private async handleJobStarted(jobId: string): Promise<WebhookResult> {
    if (!this.handler?.onJobStarted) {
      return { handled: false, jobId, action: 'no_handler' };
    }
    const job = await this.client.getJob(jobId);
    await this.handler.onJobStarted(job);
    return { handled: true, jobId, action: 'started' };
  }

  private async handleJobCompleted(jobId: string): Promise<WebhookResult> {
    if (this.handler?.onJobCompleted) {
      const job = await this.client.getJob(jobId);
      await this.handler.onJobCompleted(job);
    }
    return { handled: true, jobId, action: 'completed' };
  }

  private async handleJobDisputed(jobId: string, data?: Record<string, unknown>): Promise<WebhookResult> {
    if (this.handler?.onJobDisputed) {
      const job = await this.client.getJob(jobId);
      await this.handler.onJobDisputed(job, (data?.reason as string) || 'Unknown');
    }
    return { handled: true, jobId, action: 'disputed' };
  }

  private async handleJobCancelled(jobId: string, data?: Record<string, unknown>): Promise<WebhookResult> {
    if (this.handler?.onJobCancelled) {
      const job = await this.client.getJob(jobId);
      await this.handler.onJobCancelled(job, data?.reason as string);
    }
    return { handled: true, jobId, action: 'cancelled' };
  }

  private async handleSessionEnding(jobId: string, data?: Record<string, unknown>): Promise<WebhookResult> {
    if (this.handler?.onSessionEnding) {
      const job = await this.client.getJob(jobId);
      await this.handler.onSessionEnding(job, (data?.reason as string) || '', (data?.requestedBy as string) || '');
      return { handled: true, jobId, action: 'session_ending_handled' };
    }

    // Default: auto-deliver
    await this.deliverJob(jobId, 'Session ended — work delivered automatically.');
    return { handled: true, jobId, action: 'auto_delivered' };
  }

  private async handleNewMessage(jobId: string, data?: Record<string, unknown>): Promise<WebhookResult> {
    this.emit('message', { jobId, ...data });
    return { handled: true, jobId, action: 'message_emitted' };
  }

  private async handleJobEvent(jobId: string, status: string): Promise<WebhookResult> {
    this.emit('job:statusChanged', { jobId, status });
    return { handled: true, jobId, action: status };
  }

  /** Verify webhook HMAC signature (call before handleWebhook) */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) return true; // No secret configured = skip verification
    const crypto = require('node:crypto');
    const expected = 'sha256=' + crypto.createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}
