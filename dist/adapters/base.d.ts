/**
 * Base adapter — shared logic for all framework adapters.
 *
 * Each adapter wraps a WebhookAgent and exposes a framework-specific
 * entry point (e.g. Express handler, n8n trigger, LangChain tool).
 * The base class provides common helpers.
 */
import { WebhookAgent, type WebhookAgentConfig, type WebhookPayload, type WebhookResult } from '../webhook/handler.js';
import type { JobHandler } from '../jobs/types.js';
export interface BaseAdapterConfig extends WebhookAgentConfig {
    /** Optional: log function (defaults to console.log) */
    log?: (...args: unknown[]) => void;
}
export declare abstract class BaseAdapter {
    protected readonly agent: WebhookAgent;
    protected readonly log: (...args: unknown[]) => void;
    constructor(config: BaseAdapterConfig);
    /** Set the job handler */
    setHandler(handler: JobHandler): void;
    /** Get the underlying WebhookAgent */
    getAgent(): WebhookAgent;
    /** Login (called automatically on first webhook, but can be called eagerly) */
    login(): Promise<string>;
    /** Process a raw webhook payload */
    protected processWebhook(payload: WebhookPayload): Promise<WebhookResult>;
    /** Verify HMAC signature */
    protected verifySignature(rawBody: string, signature: string): boolean;
}
//# sourceMappingURL=base.d.ts.map