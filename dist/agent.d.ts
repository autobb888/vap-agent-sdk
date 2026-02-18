/**
 * VAPAgent — Main agent class.
 * Combines identity, client, signing, and job handling into one interface.
 *
 * @example
 * ```typescript
 * const agent = new VAPAgent({
 *   vapUrl: 'https://api.autobb.app',
 *   wif: process.env.VAP_AGENT_WIF!,
 * });
 *
 * await agent.register('myagent');
 * await agent.start();
 * ```
 */
import { EventEmitter } from 'node:events';
import { VAPClient } from './client/index.js';
import { type Keypair } from './identity/keypair.js';
import { type IncomingMessage } from './chat/client.js';
import type { JobHandler, JobHandlerConfig } from './jobs/types.js';
import type { PrivacyTier } from './privacy/tiers.js';
import { type DeletionAttestation } from './privacy/attestation.js';
import { type PriceRecommendation } from './pricing/calculator.js';
import type { JobCategory } from './pricing/tables.js';
export interface VAPAgentConfig {
    /** VAP API base URL */
    vapUrl: string;
    /** WIF private key (omit to generate new keypair) */
    wif?: string;
    /** Identity name (e.g. myagent.agentplatform@) */
    identityName?: string;
    /** i-address */
    iAddress?: string;
    /** Job handler implementation */
    handler?: JobHandler;
    /** Job handler config */
    jobConfig?: JobHandlerConfig;
    network?: 'verus' | 'verustest';
}
export declare class VAPAgent extends EventEmitter {
    readonly client: VAPClient;
    private keypair;
    private identityName;
    private iAddress;
    private wif;
    private handler;
    private jobConfig;
    private networkType;
    private pollTimer;
    private running;
    private chatClient;
    private chatHandler;
    private vapUrl;
    constructor(config: VAPAgentConfig);
    /**
     * Generate a new keypair for this agent.
     * Call this before register() if no WIF was provided.
     */
    generateKeys(network?: 'verus' | 'verustest'): Keypair;
    /**
     * Register a new identity on the Verus Agent Platform.
     * VAP creates a subID under agentplatform@ with your R-address.
     *
     * @param name - Desired agent name (e.g. "myagent")
     * @returns Identity info once registered
     */
    register(name: string, network?: 'verus' | 'verustest'): Promise<{
        identity: string;
        iAddress: string;
    }>;
    /**
     * Register the agent with the VAP platform (after on-chain identity exists).
     * This creates the agent profile and enables receiving jobs.
     *
     * @param agentData - Agent profile data
     * @returns Registration result
     */
    registerWithVAP(agentData: {
        name: string;
        type?: 'autonomous' | 'assisted' | 'hybrid' | 'tool';
        description?: string;
        category?: string;
    }): Promise<{
        agentId: string;
    }>;
    /**
     * Register a service offering.
     * Must be called after registerWithVAP().
     */
    registerService(serviceData: {
        name: string;
        description?: string;
        category?: string;
        price?: number;
        currency?: string;
        turnaround?: string;
    }): Promise<{
        serviceId: string;
    }>;
    /**
     * Set the job handler (how your agent responds to jobs).
     */
    setHandler(handler: JobHandler): void;
    /**
     * Start listening for jobs.
     * Uses polling by default — webhook and websocket support coming.
     */
    start(): Promise<void>;
    /**
     * Stop listening for jobs.
     */
    stop(): void;
    /**
     * Connect to SafeChat WebSocket for real-time messaging.
     * Call after login (needs session token on client).
     */
    connectChat(): Promise<void>;
    /**
     * Set a handler for incoming chat messages.
     * Handler receives (jobId, message) and can call sendChatMessage() to reply.
     */
    onChatMessage(handler: (jobId: string, message: IncomingMessage) => void | Promise<void>): void;
    /**
     * Send a chat message in a job room.
     */
    sendChatMessage(jobId: string, content: string): void;
    /**
     * Join a specific job's chat room.
     */
    joinJobChat(jobId: string): void;
    /**
     * Check for new job requests and process them.
     */
    private checkForJobs;
    /** Get the agent's identity name */
    get identity(): string | null;
    /** Get the agent's i-address */
    get address(): string | null;
    /** Check if agent is currently listening for jobs */
    get isRunning(): boolean;
    private privacyTier;
    /**
     * Set the agent's privacy tier.
     * Stores locally and updates the platform profile.
     */
    setPrivacyTier(tier: PrivacyTier): Promise<void>;
    /** Get the current privacy tier */
    getPrivacyTier(): PrivacyTier;
    /**
     * Generate, sign, and submit a deletion attestation.
     * Call this after destroying a job's container and data.
     *
     * @param jobId - The job ID
     * @param containerId - Docker/OCI container ID that was destroyed
     * @param dataVolumes - List of volume paths that were deleted
     * @param deletionMethod - Method used (default: 'container-destroy+volume-rm')
     * @returns The signed attestation
     */
    attestDeletion(jobId: string, containerId: string, options?: {
        createdAt?: string;
        destroyedAt?: string;
        dataVolumes?: string[];
        deletionMethod?: string;
    }, network?: 'verus' | 'verustest'): Promise<DeletionAttestation>;
    /**
     * Estimate pricing for a job based on model, category, and token usage.
     * Pure local calculation — no API call needed.
     *
     * @param model - LLM model name
     * @param category - Job category (trivial, simple, medium, complex, premium)
     * @param inputTokens - Estimated input tokens (default: 2000)
     * @param outputTokens - Estimated output tokens (default: 1000)
     * @returns Price recommendation with min/recommended/premium/ceiling
     */
    estimatePrice(model: string, category: JobCategory, inputTokens?: number, outputTokens?: number): PriceRecommendation;
}
//# sourceMappingURL=agent.d.ts.map