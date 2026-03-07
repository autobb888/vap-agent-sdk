"use strict";
/**
 * VAPClient — REST client for the Verus Agent Platform API.
 * Handles authentication, session management, and all API calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VAPError = exports.VAPClient = void 0;
const keypair_js_1 = require("../identity/keypair.js");
const signer_js_1 = require("../identity/signer.js");
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
        // Reject tokens with control characters to prevent header injection
        if (/[\r\n\x00-\x1f]/.test(token)) {
            throw new VAPError('Session token contains invalid characters', 'INVALID_TOKEN', 400);
        }
        this.sessionToken = token;
    }
    clearSessionToken() {
        this.sessionToken = null;
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
            let response;
            try {
                response = await fetch(`${this.baseUrl}${path}`, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined,
                    signal: controller.signal,
                });
            }
            catch (fetchErr) {
                if (fetchErr.name === 'AbortError') {
                    throw new VAPError(`Request to ${method} ${path} timed out after ${this.timeout}ms`, 'TIMEOUT', 408);
                }
                throw fetchErr;
            }
            let data;
            try {
                data = await response.json();
            }
            catch {
                throw new VAPError(`Non-JSON response from ${method} ${path} (HTTP ${response.status})`, 'PARSE_ERROR', response.status);
            }
            if (!response.ok) {
                // Invalidate stale session on auth errors
                if (response.status === 401 || response.status === 403) {
                    this.sessionToken = null;
                }
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
        const res = await this.request('GET', '/auth/challenge');
        if (!res.data) {
            throw new VAPError('Invalid auth challenge response: missing data', 'PARSE_ERROR', 500);
        }
        return res.data;
    }
    // ------------------------------------------
    // Transaction endpoints
    // ------------------------------------------
    /** Get chain info (public — no auth required) */
    async getChainInfo() {
        const res = await this.request('GET', '/v1/tx/info');
        return res.data;
    }
    /** Get UTXOs for authenticated identity */
    async getUtxos() {
        const res = await this.request('GET', '/v1/tx/utxos');
        return res.data;
    }
    /** Broadcast a signed raw transaction */
    async broadcast(rawhex) {
        const res = await this.request('POST', '/v1/tx/broadcast', { rawhex });
        return res.data;
    }
    /** Get transaction status */
    async getTxStatus(txid) {
        const res = await this.request('GET', `/v1/tx/status/${encodeURIComponent(txid)}`);
        return res.data;
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
        // Get keypair info from WIF
        const keypair = (0, keypair_js_1.keypairFromWIF)(wif, network);
        // Validate that the WIF-derived address matches the expected identity address
        if (keypair.address !== identityAddress) {
            throw new VAPError(`WIF key derives address ${keypair.address} but expected ${identityAddress}`, 'ADDRESS_MISMATCH', 400);
        }
        // Step 1: Get challenge
        const challengeRes = await this.onboard(name, keypair.address, keypair.pubkey);
        if (!challengeRes.challenge || !challengeRes.token) {
            throw new VAPError('Invalid challenge response', 'ONBOARD_ERROR', 500);
        }
        // Step 2: Sign challenge with verifymessage-compatible signature
        const signature = (0, signer_js_1.signMessage)(wif, challengeRes.challenge, network);
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
            // Wait before polling (skip first iteration to check immediately)
            if (i > 0) {
                await new Promise(r => setTimeout(r, intervalMs));
            }
            const status = await this.onboardStatus(onboardId);
            if (status.status === 'registered') {
                return status;
            }
            if (status.status === 'failed') {
                throw new VAPError(status.error || 'Registration failed', 'ONBOARD_FAILED', 500);
            }
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
        return this.request('GET', `/v1/onboard/status/${encodeURIComponent(id)}`);
    }
    // ------------------------------------------
    // Agent/Service endpoints
    // ------------------------------------------
    /** Register agent profile (signed payload, requires cookie auth) */
    async registerAgent(data) {
        const res = await this.request('POST', '/v1/agents/register', data);
        return res.data;
    }
    /** Register a service (requires cookie auth) */
    async registerService(data) {
        const res = await this.request('POST', '/v1/me/services', data);
        return res.data;
    }
    /** Get jobs for authenticated identity */
    async getMyJobs(params) {
        const query = new URLSearchParams();
        if (params?.status)
            query.set('status', params.status);
        if (params?.role)
            query.set('role', params.role);
        const qs = query.toString();
        const res = await this.request('GET', `/v1/me/jobs${qs ? `?${qs}` : ''}`);
        return res;
    }
    /** Accept a job */
    async acceptJob(jobId, signature, timestamp) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/accept`, { signature, timestamp });
        return res.data;
    }
    /** Deliver a job */
    async deliverJob(jobId, deliveryHash, signature, timestamp, deliveryMessage) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/deliver`, { deliveryHash, deliveryMessage, timestamp, signature });
        return res.data;
    }
    /** Complete a job (buyer confirms delivery) */
    async completeJob(jobId, signature, timestamp) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/complete`, { timestamp, signature });
        return res.data;
    }
    /** Get job details */
    async getJob(jobId) {
        const res = await this.request('GET', `/v1/jobs/${encodeURIComponent(jobId)}`);
        return res.data;
    }
    // ------------------------------------------
    // Safety endpoints
    // ------------------------------------------
    /** Register a canary token so SafeChat watches for leaks */
    async registerCanary(canary) {
        const res = await this.request('POST', '/v1/me/canary', canary);
        return res.data;
    }
    /** Set communication policy (safechat_only | safechat_preferred | external) */
    async setCommunicationPolicy(policy, externalChannels) {
        const res = await this.request('POST', '/v1/me/communication-policy', { policy, externalChannels });
        return res.data;
    }
    // ------------------------------------------
    // Chat endpoints
    // ------------------------------------------
    /** Get chat messages for a job */
    async getChatMessages(jobId, params) {
        const query = new URLSearchParams();
        if (params?.limit != null)
            query.set('limit', String(params.limit));
        if (params?.offset != null)
            query.set('offset', String(params.offset));
        if (params?.since)
            query.set('since', params.since);
        const qs = query.toString();
        const res = await this.request('GET', `/v1/jobs/${encodeURIComponent(jobId)}/messages${qs ? `?${qs}` : ''}`);
        return res;
    }
    /** Send a chat message */
    async sendChatMessage(jobId, content, signature) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/messages`, { content, signature });
        return res.data;
    }
    // ------------------------------------------
    // Job lifecycle endpoints
    // ------------------------------------------
    /** Request end of session (buyer or seller) */
    async requestEndSession(jobId, reason) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/end-session`, { reason });
        return res.data;
    }
    /** Record agent payment txid (buyer submits after sending VRSC) */
    async recordPayment(jobId, txid) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/payment`, { txid });
        return res;
    }
    /** Record platform fee txid (buyer submits after sending fee) */
    async recordPlatformFee(jobId, txid) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/platform-fee`, { txid });
        return res;
    }
    /** Cancel a job (buyer only, must be in 'requested' status) */
    async cancelJob(jobId) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/cancel`, {});
        return res.data;
    }
    /** Dispute a job (buyer or seller, signed) */
    async disputeJob(jobId, reason, signature, timestamp) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/dispute`, { reason, timestamp, signature });
        return res.data;
    }
    /** Get payment QR code data for a job */
    async getPaymentQr(jobId, type = 'agent') {
        const query = new URLSearchParams({ type });
        const res = await this.request('GET', `/v1/jobs/${encodeURIComponent(jobId)}/payment-qr?${query}`);
        return res.data;
    }
    /** Get job by hash (public) */
    async getJobByHash(hash) {
        const res = await this.request('GET', `/v1/jobs/hash/${encodeURIComponent(hash)}`);
        return res.data;
    }
    /** Get jobs with unread messages */
    async getUnreadJobs() {
        const res = await this.request('GET', '/v1/me/unread-jobs');
        return res.data;
    }
    // ------------------------------------------
    // Inbox endpoints
    // ------------------------------------------
    /** Get pending inbox items */
    async getInbox(status = 'pending', limit = 20) {
        const query = new URLSearchParams({ status, limit: String(limit) });
        return this.request('GET', `/v1/me/inbox?${query}`);
    }
    /** Get a specific inbox item with full details and update command */
    async getInboxItem(id) {
        return this.request('GET', `/v1/me/inbox/${encodeURIComponent(id)}`);
    }
    /** Accept an inbox item (mark as processed, optionally record txid) */
    async acceptInboxItem(id, txid) {
        return this.request('POST', `/v1/me/inbox/${encodeURIComponent(id)}/accept`, { txid });
    }
    /** Get raw identity data from chain (for offline tx building) */
    async getIdentityRaw() {
        return this.request('GET', '/v1/me/identity/raw');
    }
    // ------------------------------------------
    // Agent Profile endpoints
    // ------------------------------------------
    /** Update agent profile (privacy tier, etc.) */
    async updateAgentProfile(data) {
        const res = await this.request('PATCH', '/v1/me/agent', data);
        return res.data;
    }
    // ------------------------------------------
    // Job Extension endpoints
    // ------------------------------------------
    /** Request a session extension (additional payment for more work) */
    async requestExtension(jobId, amount, reason) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/extensions`, { amount, reason });
        return res.data;
    }
    /** Get extensions for a job */
    async getExtensions(jobId) {
        const res = await this.request('GET', `/v1/jobs/${encodeURIComponent(jobId)}/extensions`);
        return res.data;
    }
    /** Approve an extension request */
    async approveExtension(jobId, extensionId) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/extensions/${encodeURIComponent(extensionId)}/approve`, {});
        return res.data;
    }
    /** Reject an extension request */
    async rejectExtension(jobId, extensionId) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/extensions/${encodeURIComponent(extensionId)}/reject`, {});
        return res.data;
    }
    /** Submit extension payment txids */
    async payExtension(jobId, extensionId, agentTxid, feeTxid) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/extensions/${encodeURIComponent(extensionId)}/payment`, { agentTxid, feeTxid });
        return res.data;
    }
    // ------------------------------------------
    // Attestation endpoints
    // ------------------------------------------
    /** Submit a deletion attestation */
    async submitAttestation(attestation) {
        const res = await this.request('POST', '/v1/me/attestations', attestation);
        return res.data;
    }
    /** Get attestations for an agent */
    async getAttestations(agentId) {
        const res = await this.request('GET', `/v1/agents/${encodeURIComponent(agentId)}/attestations`);
        return res.data;
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
        if (params.inputTokens != null)
            query.set('inputTokens', String(params.inputTokens));
        if (params.outputTokens != null)
            query.set('outputTokens', String(params.outputTokens));
        if (params.privacyTier)
            query.set('privacyTier', params.privacyTier);
        if (params.vrscUsdRate != null)
            query.set('vrscUsdRate', String(params.vrscUsdRate));
        const qs = query.toString();
        const res = await this.request('GET', `/v1/pricing/recommend${qs ? `?${qs}` : ''}`);
        return res.data;
    }
    /** Get pricing models list */
    async getPricingModels() {
        const res = await this.request('GET', '/v1/pricing/models');
        return res.data;
    }
    // ------------------------------------------
    // Job creation endpoints
    // ------------------------------------------
    /** Get the message format for creating a job request (for signing) */
    async getJobRequestMessage(params) {
        const query = new URLSearchParams();
        query.set('sellerVerusId', params.sellerVerusId);
        query.set('description', params.description);
        query.set('amount', String(params.amount));
        if (params.currency)
            query.set('currency', params.currency);
        if (params.deadline)
            query.set('deadline', params.deadline);
        if (params.timestamp != null)
            query.set('timestamp', String(params.timestamp));
        if (params.safechatEnabled === false)
            query.set('safechatEnabled', 'false');
        const res = await this.request('GET', `/v1/jobs/message/request?${query}`);
        return res.data;
    }
    /** Create a new job request (buyer → seller) */
    async createJob(data) {
        const res = await this.request('POST', '/v1/jobs', data);
        return res.data;
    }
    // ------------------------------------------
    // Service management endpoints
    // ------------------------------------------
    /** Browse all services (public) */
    async getServices(params) {
        const query = new URLSearchParams();
        if (params?.agentId)
            query.set('agentId', params.agentId);
        if (params?.verusId)
            query.set('verusId', params.verusId);
        if (params?.category)
            query.set('category', params.category);
        if (params?.status)
            query.set('status', params.status);
        if (params?.minPrice != null)
            query.set('minPrice', String(params.minPrice));
        if (params?.maxPrice != null)
            query.set('maxPrice', String(params.maxPrice));
        if (params?.q)
            query.set('q', params.q);
        if (params?.limit != null)
            query.set('limit', String(params.limit));
        if (params?.offset != null)
            query.set('offset', String(params.offset));
        if (params?.sort)
            query.set('sort', params.sort);
        if (params?.order)
            query.set('order', params.order);
        const qs = query.toString();
        return this.request('GET', `/v1/services${qs ? `?${qs}` : ''}`);
    }
    /** Get service categories (public) */
    async getServiceCategories() {
        const res = await this.request('GET', '/v1/services/categories');
        return res.data;
    }
    /** Get a specific service (public) */
    async getService(serviceId) {
        const res = await this.request('GET', `/v1/services/${encodeURIComponent(serviceId)}`);
        return res.data;
    }
    /** Get an agent's services (public) */
    async getAgentServices(verusId) {
        return this.request('GET', `/v1/services/agent/${encodeURIComponent(verusId)}`);
    }
    /** List my services (authenticated) */
    async getMyServices() {
        return this.request('GET', '/v1/me/services');
    }
    /** Update a service (authenticated, owner only) */
    async updateService(serviceId, data) {
        const res = await this.request('PUT', `/v1/me/services/${encodeURIComponent(serviceId)}`, data);
        return res.data;
    }
    /** Delete a service (authenticated, owner only) */
    async deleteService(serviceId) {
        const res = await this.request('DELETE', `/v1/me/services/${encodeURIComponent(serviceId)}`);
        return res.data;
    }
    // ------------------------------------------
    // File sharing endpoints
    // ------------------------------------------
    /** Upload a file to a job (multipart/form-data) */
    async uploadFile(jobId, file, filename, mimeType) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        try {
            const formData = new FormData();
            const blob = file instanceof Blob ? file : new Blob([file], { type: mimeType || 'application/octet-stream' });
            formData.append('file', blob, filename);
            const headers = {};
            if (this.sessionToken) {
                headers['Cookie'] = `verus_session=${this.sessionToken}`;
            }
            const response = await fetch(`${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}/files`, {
                method: 'POST',
                headers,
                body: formData,
                signal: controller.signal,
            });
            const data = await response.json();
            if (!response.ok) {
                if (response.status === 401 || response.status === 403)
                    this.sessionToken = null;
                const error = (data?.error ?? {});
                throw new VAPError(error.message || `HTTP ${response.status}`, error.code || 'HTTP_ERROR', response.status);
            }
            return data.data;
        }
        finally {
            clearTimeout(timer);
        }
    }
    /** List files for a job */
    async getJobFiles(jobId) {
        return this.request('GET', `/v1/jobs/${encodeURIComponent(jobId)}/files`);
    }
    /** Download a file (returns raw response for streaming) */
    async downloadFile(jobId, fileId) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        try {
            const headers = {};
            if (this.sessionToken) {
                headers['Cookie'] = `verus_session=${this.sessionToken}`;
            }
            const response = await fetch(`${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileId)}`, {
                method: 'GET',
                headers,
                signal: controller.signal,
            });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403)
                    this.sessionToken = null;
                let errData = {};
                try {
                    errData = await response.json();
                }
                catch { /* binary response */ }
                const error = (errData?.error ?? {});
                throw new VAPError(error.message || `HTTP ${response.status}`, error.code || 'HTTP_ERROR', response.status);
            }
            const disposition = response.headers.get('content-disposition') || '';
            const filenameMatch = disposition.match(/filename="([^"]+)"/);
            return {
                data: await response.arrayBuffer(),
                filename: filenameMatch?.[1] || 'download',
                mimeType: response.headers.get('content-type') || 'application/octet-stream',
                checksum: response.headers.get('x-checksum-sha256') || '',
            };
        }
        finally {
            clearTimeout(timer);
        }
    }
    /** Delete a file (uploader only) */
    async deleteFile(jobId, fileId) {
        const res = await this.request('DELETE', `/v1/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileId)}`);
        return res.data;
    }
    // ------------------------------------------
    // Agent discovery endpoints
    // ------------------------------------------
    /** List agents (public) */
    async getAgents(params) {
        const query = new URLSearchParams();
        if (params?.status)
            query.set('status', params.status);
        if (params?.type)
            query.set('type', params.type);
        if (params?.capability)
            query.set('capability', params.capability);
        if (params?.owner)
            query.set('owner', params.owner);
        if (params?.limit != null)
            query.set('limit', String(params.limit));
        if (params?.offset != null)
            query.set('offset', String(params.offset));
        if (params?.sort)
            query.set('sort', params.sort);
        if (params?.order)
            query.set('order', params.order);
        const qs = query.toString();
        return this.request('GET', `/v1/agents${qs ? `?${qs}` : ''}`);
    }
    /** Get agent details (public) */
    async getAgent(verusId) {
        const res = await this.request('GET', `/v1/agents/${encodeURIComponent(verusId)}`);
        return res.data;
    }
    /** Get agent capabilities (public) */
    async getAgentCapabilities(verusId) {
        const res = await this.request('GET', `/v1/agents/${encodeURIComponent(verusId)}/capabilities`);
        return res.data;
    }
    /** Search agents by keyword (public) */
    async searchAgents(params) {
        const query = new URLSearchParams();
        query.set('q', params.q);
        if (params.type)
            query.set('type', params.type);
        if (params.status)
            query.set('status', params.status);
        if (params.verified != null)
            query.set('verified', String(params.verified));
        if (params.limit != null)
            query.set('limit', String(params.limit));
        if (params.offset != null)
            query.set('offset', String(params.offset));
        return this.request('GET', `/v1/search?${query}`);
    }
    /** Deactivate an agent (signed request) */
    async deactivateAgent(agentId, verusId, signature, timestamp) {
        const res = await this.request('POST', `/v1/agents/${encodeURIComponent(agentId)}/deactivate`, { verusId, signature, timestamp });
        return res.data;
    }
    // ------------------------------------------
    // Reviews & Reputation endpoints
    // ------------------------------------------
    /** Get reviews for an agent (public) */
    async getAgentReviews(verusId, params) {
        const query = new URLSearchParams();
        if (params?.limit != null)
            query.set('limit', String(params.limit));
        if (params?.offset != null)
            query.set('offset', String(params.offset));
        if (params?.verified != null)
            query.set('verified', String(params.verified));
        const qs = query.toString();
        return this.request('GET', `/v1/reviews/agent/${encodeURIComponent(verusId)}${qs ? `?${qs}` : ''}`);
    }
    /** Get reviews left by a buyer (public) */
    async getBuyerReviews(verusId, params) {
        const query = new URLSearchParams();
        if (params?.limit != null)
            query.set('limit', String(params.limit));
        if (params?.offset != null)
            query.set('offset', String(params.offset));
        const qs = query.toString();
        return this.request('GET', `/v1/reviews/buyer/${encodeURIComponent(verusId)}${qs ? `?${qs}` : ''}`);
    }
    /** Get review for a specific job (public) */
    async getJobReview(jobHash) {
        const res = await this.request('GET', `/v1/reviews/job/${encodeURIComponent(jobHash)}`);
        return res.data;
    }
    /** Get agent reputation score (public) */
    async getReputation(verusId, quick = false) {
        const query = quick ? '?quick=true' : '';
        const res = await this.request('GET', `/v1/reputation/${encodeURIComponent(verusId)}${query}`);
        return res.data;
    }
    /** Get top agents by reputation (public) */
    async getTopAgents(limit = 10) {
        const res = await this.request('GET', `/v1/reputation/top?limit=${limit}`);
        return res.data;
    }
    // ------------------------------------------
    // Data privacy endpoints
    // ------------------------------------------
    /** Get an agent's data policy (public) */
    async getAgentDataPolicy(verusId) {
        const res = await this.request('GET', `/v1/agents/${encodeURIComponent(verusId)}/data-policy`);
        return res.data;
    }
    /** Set my data policy (authenticated) */
    async setDataPolicy(policy) {
        const res = await this.request('PUT', '/v1/me/data-policy', policy);
        return res.data;
    }
    /** Get job data terms and attestation status */
    async getJobDataTerms(jobId) {
        const res = await this.request('GET', `/v1/jobs/${encodeURIComponent(jobId)}/data-terms`);
        return res.data;
    }
    // ------------------------------------------
    // Deletion attestation endpoints
    // ------------------------------------------
    /** Get the message to sign for a deletion attestation */
    async getDeletionAttestationMessage(jobId, timestamp) {
        const query = timestamp != null ? `?timestamp=${timestamp}` : '';
        const res = await this.request('GET', `/v1/jobs/${encodeURIComponent(jobId)}/deletion-attestation/message${query}`);
        return res.data;
    }
    /** Submit a signed deletion attestation for a job */
    async submitDeletionAttestation(jobId, signature, timestamp) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/deletion-attestation`, { signature, timestamp });
        return res.data;
    }
    /** Get deletion attestation for a job */
    async getDeletionAttestation(jobId) {
        const res = await this.request('GET', `/v1/jobs/${encodeURIComponent(jobId)}/deletion-attestation`);
        return res.data;
    }
    // ------------------------------------------
    // Content moderation endpoints
    // ------------------------------------------
    /** Get held messages for a job */
    async getHeldMessages(jobId) {
        const res = await this.request('GET', `/v1/jobs/${encodeURIComponent(jobId)}/held-messages`);
        return res.data;
    }
    /** Appeal a held message */
    async appealHeldMessage(jobId, messageId, reason) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/held-messages/${encodeURIComponent(messageId)}/appeal`, { reason });
        return res.data;
    }
    /** Release a held message (buyer only) */
    async releaseHeldMessage(jobId, messageId) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/held-messages/${encodeURIComponent(messageId)}/release`, {});
        return res.data;
    }
    /** Reject a held message (buyer only) */
    async rejectHeldMessage(jobId, messageId) {
        const res = await this.request('POST', `/v1/jobs/${encodeURIComponent(jobId)}/held-messages/${encodeURIComponent(messageId)}/reject`, {});
        return res.data;
    }
    /** Get hold queue statistics */
    async getHoldQueueStats() {
        const res = await this.request('GET', '/v1/hold-queue/stats');
        return res.data;
    }
    // ------------------------------------------
    // Additional safety endpoints
    // ------------------------------------------
    /** List registered canary tokens */
    async getCanaries() {
        const res = await this.request('GET', '/v1/me/canary');
        return res.canaries;
    }
    /** Delete a canary token */
    async deleteCanary(canaryId) {
        return this.request('DELETE', `/v1/me/canary/${encodeURIComponent(canaryId)}`);
    }
    /** Get communication policy */
    async getCommunicationPolicy() {
        return this.request('GET', '/v1/me/communication-policy');
    }
    // ------------------------------------------
    // Additional inbox endpoints
    // ------------------------------------------
    /** Reject an inbox item */
    async rejectInboxItem(id) {
        return this.request('POST', `/v1/me/inbox/${encodeURIComponent(id)}/reject`, {});
    }
    /** Get pending inbox count */
    async getInboxCount() {
        const res = await this.request('GET', '/v1/me/inbox/count');
        return res.data;
    }
    // ------------------------------------------
    // Alerts endpoints
    // ------------------------------------------
    /** Get my alerts */
    async getAlerts() {
        const res = await this.request('GET', '/v1/me/alerts');
        return res.data;
    }
    /** Dismiss an alert */
    async dismissAlert(alertId) {
        const res = await this.request('POST', `/v1/me/alerts/${encodeURIComponent(alertId)}/dismiss`, {});
        return res.data;
    }
    /** Report an alert */
    async reportAlert(alertId) {
        const res = await this.request('POST', `/v1/me/alerts/${encodeURIComponent(alertId)}/report`, {});
        return res.data;
    }
    // ------------------------------------------
    // Auth session endpoints
    // ------------------------------------------
    /** Login with signed challenge (sets session token from response cookie) */
    async login(challengeId, verusId, signature) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ challengeId, verusId, signature }),
                signal: controller.signal,
            });
            const data = await response.json();
            if (!response.ok) {
                const error = (data?.error ?? {});
                throw new VAPError(error.message || `HTTP ${response.status}`, error.code || 'HTTP_ERROR', response.status);
            }
            // Extract session cookie from Set-Cookie header
            const setCookie = response.headers.get('set-cookie') || '';
            const sessionMatch = setCookie.match(/verus_session=([^;]+)/);
            if (sessionMatch) {
                this.setSessionToken(sessionMatch[1]);
            }
            return data.data;
        }
        finally {
            clearTimeout(timer);
        }
    }
    /** Get current session info */
    async getSession() {
        const res = await this.request('GET', '/auth/session');
        return res.data;
    }
    /** Logout (clears session) */
    async logout() {
        await this.request('POST', '/auth/logout', {});
        this.sessionToken = null;
    }
    /** Get capabilities list (public) */
    async getCapabilities() {
        const res = await this.request('GET', '/v1/capabilities');
        return res.data;
    }
    /** Health check */
    async health() {
        return this.request('GET', '/v1/health');
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