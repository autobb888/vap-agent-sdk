"use strict";
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
exports.VAPAgent = void 0;
const node_events_1 = require("node:events");
const index_js_1 = require("./client/index.js");
const keypair_js_1 = require("./identity/keypair.js");
const signer_js_1 = require("./identity/signer.js");
const client_js_1 = require("./chat/client.js");
const attestation_js_1 = require("./privacy/attestation.js");
const calculator_js_1 = require("./pricing/calculator.js");
class VAPAgent extends node_events_1.EventEmitter {
    client;
    keypair = null;
    identityName;
    iAddress;
    wif;
    handler;
    jobConfig;
    networkType = 'verustest';
    pollTimer = null;
    running = false;
    chatClient = null;
    chatHandler = null;
    vapUrl;
    constructor(config) {
        super();
        this.vapUrl = config.vapUrl;
        this.client = new index_js_1.VAPClient({ vapUrl: config.vapUrl });
        this.wif = config.wif || null;
        this.identityName = config.identityName || null;
        this.iAddress = config.iAddress || null;
        this.handler = config.handler || null;
        this.jobConfig = config.jobConfig || { pollInterval: 30_000 };
        this.networkType = config.network || 'verustest';
    }
    /**
     * Generate a new keypair for this agent.
     * Call this before register() if no WIF was provided.
     */
    generateKeys(network = 'verustest') {
        this.keypair = (0, keypair_js_1.generateKeypair)(network);
        this.wif = this.keypair.wif;
        return this.keypair;
    }
    /**
     * Register a new identity on the Verus Agent Platform.
     * VAP creates a subID under agentplatform@ with your R-address.
     *
     * @param name - Desired agent name (e.g. "myagent")
     * @returns Identity info once registered
     */
    async register(name, network = 'verustest') {
        this.networkType = network;
        if (!this.keypair && this.wif) {
            this.keypair = (0, keypair_js_1.keypairFromWIF)(this.wif, network);
        }
        else if (!this.keypair) {
            this.generateKeys(network);
        }
        const kp = this.keypair;
        console.log(`[VAP Agent] Registering "${name}.agentplatform@"...`);
        // Step 1: Request challenge
        console.log(`[VAP Agent] Requesting challenge...`);
        const challengeResp = await this.client.onboard(name, kp.address, kp.pubkey);
        if (challengeResp.status !== 'challenge') {
            throw new Error(`Unexpected response: ${JSON.stringify(challengeResp)}`);
        }
        // Step 2: Sign the challenge with our private key
        const challenge = challengeResp.challenge;
        const token = challengeResp.token;
        // Onboarding: Use IdentitySignature format with R-address as identity
        // (the local verification expects this format, not legacy signMessage)
        const signature = (0, signer_js_1.signChallenge)(this.wif, challenge, kp.address, network);
        console.log(`[VAP Agent] Challenge signed. Submitting registration...`);
        // Step 3: Submit with signature
        const result = await this.client.onboardWithSignature(name, kp.address, kp.pubkey, challenge, token, signature);
        // Poll for completion (blocks can take 1-15 minutes depending on network)
        console.log(`[VAP Agent] Waiting for block confirmation (this can take several minutes)...`);
        let status = await this.client.onboardStatus(result.onboardId);
        let attempts = 0;
        const maxAttempts = 120; // ~20 minutes at 10s intervals
        while (status.status !== 'registered' && status.status !== 'failed' && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 10_000));
            status = await this.client.onboardStatus(result.onboardId);
            attempts++;
            if (attempts % 6 === 0) {
                console.log(`[VAP Agent] Still waiting... (${Math.round(attempts * 10 / 60)}min elapsed, status: ${status.status})`);
            }
        }
        if (status.status === 'failed') {
            throw new Error(`Registration failed: ${status.error}`);
        }
        if (status.status !== 'registered') {
            throw new Error('Registration timed out — check status manually');
        }
        // Wait for real i-address (not 'pending-lookup')
        if (!status.iAddress || status.iAddress === 'pending-lookup') {
            console.log(`[VAP Agent] Waiting for i-address from VAP...`);
            let iAddressAttempts = 0;
            const maxIAddressAttempts = 30; // 5 more minutes
            while ((!status.iAddress || status.iAddress === 'pending-lookup') && iAddressAttempts < maxIAddressAttempts) {
                await new Promise(r => setTimeout(r, 10_000));
                status = await this.client.onboardStatus(result.onboardId);
                iAddressAttempts++;
                if (iAddressAttempts % 6 === 0) {
                    console.log(`[VAP Agent] Still waiting for i-address... (${Math.round(iAddressAttempts * 10 / 60)}min elapsed)`);
                }
            }
            if (!status.iAddress || status.iAddress === 'pending-lookup') {
                throw new Error('VAP did not return i-address — contact platform admin');
            }
        }
        this.identityName = status.identity;
        this.iAddress = status.iAddress;
        console.log(`[VAP Agent] ✅ Registered: ${this.identityName} (${this.iAddress})`);
        this.emit('registered', { identity: this.identityName, iAddress: this.iAddress });
        return { identity: this.identityName, iAddress: this.iAddress };
    }
    /**
     * Register the agent with the VAP platform (after on-chain identity exists).
     * This creates the agent profile and enables receiving jobs.
     *
     * @param agentData - Agent profile data
     * @returns Registration result
     */
    async registerWithVAP(agentData) {
        if (!this.wif || !this.keypair) {
            throw new Error('WIF key required for registration');
        }
        if (!this.identityName) {
            throw new Error('Identity name required (call register() first or set identityName)');
        }
        const iAddress = this.iAddress || this.keypair.address;
        console.log(`[VAP Agent] Registering with VAP platform...`);
        // Step 1: Login
        console.log(`[VAP Agent] Logging in...`);
        const challengeRes = await this.client.getAuthChallenge();
        const signature = (0, signer_js_1.signChallenge)(this.wif, challengeRes.challenge, iAddress, this.networkType);
        const loginRes = await fetch(`${this.vapUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challengeId: challengeRes.challengeId,
                verusId: this.identityName,
                signature,
            }),
        });
        if (!loginRes.ok) {
            const err = await loginRes.json();
            throw new Error(`Login failed: ${err.error?.message || loginRes.statusText}`);
        }
        const cookies = loginRes.headers.get('set-cookie');
        console.log(`[VAP Agent] ✅ Logged in`);
        // Step 2: Register agent with signed payload
        console.log(`[VAP Agent] Submitting registration...`);
        const { randomUUID } = await Promise.resolve().then(() => __importStar(require('crypto')));
        const { canonicalize } = await Promise.resolve().then(() => __importStar(require('json-canonicalize')));
        const payload = {
            verusId: this.identityName,
            timestamp: Math.floor(Date.now() / 1000),
            nonce: randomUUID(),
            action: 'register',
            data: agentData,
        };
        const message = canonicalize(payload);
        const regSignature = (0, signer_js_1.signChallenge)(this.wif, message, iAddress, this.networkType);
        const regRes = await fetch(`${this.vapUrl}/v1/agents/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies || '',
            },
            body: JSON.stringify({ ...payload, signature: regSignature }),
        });
        const regData = await regRes.json();
        if (regRes.status === 409) {
            console.log(`[VAP Agent] Agent already registered`);
            return { agentId: 'existing' };
        }
        if (!regRes.ok) {
            throw new Error(`Registration failed: ${regData.error?.message || regRes.statusText}`);
        }
        console.log(`[VAP Agent] ✅ Registered with VAP platform`);
        this.emit('registeredWithVAP', { agentId: regData.data?.agentId });
        return { agentId: regData.data?.agentId };
    }
    /**
     * Register a service offering.
     * Must be called after registerWithVAP().
     */
    async registerService(serviceData) {
        if (!this.identityName) {
            throw new Error('Identity name required');
        }
        console.log(`[VAP Agent] Registering service: ${serviceData.name}...`);
        // Need to be logged in - get fresh session
        const iAddress = this.iAddress || this.keypair?.address;
        if (!this.wif || !iAddress) {
            throw new Error('WIF key required');
        }
        const challengeRes = await this.client.getAuthChallenge();
        const signature = (0, signer_js_1.signChallenge)(this.wif, challengeRes.challenge, iAddress, this.networkType);
        const loginRes = await fetch(`${this.vapUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challengeId: challengeRes.challengeId,
                verusId: this.identityName,
                signature,
            }),
        });
        const cookies = loginRes.headers.get('set-cookie');
        const serviceRes = await fetch(`${this.vapUrl}/v1/me/services`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies || '',
            },
            body: JSON.stringify(serviceData),
        });
        const serviceData2 = await serviceRes.json();
        if (!serviceRes.ok) {
            throw new Error(`Service registration failed: ${serviceData2.error?.message || serviceRes.statusText}`);
        }
        console.log(`[VAP Agent] ✅ Service registered: ${serviceData.name}`);
        return { serviceId: serviceData2.data?.serviceId };
    }
    /**
     * Set the job handler (how your agent responds to jobs).
     */
    setHandler(handler) {
        this.handler = handler;
    }
    /**
     * Start listening for jobs.
     * Uses polling by default — webhook and websocket support coming.
     */
    async start() {
        if (this.running)
            return;
        this.running = true;
        const interval = this.jobConfig.pollInterval || 30_000;
        console.log(`[VAP Agent] Listening for jobs (polling every ${interval / 1000}s)...`);
        // Initial check
        await this.checkForJobs();
        // Start polling
        this.pollTimer = setInterval(() => this.checkForJobs(), interval);
        this.emit('started');
    }
    /**
     * Stop listening for jobs.
     */
    stop() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.running = false;
        this.emit('stopped');
        console.log('[VAP Agent] Stopped.');
        this.chatClient?.disconnect();
        this.chatClient = null;
    }
    /**
     * Connect to SafeChat WebSocket for real-time messaging.
     * Call after login (needs session token on client).
     */
    async connectChat() {
        if (!this.client.getSessionToken()) {
            throw new Error('Must be logged in before connecting to chat');
        }
        this.chatClient = new client_js_1.ChatClient({
            vapUrl: this.client.baseUrl,
            sessionToken: this.client.getSessionToken(),
        });
        this.chatClient.onMessage((msg) => {
            // Don't handle our own messages
            const myId = this.iAddress || this.identityName;
            if (msg.senderVerusId === myId || msg.senderVerusId === this.identityName)
                return;
            this.emit('chat:message', msg);
            if (this.chatHandler) {
                this.chatHandler(msg.jobId, msg);
            }
        });
        await this.chatClient.connect();
        console.log('[CHAT] ✅ Connected to SafeChat');
        // Join rooms for any active jobs we're the seller on
        try {
            const { jobs } = await this.client.getMyJobs({ status: 'accepted', role: 'seller' });
            const inProgress = await this.client.getMyJobs({ status: 'in_progress', role: 'seller' });
            const allJobs = [...(jobs || []), ...(inProgress.jobs || [])];
            for (const job of allJobs) {
                this.chatClient.joinJob(job.id);
            }
            if (allJobs.length > 0) {
                console.log(`[CHAT] Joined ${allJobs.length} active job room(s)`);
            }
        }
        catch (e) {
            console.error('[CHAT] Failed to join existing job rooms:', e);
        }
    }
    /**
     * Set a handler for incoming chat messages.
     * Handler receives (jobId, message) and can call sendChatMessage() to reply.
     */
    onChatMessage(handler) {
        this.chatHandler = handler;
    }
    /**
     * Send a chat message in a job room.
     */
    sendChatMessage(jobId, content) {
        if (!this.chatClient?.isConnected) {
            throw new Error('Chat not connected');
        }
        this.chatClient.sendMessage(jobId, content);
    }
    /**
     * Join a specific job's chat room.
     */
    joinJobChat(jobId) {
        this.chatClient?.joinJob(jobId);
    }
    /**
     * Check for new job requests and process them.
     */
    async checkForJobs() {
        if (!this.handler)
            return;
        try {
            const { jobs } = await this.client.getMyJobs({ status: 'requested', role: 'seller' });
            for (const job of jobs) {
                this.emit('job:requested', job);
                if (this.handler.onJobRequested) {
                    const decision = await this.handler.onJobRequested(job);
                    if (decision === 'accept') {
                        try {
                            const timestamp = Math.floor(Date.now() / 1000);
                            const acceptMessage = `VAP-ACCEPT|Job:${job.jobHash}|Buyer:${job.buyerVerusId}|Amt:${job.amount} ${job.currency}|Ts:${timestamp}|I accept this job and commit to delivering the work.`;
                            const signature = (0, signer_js_1.signChallenge)(this.wif, acceptMessage, this.iAddress, this.networkType);
                            await this.client.acceptJob(job.id, signature, timestamp);
                            this.emit('job:accepted', job);
                            // Auto-join chat room if chat is connected
                            if (this.chatClient?.isConnected) {
                                this.chatClient.joinJob(job.id);
                            }
                        }
                        catch (err) {
                            this.emit('error', new Error(`Failed to accept job ${job.id}: ${err}`));
                        }
                    }
                    else if (decision === 'reject') {
                        this.emit('job:rejected', job);
                    }
                    // 'hold' = do nothing, agent will decide later
                }
            }
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    /** Get the agent's identity name */
    get identity() {
        return this.identityName;
    }
    /** Get the agent's i-address */
    get address() {
        return this.iAddress;
    }
    /** Check if agent is currently listening for jobs */
    get isRunning() {
        return this.running;
    }
    // ------------------------------------------
    // Privacy Tier
    // ------------------------------------------
    privacyTier = 'standard';
    /**
     * Set the agent's privacy tier.
     * Stores locally and updates the platform profile.
     */
    async setPrivacyTier(tier) {
        this.privacyTier = tier;
        await this.client.updateAgentProfile({ privacyTier: tier });
        this.emit('privacy:updated', tier);
    }
    /** Get the current privacy tier */
    getPrivacyTier() {
        return this.privacyTier;
    }
    // ------------------------------------------
    // Deletion Attestation
    // ------------------------------------------
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
    async attestDeletion(jobId, containerId, options, network = 'verustest') {
        if (!this.wif) {
            throw new Error('WIF key required for signing attestations');
        }
        if (!this.identityName) {
            throw new Error('Agent must be registered before attesting deletions');
        }
        const now = new Date().toISOString();
        const payload = (0, attestation_js_1.generateAttestationPayload)({
            jobId,
            containerId,
            createdAt: options?.createdAt || now,
            destroyedAt: options?.destroyedAt || now,
            dataVolumes: options?.dataVolumes,
            deletionMethod: options?.deletionMethod,
            attestedBy: this.identityName,
        });
        const attestation = (0, attestation_js_1.signAttestation)(payload, this.wif, network);
        // Submit to platform
        await this.client.submitAttestation(attestation);
        this.emit('attestation:submitted', attestation);
        return attestation;
    }
    // ------------------------------------------
    // Pricing
    // ------------------------------------------
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
    estimatePrice(model, category, inputTokens = 2000, outputTokens = 1000) {
        return (0, calculator_js_1.recommendPrice)({
            model,
            inputTokens,
            outputTokens,
            category,
            privacyTier: this.privacyTier,
        });
    }
}
exports.VAPAgent = VAPAgent;
//# sourceMappingURL=agent.js.map