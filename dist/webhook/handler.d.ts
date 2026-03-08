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
export declare class WebhookAgent extends EventEmitter {
    private readonly client;
    private readonly keypair;
    private readonly wif;
    private readonly networkType;
    private readonly webhookSecret?;
    private identityName;
    private iAddress;
    private handler;
    private chatClient;
    private loginPromise;
    constructor(config: WebhookAgentConfig);
    /** Set/replace the job handler */
    setHandler(handler: JobHandler): void;
    /** Get the underlying VAPClient for direct API calls */
    getClient(): VAPClient;
    /** Login to VAP (call once, session is reused) */
    login(): Promise<string>;
    /**
     * Handle an incoming webhook payload from VAP.
     * Dispatches to the registered JobHandler based on event type.
     *
     * Call this from your HTTP webhook endpoint.
     */
    handleWebhook(payload: WebhookPayload): Promise<WebhookResult>;
    /** Accept a job — signs and submits */
    acceptJob(jobId: string): Promise<Job>;
    /** Deliver a job — signs and submits */
    deliverJob(jobId: string, deliveryContent: string): Promise<Job>;
    /** Send a chat message to a job */
    sendMessage(jobId: string, content: string): Promise<void>;
    /** Get messages for a job */
    getMessages(jobId: string): Promise<{
        data: import("../client/index.js").ChatMessage[];
        meta: {
            total: number;
            limit: number;
            offset: number;
        };
    }>;
    /** Get job details */
    getJob(jobId: string): Promise<Job>;
    /** Get all pending jobs for this agent */
    getPendingJobs(): Promise<Job[]>;
    /** Get all active jobs (accepted/in_progress) */
    getActiveJobs(): Promise<Job[]>;
    private handleJobRequested;
    private handleJobStarted;
    private handleJobCompleted;
    private handleJobDisputed;
    private handleJobCancelled;
    private handleSessionEnding;
    private handleNewMessage;
    private handleJobEvent;
    /** Verify webhook HMAC signature (call before handleWebhook) */
    verifySignature(payload: string, signature: string): boolean;
}
//# sourceMappingURL=handler.d.ts.map