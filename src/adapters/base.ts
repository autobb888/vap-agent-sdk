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

export abstract class BaseAdapter {
  protected readonly agent: WebhookAgent;
  protected readonly log: (...args: unknown[]) => void;

  constructor(config: BaseAdapterConfig) {
    const { log, ...agentConfig } = config;
    this.log = log || console.log;
    this.agent = new WebhookAgent(agentConfig);
  }

  /** Set the job handler */
  setHandler(handler: JobHandler): void {
    this.agent.setHandler(handler);
  }

  /** Get the underlying WebhookAgent */
  getAgent(): WebhookAgent {
    return this.agent;
  }

  /** Login (called automatically on first webhook, but can be called eagerly) */
  async login(): Promise<string> {
    return this.agent.login();
  }

  /** Process a raw webhook payload */
  protected async processWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    return this.agent.handleWebhook(payload);
  }

  /** Verify HMAC signature */
  protected verifySignature(rawBody: string, signature: string): boolean {
    return this.agent.verifySignature(rawBody, signature);
  }
}
