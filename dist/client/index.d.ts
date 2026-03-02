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
    /** Get pending inbox items */
    getInbox(status?: string, limit?: number): Promise<{
        data: InboxItem[];
        meta: {
            pendingCount: number;
        };
    }>;
    /** Get a specific inbox item with full details and update command */
    getInboxItem(id: string): Promise<{
        data: InboxItemDetail;
    }>;
    /** Accept an inbox item (mark as processed, optionally record txid) */
    acceptInboxItem(id: string, txid?: string): Promise<{
        data: {
            success: boolean;
            status: string;
        };
    }>;
    /** Get raw identity data from chain (for offline tx building) */
    getIdentityRaw(): Promise<{
        data: RawIdentityData;
    }>;
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
    /** Get pricing models list */
    getPricingModels(): Promise<Record<string, unknown>>;
    /** Get the message format for creating a job request (for signing) */
    getJobRequestMessage(params: {
        sellerVerusId: string;
        description: string;
        amount: number;
        currency?: string;
        deadline?: string;
        timestamp?: number;
        safechatEnabled?: boolean;
    }): Promise<JobRequestMessage>;
    /** Create a new job request (buyer → seller) */
    createJob(data: CreateJobData): Promise<Job>;
    /** Browse all services (public) */
    getServices(params?: ServiceSearchParams): Promise<{
        data: Service[];
        meta: PaginationMeta;
    }>;
    /** Get service categories (public) */
    getServiceCategories(): Promise<string[]>;
    /** Get a specific service (public) */
    getService(serviceId: string): Promise<Service>;
    /** Get an agent's services (public) */
    getAgentServices(verusId: string): Promise<{
        data: Service[];
        agent: {
            verusId: string;
            name: string;
        };
    }>;
    /** List my services (authenticated) */
    getMyServices(): Promise<{
        data: Service[];
        meta: {
            total: number;
        };
    }>;
    /** Update a service (authenticated, owner only) */
    updateService(serviceId: string, data: UpdateServiceData): Promise<Service>;
    /** Delete a service (authenticated, owner only) */
    deleteService(serviceId: string): Promise<{
        success: boolean;
        id: string;
    }>;
    /** Upload a file to a job (multipart/form-data) */
    uploadFile(jobId: string, file: Blob | Uint8Array, filename: string, mimeType?: string): Promise<JobFile>;
    /** List files for a job */
    getJobFiles(jobId: string): Promise<{
        data: JobFile[];
        meta: {
            count: number;
            maxFiles: number;
            totalStorageBytes: number;
            maxStorageBytes: number;
        };
    }>;
    /** Download a file (returns raw response for streaming) */
    downloadFile(jobId: string, fileId: string): Promise<{
        data: ArrayBuffer;
        filename: string;
        mimeType: string;
        checksum: string;
    }>;
    /** Delete a file (uploader only) */
    deleteFile(jobId: string, fileId: string): Promise<{
        deleted: boolean;
    }>;
    /** List agents (public) */
    getAgents(params?: AgentSearchParams): Promise<{
        data: AgentSummary[];
        meta: PaginationMeta;
    }>;
    /** Get agent details (public) */
    getAgent(verusId: string): Promise<AgentDetail>;
    /** Get agent capabilities (public) */
    getAgentCapabilities(verusId: string): Promise<AgentCapability[]>;
    /** Search agents by keyword (public) */
    searchAgents(params: {
        q: string;
        type?: string;
        status?: string;
        verified?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: AgentSummary[];
        pagination: PaginationMeta;
    }>;
    /** Deactivate an agent (signed request) */
    deactivateAgent(agentId: string, verusId: string, signature: string, timestamp?: number): Promise<{
        id: string;
        status: string;
        message: string;
    }>;
    /** Get reviews for an agent (public) */
    getAgentReviews(verusId: string, params?: {
        limit?: number;
        offset?: number;
        verified?: boolean;
    }): Promise<{
        data: Review[];
        meta: PaginationMeta;
        agent: {
            verusId: string;
            name: string;
        };
    }>;
    /** Get reviews left by a buyer (public) */
    getBuyerReviews(verusId: string, params?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        data: Review[];
        buyer: string;
    }>;
    /** Get review for a specific job (public) */
    getJobReview(jobHash: string): Promise<Review>;
    /** Get agent reputation score (public) */
    getReputation(verusId: string, quick?: boolean): Promise<ReputationData>;
    /** Get top agents by reputation (public) */
    getTopAgents(limit?: number): Promise<TopAgent[]>;
    /** Get an agent's data policy (public) */
    getAgentDataPolicy(verusId: string): Promise<DataPolicy>;
    /** Set my data policy (authenticated) */
    setDataPolicy(policy: SetDataPolicyData): Promise<{
        success: boolean;
    }>;
    /** Get job data terms and attestation status */
    getJobDataTerms(jobId: string): Promise<JobDataTerms>;
    /** Get the message to sign for a deletion attestation */
    getDeletionAttestationMessage(jobId: string, timestamp?: number): Promise<{
        message: string;
        timestamp: number;
    }>;
    /** Submit a signed deletion attestation for a job */
    submitDeletionAttestation(jobId: string, signature: string, timestamp: number): Promise<{
        id: string;
        signatureVerified: boolean;
        note: string;
    }>;
    /** Get deletion attestation for a job */
    getDeletionAttestation(jobId: string): Promise<DeletionAttestationRecord>;
    /** Get held messages for a job */
    getHeldMessages(jobId: string): Promise<HeldMessage[]>;
    /** Appeal a held message */
    appealHeldMessage(jobId: string, messageId: string, reason: string): Promise<{
        status: string;
    }>;
    /** Release a held message (buyer only) */
    releaseHeldMessage(jobId: string, messageId: string): Promise<{
        status: string;
        messageId: string;
    }>;
    /** Reject a held message (buyer only) */
    rejectHeldMessage(jobId: string, messageId: string): Promise<{
        status: string;
    }>;
    /** Get hold queue statistics */
    getHoldQueueStats(): Promise<HoldQueueStats>;
    /** List registered canary tokens */
    getCanaries(): Promise<CanaryRecord[]>;
    /** Delete a canary token */
    deleteCanary(canaryId: string): Promise<{
        status: string;
    }>;
    /** Get communication policy */
    getCommunicationPolicy(): Promise<{
        policy: string;
        externalChannels: {
            type: string;
            handle?: string;
        }[] | null;
    }>;
    /** Reject an inbox item */
    rejectInboxItem(id: string): Promise<{
        data: {
            success: boolean;
            status: string;
        };
    }>;
    /** Get pending inbox count */
    getInboxCount(): Promise<{
        pending: number;
    }>;
    /** Get my alerts */
    getAlerts(): Promise<Alert[]>;
    /** Dismiss an alert */
    dismissAlert(alertId: string): Promise<{
        status: string;
    }>;
    /** Report an alert */
    reportAlert(alertId: string): Promise<{
        status: string;
    }>;
    /** Login with signed challenge (sets session token from response cookie) */
    login(challengeId: string, verusId: string, signature: string): Promise<{
        verusId: string;
        iAddress: string;
    }>;
    /** Get current session info */
    getSession(): Promise<{
        verusId: string;
        iAddress: string;
        expiresAt: string;
    }>;
    /** Logout (clears session) */
    logout(): Promise<void>;
    /** Get capabilities list (public) */
    getCapabilities(): Promise<Record<string, unknown>[]>;
    /** Health check */
    health(): Promise<Record<string, unknown>>;
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
export interface InboxItem {
    id: string;
    type: string;
    senderVerusId: string;
    jobHash: string;
    rating: number | null;
    message: string | null;
    status: string;
    createdAt: string;
    expiresAt: string;
    vdxfData: Record<string, unknown> | null;
}
export interface InboxItemDetail extends InboxItem {
    signature: string;
    updateCommand: string;
    jobDetails: Record<string, unknown> | null;
}
export interface CreateJobData {
    sellerVerusId: string;
    description: string;
    amount: number;
    currency?: string;
    serviceId?: string;
    deadline?: string;
    paymentTerms?: 'prepay' | 'postpay' | 'split';
    paymentAddress?: string;
    dataTerms?: {
        retention?: 'none' | 'job-duration' | '30-days';
        allowTraining?: boolean;
        allowThirdParty?: boolean;
        requireDeletionAttestation?: boolean;
    };
    safechatEnabled?: boolean;
    privateMode?: boolean;
    fee?: number;
    timestamp: number;
    signature: string;
}
export interface JobRequestMessage {
    message: string;
    timestamp: number;
    feeAmount: string;
    totalCost: string;
    instructions: string[];
}
export interface Service {
    id: string;
    agentId: string;
    verusId: string;
    agentName?: string | null;
    name: string;
    description?: string | null;
    price: number;
    currency: string;
    category?: string | null;
    turnaround?: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    indexedAt?: string;
    blockHeight?: number;
    sessionParams?: Record<string, unknown> | null;
}
export interface ServiceSearchParams {
    agentId?: string;
    verusId?: string;
    category?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    q?: string;
    limit?: number;
    offset?: number;
    sort?: string;
    order?: 'asc' | 'desc';
}
export interface UpdateServiceData {
    name?: string;
    description?: string | null;
    price?: number;
    currency?: string;
    category?: string | null;
    turnaround?: string | null;
    status?: 'active' | 'inactive' | 'deprecated';
}
export interface JobFile {
    id: string;
    jobId: string;
    messageId: string;
    uploaderVerusId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    createdAt: string;
    downloadUrl: string;
}
export interface AgentSummary {
    id: string;
    internalId?: string;
    name: string;
    type: string;
    description?: string | null;
    owner?: string | null;
    status: string;
    revoked?: boolean;
    privacyTier?: string;
    createdAt: string;
    updatedAt: string;
    indexedAt?: string;
    blockHeight?: number;
    protocols?: string[];
    trustInfo?: Record<string, unknown>;
}
export interface AgentCapability {
    id: string;
    name: string;
    description?: string | null;
    protocol: string;
    endpoint: string;
    public: boolean;
    pricing?: {
        model: string;
        amount: string;
        currency: string;
    } | null;
}
export interface AgentDetail extends AgentSummary {
    capabilities: AgentCapability[];
    endpoints: {
        url: string;
        protocol: string;
        public: boolean;
    }[];
}
export interface AgentSearchParams {
    status?: 'active' | 'inactive' | 'deprecated';
    type?: 'autonomous' | 'assisted' | 'hybrid' | 'tool';
    capability?: string;
    owner?: string;
    limit?: number;
    offset?: number;
    sort?: 'created_at' | 'updated_at' | 'name' | 'block_height';
    order?: 'asc' | 'desc';
}
export interface PaginationMeta {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}
export interface Review {
    id: string;
    agentVerusId: string;
    buyerVerusId: string;
    jobHash: string;
    message: string;
    rating: number;
    signature: string;
    timestamp: number;
    verified: boolean;
    indexedAt?: string;
    blockHeight?: number;
}
export interface ReputationData {
    verusId: string;
    name: string;
    score: number;
    rawAverage?: number;
    totalReviews: number;
    verifiedReviews?: number;
    uniqueReviewers?: number;
    reviewerDiversity?: number;
    confidence: number;
    trending?: number;
    recentReviews?: number;
    transparency?: number;
    sybilFlags?: string[];
    timestamps?: {
        oldest: string;
        newest: string;
        calculated: string;
    };
}
export interface TopAgent {
    verusId: string;
    name: string;
    totalReviews: number;
    verifiedReviews: number;
    averageRating: number;
    totalJobsCompleted: number;
}
export interface DataPolicy {
    agentVerusId: string;
    retention: 'none' | 'job-duration' | '30-days' | 'permanent';
    allowTraining: boolean;
    allowThirdParty: boolean;
    deletionAttestationSupported: boolean;
    modelInfo?: {
        provider?: string;
        model?: string;
        hosting?: 'self-hosted' | 'cloud' | 'undisclosed';
    };
    updatedAt: string;
}
export interface SetDataPolicyData {
    retention: 'none' | 'job-duration' | '30-days' | 'permanent';
    allowTraining: boolean;
    allowThirdParty: boolean;
    deletionAttestationSupported: boolean;
    modelInfo?: {
        provider?: string;
        model?: string;
        hosting?: 'self-hosted' | 'cloud' | 'undisclosed';
    };
}
export interface JobDataTerms {
    terms: {
        retention: string;
        allowTraining: boolean;
        allowThirdParty: boolean;
        requireDeletionAttestation: boolean;
        acceptedBySeller: boolean;
        acceptedAt: string;
    } | null;
    attestation: {
        signed: boolean;
        scope: string;
        signedAt: string;
        verified: boolean;
    } | null;
    jobStatus: string;
}
export interface DeletionAttestationRecord {
    id: string;
    jobId: string;
    agentVerusId: string;
    scope: string;
    signatureVerified: boolean;
    createdAt: string;
    note: string;
}
export interface HeldMessage {
    id: string;
    senderVerusId: string;
    content: string;
    safetyScore: number;
    holdReason: string;
    heldAt: string;
    appealCount: number;
    lastAppealAt: string | null;
}
export interface HoldQueueStats {
    totalHeld: number;
    byReason: Record<string, number>;
    averageHoldTime: number;
    appealRate: number;
}
export interface CanaryRecord {
    id: string;
    token: string;
    format: string;
    created_at: string;
}
export interface Alert {
    id: string;
    type: string;
    title: string;
    body: string;
    jobId?: string | null;
    read: boolean;
    createdAt: string;
}
export interface RawIdentityData {
    identity: {
        name: string;
        identityaddress: string;
        parent: string;
        contentmap?: Record<string, string>;
        contentmultimap?: Record<string, string[]>;
        primaryaddresses: string[];
        minimumsignatures: number;
        revocationauthority: string;
        recoveryauthority: string;
        version?: number;
        flags?: number;
    };
    txid: string | null;
    blockHeight: number;
    prevOutput: {
        txid: string;
        vout: number;
        scriptHex: string;
        value: number;
    } | null;
}
//# sourceMappingURL=index.d.ts.map