"use strict";
/**
 * Base adapter — shared logic for all framework adapters.
 *
 * Each adapter wraps a WebhookAgent and exposes a framework-specific
 * entry point (e.g. Express handler, n8n trigger, LangChain tool).
 * The base class provides common helpers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAdapter = void 0;
const handler_js_1 = require("../webhook/handler.js");
class BaseAdapter {
    agent;
    log;
    constructor(config) {
        const { log, ...agentConfig } = config;
        this.log = log || console.log;
        this.agent = new handler_js_1.WebhookAgent(agentConfig);
    }
    /** Set the job handler */
    setHandler(handler) {
        this.agent.setHandler(handler);
    }
    /** Get the underlying WebhookAgent */
    getAgent() {
        return this.agent;
    }
    /** Login (called automatically on first webhook, but can be called eagerly) */
    async login() {
        return this.agent.login();
    }
    /** Process a raw webhook payload */
    async processWebhook(payload) {
        return this.agent.handleWebhook(payload);
    }
    /** Verify HMAC signature */
    verifySignature(rawBody, signature) {
        return this.agent.verifySignature(rawBody, signature);
    }
}
exports.BaseAdapter = BaseAdapter;
//# sourceMappingURL=base.js.map