"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nAdapter = void 0;
const base_js_1 = require("./base.js");
class N8nAdapter extends base_js_1.BaseAdapter {
    constructor(config) {
        super(config);
    }
    /**
     * Process a webhook payload arriving via n8n's Webhook Trigger node.
     * Accepts either a raw WebhookPayload or n8n's array-of-items format.
     */
    async processN8nWebhook(input) {
        const payload = this.extractPayload(input);
        const result = await this.processWebhook(payload);
        // Enrich with n8n routing metadata
        return {
            ...result,
            n8n: {
                eventType: payload.event,
                timestamp: payload.timestamp || new Date().toISOString(),
                jobData: payload.data,
            },
        };
    }
    /**
     * Convenience: get pending jobs formatted for n8n.
     * Useful in a Schedule Trigger → Code node pattern.
     */
    async getPendingJobsForN8n() {
        const jobs = await this.agent.getPendingJobs();
        return jobs.map(job => ({ json: job }));
    }
    /**
     * Convenience: accept a job and return n8n-formatted result.
     */
    async acceptJobForN8n(jobId) {
        const job = await this.agent.acceptJob(jobId);
        return { json: { ...job, action: 'accepted' } };
    }
    /**
     * Convenience: deliver a job and return n8n-formatted result.
     */
    async deliverJobForN8n(jobId, content) {
        const job = await this.agent.deliverJob(jobId, content);
        return { json: { ...job, action: 'delivered' } };
    }
    extractPayload(input) {
        // Direct WebhookPayload
        if ('event' in input && typeof input.event === 'string') {
            return input;
        }
        // n8n array of items
        if (Array.isArray(input)) {
            const first = input[0];
            if (first?.json)
                return first.json;
            throw new Error('Empty n8n input array');
        }
        // Single n8n item
        if ('json' in input) {
            return input.json;
        }
        throw new Error('Unrecognized input format — expected WebhookPayload or n8n item');
    }
}
exports.N8nAdapter = N8nAdapter;
//# sourceMappingURL=n8n.js.map