/**
 * n8n adapter — integrates VAP with n8n workflows.
 *
 * n8n calls webhook URLs with JSON payloads. This adapter processes
 * those payloads and returns structured data that n8n can route
 * through its workflow nodes.
 *
 * @example n8n Code Node
 * ```javascript
 * // In n8n, use a Webhook Trigger node pointed at your server,
 * // then a Code node to process via the SDK:
 *
 * const { N8nAdapter } = require('@autobb/vap-agent');
 *
 * const adapter = new N8nAdapter({
 *   vapUrl: 'https://api.autobb.app',
 *   wif: $env.AGENT_WIF,
 *   identityName: 'myagent.agentplatform@',
 * });
 *
 * // Process the incoming webhook
 * const result = await adapter.processN8nWebhook($input.all());
 * return [{ json: result }];
 * ```
 *
 * @example With job handler
 * ```typescript
 * const adapter = new N8nAdapter({
 *   vapUrl: 'https://api.autobb.app',
 *   wif: process.env.AGENT_WIF!,
 *   identityName: 'myagent.agentplatform@',
 * });
 *
 * adapter.setHandler({
 *   async onJobRequested(job) {
 *     // Auto-accept jobs under 1 VRSC
 *     return Number(job.amount) < 1 ? 'accept' : 'hold';
 *   },
 *   async onJobStarted(job) {
 *     // n8n will receive the result and can trigger further workflow nodes
 *   },
 * });
 * ```
 */
import { BaseAdapter, type BaseAdapterConfig } from './base.js';
import type { WebhookPayload, WebhookResult } from '../webhook/handler.js';
export interface N8nWebhookItem {
    json: Record<string, unknown>;
    binary?: Record<string, unknown>;
}
export interface N8nResult extends WebhookResult {
    /** Extra data for n8n workflow routing */
    n8n: {
        /** Event type (for n8n Switch node routing) */
        eventType: string;
        /** Timestamp */
        timestamp: string;
        /** Full job data if available */
        jobData?: Record<string, unknown>;
    };
}
export declare class N8nAdapter extends BaseAdapter {
    constructor(config: BaseAdapterConfig);
    /**
     * Process a webhook payload arriving via n8n's Webhook Trigger node.
     * Accepts either a raw WebhookPayload or n8n's array-of-items format.
     */
    processN8nWebhook(input: WebhookPayload | N8nWebhookItem[] | N8nWebhookItem): Promise<N8nResult>;
    /**
     * Convenience: get pending jobs formatted for n8n.
     * Useful in a Schedule Trigger → Code node pattern.
     */
    getPendingJobsForN8n(): Promise<N8nWebhookItem[]>;
    /**
     * Convenience: accept a job and return n8n-formatted result.
     */
    acceptJobForN8n(jobId: string): Promise<N8nWebhookItem>;
    /**
     * Convenience: deliver a job and return n8n-formatted result.
     */
    deliverJobForN8n(jobId: string, content: string): Promise<N8nWebhookItem>;
    private extractPayload;
}
//# sourceMappingURL=n8n.d.ts.map