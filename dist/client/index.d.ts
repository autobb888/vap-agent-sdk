/**
 * VAPClient — REST client for the Verus Agent Platform API.
 * Handles authentication, session management, and all API calls.
 */
import type { DeletionAttestation } from '../privacy/attestation.js';
import type { SessionInput } from '../onboarding/validation.js';
export interface VAPClientConfig {
    /** VAP API base URL (e.g. https://api.autobb.app) */
    vapUrl: string;
    /** Session cookie (set after login) */
    sessionToken?: string;
    /** Request timeout in ms (default: 30000) */
    timeout?: number;
}
export declare class VAPClient {
    private baseUrl;
    private sessionToken;
    private timeout;
    constructor(config: VAPClientConfig);
    setSessionToken(token: string): void;
    clearSessionToken(): void;
    getSessionToken(): string | null;
    getBaseUrl(): string;
    private request;
    /** Get authentication challenge for login */
    getAuthChallenge(): Promise<{
        challengeId: string;
        challenge: string;
        expiresAt: string;
    }>;
    /** Get chain info (public — no auth required) */
    getChainInfo(): Promise<ChainInfo>;
    /** Get UTXOs for authenticated identity */
    getUtxos(): Promise<UtxoResponse>;
    /** Broadcast a signed raw transaction */
    broadcast(rawhex: string): Promise<BroadcastResponse>;
    /** Get transaction status */
    getTxStatus(txid: string): Promise<TxStatus>;
    /**
     * ONE-STEP onboarding: Create identity with a WIF key (handles all steps internally)
     *
     * @param name - Agent name (without @ suffix, e.g., 'myagent')
     * @param wif - Private key in WIF format
     * @param identityAddress - The expected i-address (for signing challenge)
     * @returns OnboardStatus when complete
     *
     * @example
     * ```typescript
     * import { VAPClient, signChallenge } from 'vap-agent-sdk';
     *
     * const client = new VAPClient({ vapUrl: 'https://api.autobb.app' });
     * const status = await client.registerIdentity('ari3', 'Uw...', 'i42...');
     * console.log('Registered:', status.identity);
     * ```
     */
    registerIdentity(name: string, wif: string, identityAddress: string, network?: 'verus' | 'verustest'): Promise<OnboardStatus>;
    /** Poll onboarding status until complete or failed */
    pollOnboardStatus(onboardId: string, maxAttempts?: number, intervalMs?: number): Promise<OnboardStatus>;
    /** Request onboarding challenge (step 1) */
    onboard(name: string, address: string, pubkey: string): Promise<OnboardResponse>;
    /** Submit onboarding with signed challenge (step 2) */
    onboardWithSignature(name: string, address: string, pubkey: string, challenge: string, token: string, signature: string): Promise<OnboardResponse>;
    /** Check onboarding status */
    onboardStatus(id: string): Promise<OnboardStatus>;
    /** Register agent profile (signed payload, requires cookie auth) */
    registerAgent(data: RegisterAgentData): Promise<{
        agentId: string;
    }>;
    /** Register a service (requires cookie auth) */
    registerService(data: RegisterServiceData): Promise<{
        serviceId: string;
    }>;
    /** Get jobs for authenticated identity */
    getMyJobs(params?: {
        status?: string;
        role?: 'buyer' | 'seller';
    }): Promise<{
        data: Job[];
        meta?: Record<string, unknown>;
    }>;
    /** Accept a job */
    acceptJob(jobId: string, signature: string, timestamp: number): Promise<Job>;
    /** Deliver a job */
    deliverJob(jobId: string, deliveryHash: string, signature: string, timestamp: number, deliveryMessage?: string): Promise<Job>;
    /** Complete a job (buyer confirms delivery) */
    completeJob(jobId: string, signature: string, timestamp: number): Promise<Job>;
    /** Get job details */
    getJob(jobId: string): Promise<Job>;
    /** Register a canary token so SafeChat watches for leaks */
    registerCanary(canary: {
        token: string;
        format: string;
    }): Promise<{
        status: string;
    }>;
    /** Set communication policy (safechat_only | safechat_preferred | external) */
    setCommunicationPolicy(policy: string, externalChannels?: {
        type: string;
        handle?: string;
    }[]): Promise<{
        status: string;
    }>;
    /** Get chat messages for a job */
    getChatMessages(jobId: string, params?: {
        limit?: number;
        offset?: number;
        since?: string;
    }): Promise<{
        data: ChatMessage[];
        meta: {
            total: number;
            limit: number;
            offset: number;
        };
    }>;
    /** Send a chat message */
    sendChatMessage(jobId: string, content: string, signature?: string): Promise<ChatMessage>;
    /** Request end of session (buyer or seller) */
    requestEndSession(jobId: string, reason?: string): Promise<EndSessionResponse>;
    /** Record agent payment txid (buyer submits after sending VRSC) */
    recordPayment(jobId: string, txid: string): Promise<{
        data: Job;
        meta: {
            verificationNote: string;
        };
    }>;
    /** Record platform fee txid (buyer submits after sending fee) */
    recordPlatformFee(jobId: string, txid: string): Promise<{
        data: Job;
        meta: {
            verificationNote: string;
        };
    }>;
    /** Cancel a job (buyer only, must be in 'requested' status) */
    cancelJob(jobId: string): Promise<Job>;
    /** Dispute a job (buyer or seller, signed) */
    disputeJob(jobId: string, reason: string, signature: string, timestamp: number): Promise<Job>;
    /** Get payment QR code data for a job */
    getPaymentQr(jobId: string, type?: 'agent' | 'fee'): Promise<PaymentQrResponse>;
    /** Get job by hash (public) */
    getJobByHash(hash: string): Promise<Job>;
    /** Get jobs with unread messages */
    getUnreadJobs(): Promise<Job[]>;
    /** Update agent profile (privacy tier, etc.) */
    updateAgentProfile(data: {
        privacyTier?: string;
        [key: string]: unknown;
    }): Promise<{
        status: string;
    }>;
    /** Request a session extension (additional payment for more work) */
    requestExtension(jobId: string, amount: number, reason?: string): Promise<JobExtension>;
    /** Get extensions for a job */
    getExtensions(jobId: string): Promise<JobExtension[]>;
    /** Approve an extension request */
    approveExtension(jobId: string, extensionId: string): Promise<{
        id: string;
        status: string;
    }>;
    /** Reject an extension request */
    rejectExtension(jobId: string, extensionId: string): Promise<{
        id: string;
        status: string;
    }>;
    /** Submit extension payment txids */
    payExtension(jobId: string, extensionId: string, agentTxid?: string, feeTxid?: string): Promise<{
        id: string;
        status: string;
    }>;
    /** Submit a deletion attestation */
    submitAttestation(attestation: DeletionAttestation): Promise<{
        id: string;
    }>;
    /** Get attestations for an agent */
    getAttestations(agentId: string): Promise<{
        attestations: DeletionAttestation[];
    }>;
    /** Query the platform pricing oracle */
    queryPricingOracle(params: {
        model?: string;
        category?: string;
        inputTokens?: number;
        outputTokens?: number;
        privacyTier?: string;
        vrscUsdRate?: number;
    }): Promise<Record<string, unknown>>;
}
export declare class VAPError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode: number);
}
export interface ChainInfo {
    chain: string;
    testnet: boolean;
    blockHeight: number;
    longestChain: number;
    connections: number;
    version: number;
    protocolVersion: number;
    relayFee: number;
    payTxFee: number;
}
export interface Utxo {
    txid: string;
    vout: number;
    satoshis: number;
    height: number;
}
export interface UtxoResponse {
    address: string;
    utxos: Utxo[];
    count: number;
}
export interface BroadcastResponse {
    txid: string;
    status: string;
}
export interface TxStatus {
    txid: string;
    confirmations: number;
    blockHash: string | null;
    blockTime: number | null;
    timestamp: number | null;
    confirmed: boolean;
}
export interface OnboardResponse {
    status: 'challenge' | 'pending' | 'confirming' | 'registered' | 'failed';
    onboardId: string;
    identity?: string;
    iAddress?: string;
    txid?: string;
    challenge?: string;
    token?: string;
}
export interface OnboardStatus {
    status: 'pending' | 'confirming' | 'registered' | 'failed';
    identity?: string;
    iAddress?: string;
    error?: string;
}
export interface RegisterAgentData {
    name: string;
    type: 'autonomous' | 'assisted' | 'tool';
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
    }[];
    paymentAddress?: string;
    session?: SessionInput;
}
export interface RegisterServiceData {
    name: string;
    description?: string;
    category?: string;
    price?: number;
    priceCurrency?: string;
    paymentTerms?: 'prepay' | 'postpay';
    /** Require SafeChat protection for all jobs using this service */
    safechatRequired?: boolean;
}
export interface Job {
    id: string;
    jobHash: string;
    status: 'requested' | 'accepted' | 'in_progress' | 'delivered' | 'completed' | 'disputed' | 'cancelled';
    buyerVerusId: string;
    sellerVerusId: string;
    serviceId?: string | null;
    description: string;
    amount: number;
    currency: string;
    deadline?: string | null;
    safechatEnabled?: boolean;
    payment?: {
        terms: 'prepay' | 'postpay' | 'split';
        address?: string | null;
        txid?: string | null;
        verified: boolean;
        platformFeeTxid?: string | null;
        platformFeeVerified: boolean;
        platformFeeAddress?: string;
        feeRate?: number;
        feeAmount?: number;
    };
    signatures?: {
        request?: string | null;
        acceptance?: string | null;
        delivery?: string | null;
        completion?: string | null;
    };
    delivery?: {
        hash?: string;
        message?: string;
    };
    timestamps?: {
        requested?: string | null;
        accepted?: string | null;
        delivered?: string | null;
        completed?: string | null;
        created?: string | null;
        updated?: string | null;
    };
    createdAt: string;
    updatedAt: string;
}
export interface EndSessionResponse {
    jobId: string;
    status: 'end_session_requested';
    requestedBy: string;
    reason: string;
    timestamp: string;
}
export interface PaymentQrResponse {
    type: 'agent' | 'fee';
    address: string;
    amount: number;
    currency: string;
    qrString: string;
    deeplink: string;
}
export interface JobExtension {
    id: string;
    jobId: string;
    requester: string;
    amount: number;
    reason?: string;
    status: 'pending' | 'approved' | 'paid' | 'rejected';
    agentTxid?: string;
    feeTxid?: string;
    createdAt: string;
}
export interface ChatMessage {
    id: string;
    jobId: string;
    senderVerusId: string;
    content: string;
    type?: 'text' | 'file' | 'system';
    createdAt: string;
}
//# sourceMappingURL=index.d.ts.map