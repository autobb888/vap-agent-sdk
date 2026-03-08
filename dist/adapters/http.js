"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpAdapter = void 0;
const base_js_1 = require("./base.js");
class HttpAdapter extends base_js_1.BaseAdapter {
    rejectInvalidSignature;
    constructor(config) {
        super(config);
        this.rejectInvalidSignature = config.rejectInvalidSignature ?? !!config.webhookSecret;
    }
    /**
     * Generic handler — pass any request-like object, get a response.
     * Use this with Fastify, Hono, Koa, or custom HTTP servers.
     */
    async handler(req) {
        // Signature verification
        if (this.rejectInvalidSignature) {
            const sig = getHeader(req.headers, 'x-vap-signature');
            const raw = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
            if (!sig || !this.verifySignature(raw, sig)) {
                return { status: 401, body: { error: 'Invalid webhook signature' } };
            }
        }
        const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        try {
            const result = await this.processWebhook(payload);
            return { status: 200, body: result };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.log('[HttpAdapter] Error:', message);
            return { status: 500, body: { error: message } };
        }
    }
    /**
     * Express-compatible middleware handler.
     * Returns a function with (req, res) signature.
     */
    expressHandler() {
        return async (req, res) => {
            const result = await this.handler({
                body: req.body,
                headers: req.headers,
                rawBody: req.rawBody,
            });
            res.status(result.status).json(result.body);
        };
    }
    /**
     * Fastify-compatible handler.
     * Returns a function with (request, reply) signature.
     */
    fastifyHandler() {
        return async (request, reply) => {
            const result = await this.handler({
                body: request.body,
                headers: request.headers,
                rawBody: request.rawBody,
            });
            reply.code(result.status).send(result.body);
        };
    }
}
exports.HttpAdapter = HttpAdapter;
function getHeader(headers, name) {
    const val = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(val) ? val[0] : val;
}
//# sourceMappingURL=http.js.map