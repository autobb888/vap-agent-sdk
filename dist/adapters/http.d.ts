/**
 * Generic HTTP adapter — works with Express, Fastify, Hono, or any
 * framework that provides a standard request/response interface.
 *
 * @example Express
 * ```typescript
 * import express from 'express';
 * import { HttpAdapter } from '@autobb/vap-agent';
 *
 * const adapter = new HttpAdapter({
 *   vapUrl: 'https://api.autobb.app',
 *   wif: process.env.AGENT_WIF!,
 *   identityName: 'myagent.agentplatform@',
 *   webhookSecret: process.env.WEBHOOK_SECRET,
 * });
 *
 * adapter.setHandler({
 *   async onJobRequested(job) { return 'accept'; },
 *   async onJobStarted(job) { console.log('Working on', job.id); },
 * });
 *
 * const app = express();
 * app.post('/webhook', express.json(), adapter.expressHandler());
 * app.listen(8080);
 * ```
 *
 * @example Fastify
 * ```typescript
 * fastify.post('/webhook', adapter.handler());
 * ```
 */
import { BaseAdapter, type BaseAdapterConfig } from './base.js';
import type { WebhookPayload, WebhookResult } from '../webhook/handler.js';
export interface HttpAdapterConfig extends BaseAdapterConfig {
    /** If true, return 401 on signature verification failure (default: true when webhookSecret is set) */
    rejectInvalidSignature?: boolean;
}
/**
 * Framework-agnostic request shape. Adapters pass their framework's
 * request into handler() — it just needs body + headers.
 */
export interface GenericRequest {
    body: WebhookPayload | string;
    headers: Record<string, string | string[] | undefined>;
    /** Raw body string for HMAC verification (optional) */
    rawBody?: string;
}
export interface GenericResponse {
    status: number;
    body: WebhookResult | {
        error: string;
    };
}
export declare class HttpAdapter extends BaseAdapter {
    private readonly rejectInvalidSignature;
    constructor(config: HttpAdapterConfig);
    /**
     * Generic handler — pass any request-like object, get a response.
     * Use this with Fastify, Hono, Koa, or custom HTTP servers.
     */
    handler(req: GenericRequest): Promise<GenericResponse>;
    /**
     * Express-compatible middleware handler.
     * Returns a function with (req, res) signature.
     */
    expressHandler(): (req: any, res: any) => Promise<void>;
    /**
     * Fastify-compatible handler.
     * Returns a function with (request, reply) signature.
     */
    fastifyHandler(): (request: any, reply: any) => Promise<void>;
}
//# sourceMappingURL=http.d.ts.map