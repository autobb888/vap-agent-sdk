"use strict";
/**
 * VAPClient — REST client for the Verus Agent Platform API.
 * Handles authentication, session management, and all API calls.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VAPError = exports.VAPClient = void 0;
class VAPClient {
    baseUrl;
    sessionToken;
    timeout;
    constructor(config) {
        this.baseUrl = config.vapUrl.replace(/\/+$/, '');
        this.sessionToken = config.sessionToken || null;
        this.timeout = config.timeout || 30_000;
    }
    setSessionToken(token) {
        this.sessionToken = token;
    }
    getSessionToken() {
        return this.sessionToken;
    }
    getBaseUrl() {
        return this.baseUrl;
    }
    async request(method, path, body) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        try {
            const headers = {
                'Accept': 'application/json',
            };
            if (body) {
                headers['Content-Type'] = 'application/json';
            }
            if (this.sessionToken) {
                headers['Cookie'] = `verus_session=${this.sessionToken}`;
            }
            const response = await fetch(`${this.baseUrl}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            const data = await response.json();
            if (!response.ok) {
                const error = (data?.error ?? {});
                throw new VAPError(error.message || `HTTP ${response.status}`, error.code || 'HTTP_ERROR', response.status);
            }
            return data;
        }
        finally {
            clearTimeout(timer);
        }
    }
    // ------------------------------------------
    // Auth endpoints
    // ------------------------------------------
    /** Get authentication challenge for login */
    async getAuthChallenge() {
        const response = await fetch(`${this.baseUrl}/auth/challenge`);
        let data;
        try {
            data = await response.json();
        }
        catch {
            throw new VAPError('Invalid JSON in auth challenge response', 'PARSE_ERROR', response.status);
        }
        return data.data;
    }
    // ------------------------------------------
    // Transaction endpoints
    // ------------------------------------------
    /** Get chain info (public — no auth required) */
    async getChainInfo() {
        return this.request('GET', '/v1/tx/info');
    }
    /** Get UTXOs for authenticated identity */
    async getUtxos() {
        return this.request('GET', '/v1/tx/utxos');
    }
    /** Broadcast a signed raw transaction */
    async broadcast(rawhex) {
        return this.request('POST', '/v1/tx/broadcast', { rawhex });
    }
    /** Get transaction status */
    async getTxStatus(txid) {
        return this.request('GET', `/v1/tx/status/${txid}`);
    }
    // ------------------------------------------
    // Onboarding endpoints
    // ------------------------------------------
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
    async registerIdentity(name, wif, identityAddress, network = 'verustest') {
        const { generateKeypair, keypairFromWIF } = await Promise.resolve().then(() => __importStar(require('../identity/keypair.js')));
        // Get keypair info from WIF
        const keypair = keypairFromWIF(wif, network);
        // Step 1: Get challenge
        const challengeRes = await this.onboard(name, keypair.address, keypair.pubkey);
        if (!challengeRes.challenge || !challengeRes.token) {
            throw new VAPError('Invalid challenge response', 'ONBOARD_ERROR', 500);
        }
        // Step 2: Sign challenge with verifymessage-compatible signature
        const { signMessage } = await Promise.resolve().then(() => __importStar(require('../identity/signer.js')));
        const signature = signMessage(wif, challengeRes.challenge, network);
        // Step 3: Submit with signature
        const result = await this.onboardWithSignature(name, keypair.address, keypair.pubkey, challengeRes.challenge, challengeRes.token, signature);
        if (!result.onboardId) {
            throw new VAPError('No onboardId received', 'ONBOARD_ERROR', 500);
        }
        // Step 4: Poll until registered
        return this.pollOnboardStatus(result.onboardId);
    }
    /** Poll onboarding status until complete or failed */
    async pollOnboardStatus(onboardId, maxAttempts = 30, intervalMs = 10000) {
        for (let i = 0; i < maxAttempts; i++) {
            const status = await this.onboardStatus(onboardId);
            if (status.status === 'registered') {
                return status;
            }
            if (status.status === 'failed') {
                throw new VAPError(status.error || 'Registration failed', 'ONBOARD_FAILED', 500);
            }
            // Wait before next poll
            await new Promise(r => setTimeout(r, intervalMs));
        }
        throw new VAPError('Registration timeout', 'ONBOARD_TIMEOUT', 504);
    }
    /** Request onboarding challenge (step 1) */
    async onboard(name, address, pubkey) {
        return this.request('POST', '/v1/onboard', { name, address, pubkey });
    }
    /** Submit onboarding with signed challenge (step 2) */
    async onboardWithSignature(name, address, pubkey, challenge, token, signature) {
        return this.request('POST', '/v1/onboard', {
            name, address, pubkey, challenge, token, signature,
        });
    }
    /** Check onboarding status */
    async onboardStatus(id) {
        return this.request('GET', `/v1/onboard/status/${id}`);
    }
    // ------------------------------------------
    // Agent/Service endpoints
    // ------------------------------------------
    /** Register agent profile */
    async registerAgent(data) {
        return this.request('POST', '/v1/register', data);
    }
    /** Register a service */
    async registerService(data) {
        return this.request('POST', '/v1/my-services', data);
    }
    /** Get jobs for authenticated identity */
    async getMyJobs(params) {
        const query = new URLSearchParams();
        if (params?.status)
            query.set('status', params.status);
        if (params?.role)
            query.set('role', params.role);
        const qs = query.toString();
        return this.request('GET', `/v1/me/jobs${qs ? `?${qs}` : ''}`);
    }
    /** Accept a job */
    async acceptJob(jobId, signature, timestamp) {
        return this.request('POST', `/v1/jobs/${jobId}/accept`, { signature, timestamp });
    }
    /** Deliver a job */
    async deliverJob(jobId, signature, message, content) {
        return this.request('POST', `/v1/jobs/${jobId}/deliver`, { signature, message, content });
    }
    /** Get job details */
    async getJob(jobId) {
        return this.request('GET', `/v1/jobs/${jobId}`);
    }
    // ------------------------------------------
    // Chat endpoints
    // ------------------------------------------
    // ------------------------------------------
    // Safety endpoints
    // ------------------------------------------
    /** Register a canary token so SafeChat watches for leaks */
    async registerCanary(canary) {
        return this.request('POST', '/v1/me/canary', canary);
    }
    /** Set communication policy (safechat_only | safechat_preferred | external) */
    async setCommunicationPolicy(policy, externalChannels) {
        return this.request('POST', '/v1/me/communication-policy', { policy, externalChannels });
    }
    // ------------------------------------------
    // Chat endpoints
    // ------------------------------------------
    /** Get chat messages for a job */
    async getChatMessages(jobId, limit) {
        const qs = limit ? `?limit=${limit}` : '';
        return this.request('GET', `/v1/chat/${jobId}/messages${qs}`);
    }
    /** Send a chat message */
    async sendChatMessage(jobId, content) {
        return this.request('POST', `/v1/chat/${jobId}/messages`, { content });
    }
    // ------------------------------------------
    // Agent Profile endpoints
    // ------------------------------------------
    /** Update agent profile (privacy tier, etc.) */
    async updateAgentProfile(data) {
        return this.request('PATCH', '/v1/me/agent', data);
    }
    // ------------------------------------------
    // Job Extension endpoints
    // ------------------------------------------
    /** Request a session extension (additional payment for more work) */
    async requestExtension(jobId, amount, reason) {
        return this.request('POST', `/v1/jobs/${jobId}/extensions`, { amount, reason });
    }
    /** Get extensions for a job */
    async getExtensions(jobId) {
        return this.request('GET', `/v1/jobs/${jobId}/extensions`);
    }
    /** Approve an extension request */
    async approveExtension(jobId, extensionId) {
        return this.request('POST', `/v1/jobs/${jobId}/extensions/${extensionId}/approve`, {});
    }
    /** Reject an extension request */
    async rejectExtension(jobId, extensionId) {
        return this.request('POST', `/v1/jobs/${jobId}/extensions/${extensionId}/reject`, {});
    }
    /** Submit extension payment txids */
    async payExtension(jobId, extensionId, agentTxid, feeTxid) {
        return this.request('POST', `/v1/jobs/${jobId}/extensions/${extensionId}/payment`, { agentTxid, feeTxid });
    }
    // ------------------------------------------
    // Attestation endpoints
    // ------------------------------------------
    /** Submit a deletion attestation */
    async submitAttestation(attestation) {
        return this.request('POST', '/v1/me/attestations', attestation);
    }
    /** Get attestations for an agent */
    async getAttestations(agentId) {
        return this.request('GET', `/v1/agents/${agentId}/attestations`);
    }
    // ------------------------------------------
    // Pricing Oracle endpoints
    // ------------------------------------------
    /** Query the platform pricing oracle */
    async queryPricingOracle(params) {
        const query = new URLSearchParams();
        if (params.model)
            query.set('model', params.model);
        if (params.category)
            query.set('category', params.category);
        if (params.inputTokens)
            query.set('inputTokens', String(params.inputTokens));
        if (params.outputTokens)
            query.set('outputTokens', String(params.outputTokens));
        if (params.privacyTier)
            query.set('privacyTier', params.privacyTier);
        if (params.vrscUsdRate)
            query.set('vrscUsdRate', String(params.vrscUsdRate));
        const qs = query.toString();
        return this.request('GET', `/v1/pricing/recommend${qs ? `?${qs}` : ''}`);
    }
}
exports.VAPClient = VAPClient;
// ------------------------------------------
// Error class
// ------------------------------------------
class VAPError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode) {
        super(message);
        this.name = 'VAPError';
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.VAPError = VAPError;
//# sourceMappingURL=index.js.map