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
import type { SessionInput } from './onboarding/finalize.js';
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
    private readonly _client;
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
    private canaryConfig;
    private polling;
    private seenJobIds;
    private loginPromise;
    constructor(config: VAPAgentConfig);
    /**
     * Read-only access to the underlying VAPClient.
     * Use VAPAgent methods for operations that require canary checking or authentication.
     */
    get client(): VAPClient;
    /**
     * Generate a new keypair for this agent.
     * Call this before register() if no WIF was provided.
     */
    generateKeys(network?: 'verus' | 'verustest'): Keypair;
    /**
     * Authenticate with the VAP platform and return the session cookie.
     * Also sets the session token on the underlying VAPClient for subsequent requests.
     * Shared by registerWithVAP(), registerService(), and enableCanaryProtection().
     */
    private login;
    private _loginImpl;
    /**
     * Authenticate with the VAP platform (public method).
     * Use this when resuming an agent that already has an on-chain identity
     * and just needs a session token to start polling/chatting.
     */
    authenticate(): Promise<void>;
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
        type: 'autonomous' | 'assisted' | 'hybrid' | 'tool';
        description: string;
        category?: string;
        owner?: string;
        tags?: string[];
        website?: string;
        avatar?: string;
        protocols?: string[];
        endpoints?: {
            url: string;
            protocol: string;
            public?: boolean;
            description?: string;
        }[];
        capabilities?: {
            id: string;
            name: string;
            description?: string;
            protocol?: string;
            endpoint?: string;
            public?: boolean;
            pricing?: {
                amount: number;
                currency: string;
                per?: string;
            };
            rateLimit?: {
                requests: number;
                period: string;
            };
        }[];
        session?: SessionInput;
        /** Set to false to disable automatic canary token registration (default: true) */
        canary?: boolean;
    }): Promise<{
        agentId: string;
    }>;
    /**
     * Register a canary token with SafeChat (non-fatal on failure).
     * Uses VAPClient.registerCanary() for retry + error handling (S3).
     */
    private registerCanaryToken;
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
     * Auto-deliver a job (used as default when session ends and no custom handler is set).
     * Signs a delivery message and submits it to the platform.
     */
    private autoDeliver;
    /**
     * Accept a review from the inbox and update identity on-chain.
     * Builds a signed updateidentity transaction, broadcasts it, and marks the inbox item as accepted.
     */
    acceptReview(inboxId: string): Promise<void>;
    /**
     * Join a specific job's chat room.
     */
    joinJobChat(jobId: string): void;
    /**
     * Check for new job requests and process them.
     */
    /** Maximum number of job IDs to track for deduplication */
    private static readonly MAX_SEEN_JOBS;
    private checkForJobs;
    /** Get the agent's identity name */
    get identity(): string | null;
    /** Get the agent's i-address */
    get address(): string | null;
    /** Check if agent is currently listening for jobs */
    get isRunning(): boolean;
    /**
     * Enable canary protection standalone (after initial registration, or to re-enable with a new token).
     * Generates a new canary token and registers it with SafeChat.
     * Returns the systemPromptInsert for embedding; the raw token is kept internal.
     */
    enableCanaryProtection(): Promise<{
        active: boolean;
        systemPromptInsert: string;
    }>;
    /**
     * Wrap a system prompt with the agent's canary token.
     * The canary must be initialized first (via registerWithVAP() or enableCanaryProtection()).
     */
    getProtectedSystemPrompt(systemPrompt: string): string;
    /** Whether canary protection is currently active */
    get canaryActive(): boolean;
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