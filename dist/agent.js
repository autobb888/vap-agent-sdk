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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VAPAgent = void 0;
const node_events_1 = require("node:events");
const index_js_1 = require("./client/index.js");
const keypair_js_1 = require("./identity/keypair.js");
const signer_js_1 = require("./identity/signer.js");
const client_js_1 = require("./chat/client.js");
const vdxf_js_1 = require("./onboarding/vdxf.js");
const attestation_js_1 = require("./privacy/attestation.js");
const calculator_js_1 = require("./pricing/calculator.js");
const canary_js_1 = require("./safety/canary.js");
const node_crypto_1 = require("node:crypto");
const json_canonicalize_1 = require("json-canonicalize");
/** Default request timeout for raw fetch calls (ms) */
const FETCH_TIMEOUT = 30_000;
/** Minimum allowed polling interval (ms) */
const MIN_POLL_INTERVAL = 5_000;
class VAPAgent extends node_events_1.EventEmitter {
    _client;
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
    canaryConfig = null;
    polling = false;
    seenJobIds = new Set();
    loginPromise = null;
    constructor(config) {
        super();
        if (config.vapUrl.startsWith('http://')) {
            console.warn('[VAP Agent] ⚠️  WARNING: Using insecure HTTP connection. Keys and signatures will be sent in cleartext. Use HTTPS in production.');
        }
        this.vapUrl = config.vapUrl;
        this._client = new index_js_1.VAPClient({ vapUrl: config.vapUrl });
        this.wif = config.wif || null;
        this.identityName = config.identityName || null;
        this.iAddress = config.iAddress || null;
        this.handler = config.handler || null;
        this.jobConfig = config.jobConfig || { pollInterval: 30_000 };
        this.networkType = config.network || 'verustest';
        // Prevent uncaught 'error' events from crashing the process.
        // Only log if no user-provided listener is registered.
        this.on('error', (err) => {
            if (this.listenerCount('error') <= 1) {
                console.error('[VAP Agent] Unhandled error:', err instanceof Error ? err.message : err);
            }
        });
    }
    /**
     * Read-only access to the underlying VAPClient.
     * Use VAPAgent methods for operations that require canary checking or authentication.
     */
    get client() {
        return this._client;
    }
    /**
     * Generate a new keypair for this agent.
     * Call this before register() if no WIF was provided.
     */
    generateKeys(network) {
        const net = network || this.networkType;
        this.keypair = (0, keypair_js_1.generateKeypair)(net);
        this.wif = this.keypair.wif;
        return this.keypair;
    }
    /**
     * Authenticate with the VAP platform and return the session cookie.
     * Also sets the session token on the underlying VAPClient for subsequent requests.
     * Shared by registerWithVAP(), registerService(), and enableCanaryProtection().
     */
    async login() {
        // Mutex: deduplicate concurrent login calls to prevent session token races
        if (this.loginPromise)
            return this.loginPromise;
        this.loginPromise = this._loginImpl();
        try {
            return await this.loginPromise;
        }
        finally {
            this.loginPromise = null;
        }
    }
    async _loginImpl() {
        if (!this.wif)
            throw new Error('WIF key required');
        if (!this.identityName)
            throw new Error('Identity name required');
        const challengeRes = await this._client.getAuthChallenge();
        if (challengeRes.expiresAt) {
            const expiryMs = new Date(challengeRes.expiresAt).getTime();
            if (Number.isNaN(expiryMs)) {
                throw new Error('Auth challenge has unparseable expiresAt timestamp');
            }
            if (expiryMs < Date.now()) {
                throw new Error('Auth challenge already expired — clock skew or stale response');
            }
        }
        const signature = (0, signer_js_1.signMessage)(this.wif, challengeRes.challenge, this.networkType);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        let loginRes;
        try {
            loginRes = await fetch(`${this.vapUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    challengeId: challengeRes.challengeId,
                    verusId: this.identityName,
                    signature,
                }),
            });
        }
        catch (err) {
            if (err.name === 'AbortError') {
                throw new Error(`Login request timed out after ${FETCH_TIMEOUT}ms`);
            }
            throw err;
        }
        finally {
            clearTimeout(timer);
        }
        if (!loginRes.ok) {
            let errMsg = loginRes.statusText;
            try {
                const err = await loginRes.json();
                errMsg = err.error?.message || errMsg;
            }
            catch { /* non-JSON response */ }
            throw new Error(`Login failed: ${errMsg}`);
        }
        const cookies = loginRes.headers.get('set-cookie');
        if (!cookies) {
            throw new Error('Login succeeded but no session cookie was returned');
        }
        // Extract session token and set on VAPClient for subsequent API calls
        const match = cookies.match(/verus_session=([^;]+)/);
        if (!match) {
            throw new Error('Login succeeded but session cookie did not contain verus_session token');
        }
        this._client.setSessionToken(match[1]);
        // Return only the clean cookie name=value pair, not the full set-cookie with attributes
        return `verus_session=${match[1]}`;
    }
    /**
     * Authenticate with the VAP platform (public method).
     * Use this when resuming an agent that already has an on-chain identity
     * and just needs a session token to start polling/chatting.
     */
    async authenticate() {
        await this.login();
        console.log('[VAP Agent] ✅ Authenticated');
        this.emit('authenticated');
    }
    /**
     * Register a new identity on the Verus Agent Platform.
     * VAP creates a subID under agentplatform@ with your R-address.
     *
     * @param name - Desired agent name (e.g. "myagent")
     * @returns Identity info once registered
     */
    async register(name, network = 'verustest') {
        const previousNetwork = this.networkType;
        this.networkType = network;
        try {
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
            const challengeResp = await this._client.onboard(name, kp.address, kp.pubkey);
            if (challengeResp.status !== 'challenge') {
                throw new Error(`Unexpected response: ${JSON.stringify(challengeResp)}`);
            }
            // Step 2: Sign the challenge with our private key
            if (!challengeResp.challenge || !challengeResp.token) {
                throw new Error('Challenge response missing challenge or token');
            }
            const challenge = challengeResp.challenge;
            const token = challengeResp.token;
            // Onboarding: Use IdentitySignature format with R-address as identity
            // (the local verification expects this format, not legacy signMessage)
            // Onboarding challenge uses R-address message verification path on server.
            // Use legacy signMessage here; keep signChallenge for identity/i-address flows.
            const signature = (0, signer_js_1.signMessage)(this.wif, challenge, network);
            console.log(`[VAP Agent] Challenge signed. Submitting registration...`);
            // Step 3: Submit with signature
            const result = await this._client.onboardWithSignature(name, kp.address, kp.pubkey, challenge, token, signature);
            // Poll for completion (blocks can take 1-15 minutes depending on network)
            console.log(`[VAP Agent] Waiting for block confirmation (this can take several minutes)...`);
            let status = await this._client.onboardStatus(result.onboardId);
            let attempts = 0;
            const maxAttempts = 120; // ~20 minutes at 10s intervals
            while (status.status !== 'registered' && status.status !== 'failed' && attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 10_000));
                status = await this._client.onboardStatus(result.onboardId);
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
                    status = await this._client.onboardStatus(result.onboardId);
                    iAddressAttempts++;
                    if (iAddressAttempts % 6 === 0) {
                        console.log(`[VAP Agent] Still waiting for i-address... (${Math.round(iAddressAttempts * 10 / 60)}min elapsed)`);
                    }
                }
                if (!status.iAddress || status.iAddress === 'pending-lookup') {
                    throw new Error('VAP did not return i-address — contact platform admin');
                }
            }
            if (!status.identity) {
                throw new Error('Server returned registered status without identity name');
            }
            if (!status.iAddress) {
                throw new Error('Server returned registered status without i-address');
            }
            this.identityName = status.identity;
            this.iAddress = status.iAddress;
            console.log(`[VAP Agent] ✅ Registered: ${this.identityName} (${this.iAddress})`);
            this.emit('registered', { identity: this.identityName, iAddress: this.iAddress });
            return { identity: this.identityName, iAddress: this.iAddress };
        }
        catch (err) {
            // Rollback networkType on failure to prevent corrupted state
            this.networkType = previousNetwork;
            throw err;
        }
    }
    /**
     * Register the agent with the VAP platform (after on-chain identity exists).
     * This creates the agent profile and enables receiving jobs.
     *
     * @param agentData - Agent profile data
     * @returns Registration result
     */
    async registerWithVAP(agentData) {
        if (!this.wif) {
            throw new Error('WIF key required for registration');
        }
        // Ensure keypair is derived when agent is instantiated from existing WIF
        if (!this.keypair) {
            this.keypair = (0, keypair_js_1.keypairFromWIF)(this.wif, this.networkType);
        }
        if (!this.identityName) {
            throw new Error('Identity name required (call register() first or set identityName)');
        }
        console.log(`[VAP Agent] Registering with VAP platform...`);
        // Step 1: Login
        console.log(`[VAP Agent] Logging in...`);
        const cookies = await this.login();
        console.log(`[VAP Agent] ✅ Logged in`);
        // Step 2: Register agent with signed payload
        console.log(`[VAP Agent] Submitting registration...`);
        const payload = {
            verusId: this.identityName,
            timestamp: Math.floor(Date.now() / 1000),
            nonce: (0, node_crypto_1.randomUUID)(),
            action: 'register',
            data: agentData,
        };
        const message = (0, json_canonicalize_1.canonicalize)(payload);
        // /v1/agents/register contract: canonical payload + verifymessage signature
        const regSignature = (0, signer_js_1.signMessage)(this.wif, message, this.networkType);
        const regController = new AbortController();
        const regTimer = setTimeout(() => regController.abort(), FETCH_TIMEOUT);
        let regRes;
        try {
            regRes = await fetch(`${this.vapUrl}/v1/agents/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': cookies,
                },
                signal: regController.signal,
                body: JSON.stringify({ ...payload, signature: regSignature }),
            });
        }
        catch (err) {
            if (err.name === 'AbortError') {
                throw new Error(`Registration request timed out after ${FETCH_TIMEOUT}ms`);
            }
            throw err;
        }
        finally {
            clearTimeout(regTimer);
        }
        let responseData;
        try {
            responseData = await regRes.json();
        }
        catch {
            responseData = {};
        }
        const isAlreadyRegistered = regRes.status === 409;
        if (isAlreadyRegistered) {
            console.log(`[VAP Agent] Agent already registered`);
        }
        else if (!regRes.ok) {
            const errMsg = responseData.error?.message || regRes.statusText;
            throw new Error(`Registration failed: ${errMsg}`);
        }
        else if (!responseData.data) {
            throw new Error('Registration succeeded but response body was missing data');
        }
        else {
            console.log(`[VAP Agent] ✅ Registered with VAP platform`);
            this.emit('registeredWithVAP', { agentId: responseData.data?.agentId });
        }
        // Auto-register canary token (non-fatal on failure, runs even on 409 re-registration)
        if (agentData.canary !== false) {
            await this.registerCanaryToken(cookies);
        }
        // Build VDXF contentmultimap for on-chain publishing
        const profile = {
            name: agentData.name,
            type: agentData.type,
            description: agentData.description,
            category: agentData.category,
            owner: agentData.owner,
            tags: agentData.tags,
            website: agentData.website,
            avatar: agentData.avatar,
            protocols: agentData.protocols,
            endpoints: agentData.endpoints,
            capabilities: agentData.capabilities,
            session: agentData.session,
        };
        const contentmultimap = (0, vdxf_js_1.buildAgentContentMultimap)(profile);
        const identityName = this.identityName;
        const updatePayload = (0, vdxf_js_1.buildUpdateIdentityPayload)(identityName, contentmultimap);
        this.emit('vdxf:payload', { contentmultimap, updatePayload });
        const agentId = isAlreadyRegistered
            ? 'existing'
            : String(responseData.data?.agentId ?? '');
        return { agentId };
    }
    /**
     * Register a canary token with SafeChat (non-fatal on failure).
     */
    async registerCanaryToken(cookies) {
        try {
            const canary = (0, canary_js_1.generateCanary)();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
            let canaryRes;
            try {
                canaryRes = await fetch(`${this.vapUrl}/v1/me/canary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
                    signal: controller.signal,
                    body: JSON.stringify(canary.registration),
                });
            }
            finally {
                clearTimeout(timer);
            }
            if (canaryRes.ok) {
                this.canaryConfig = canary;
                this.emit('canary:registered', { active: true });
                console.log('[VAP Agent] Canary token registered with SafeChat');
            }
            else {
                console.warn('[VAP Agent] Canary registration failed (non-fatal) — outbound leak detection disabled');
            }
        }
        catch (e) {
            console.warn('[VAP Agent] Canary registration error (non-fatal):', e.message);
        }
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
        const cookies = await this.login();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        let serviceRes;
        try {
            serviceRes = await fetch(`${this.vapUrl}/v1/me/services`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': cookies,
                },
                signal: controller.signal,
                body: JSON.stringify(serviceData),
            });
        }
        catch (err) {
            if (err.name === 'AbortError') {
                throw new Error(`Service registration request timed out after ${FETCH_TIMEOUT}ms`);
            }
            throw err;
        }
        finally {
            clearTimeout(timer);
        }
        let result;
        try {
            result = await serviceRes.json();
        }
        catch {
            result = {};
        }
        if (!serviceRes.ok) {
            const errMsg = result.error?.message || serviceRes.statusText;
            throw new Error(`Service registration failed: ${errMsg}`);
        }
        console.log(`[VAP Agent] ✅ Service registered: ${serviceData.name}`);
        return { serviceId: String(result.data?.serviceId ?? '') };
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
        if (!this._client.getSessionToken()) {
            throw new Error('Agent must be authenticated before starting. Call registerWithVAP() or login first.');
        }
        // Prevent double-start race: set running before any async work
        this.running = true;
        const interval = Math.max(this.jobConfig.pollInterval || 30_000, MIN_POLL_INTERVAL);
        console.log(`[VAP Agent] Listening for jobs (polling every ${interval / 1000}s)...`);
        // Initial check (non-fatal — still start polling even if first check fails)
        try {
            await this.checkForJobs();
        }
        catch (err) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)));
        }
        this.pollTimer = setInterval(() => {
            if (!this.running)
                return;
            this.checkForJobs().catch((err) => {
                this.emit('error', err instanceof Error ? err : new Error(String(err)));
            });
        }, interval);
        // Guard against stop() being called during the initial checkForJobs() await
        if (!this.running) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
            return;
        }
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
        // Don't clear seenJobIds — persist across stop/start to avoid re-processing jobs
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
        if (!this._client.getSessionToken()) {
            throw new Error('Must be logged in before connecting to chat');
        }
        // Clean up existing chat client to prevent socket leaks
        if (this.chatClient) {
            this.chatClient.disconnect();
            this.chatClient = null;
        }
        this.chatClient = new client_js_1.ChatClient({
            vapUrl: this._client.getBaseUrl(),
            sessionToken: this._client.getSessionToken(),
        });
        this.chatClient.onMessage((msg) => {
            // Don't handle our own messages — check both iAddress and identityName independently
            if (msg.senderVerusId === this.iAddress || msg.senderVerusId === this.identityName)
                return;
            this.emit('chat:message', msg);
            if (this.chatHandler) {
                const result = this.chatHandler(msg.jobId, msg);
                if (result && typeof result.catch === 'function') {
                    result.catch((e) => {
                        this.emit('error', e instanceof Error ? e : new Error(String(e)));
                    });
                }
            }
        });
        // Wire up session/job lifecycle events
        this.chatClient.onSessionEnding(async (event) => {
            this.emit('session:ending', event);
            if (this.handler?.onSessionEnding) {
                try {
                    const job = await this._client.getJob(event.jobId);
                    await this.handler.onSessionEnding(job, event.reason, event.requestedBy);
                }
                catch (err) {
                    this.emit('error', err instanceof Error ? err : new Error(String(err)));
                }
            }
        });
        this.chatClient.onSessionExpiring((event) => {
            this.emit('session:expiring', event);
        });
        this.chatClient.onJobStatusChanged(async (event) => {
            this.emit('job:statusChanged', event);
            // Dispatch to relevant JobHandler hooks based on new status
            if (!this.handler)
                return;
            try {
                const job = await this._client.getJob(event.jobId);
                if (event.status === 'in_progress' && this.handler.onJobStarted) {
                    await this.handler.onJobStarted(job);
                }
                else if (event.status === 'completed' && this.handler.onJobCompleted) {
                    await this.handler.onJobCompleted(job);
                }
                else if (event.status === 'disputed' && this.handler.onJobDisputed) {
                    await this.handler.onJobDisputed(job, 'Dispute raised');
                }
                else if (event.status === 'cancelled' && this.handler.onJobCancelled) {
                    await this.handler.onJobCancelled(job, event.reason);
                }
            }
            catch (err) {
                this.emit('error', err instanceof Error ? err : new Error(String(err)));
            }
        });
        await this.chatClient.connect();
        console.log('[CHAT] ✅ Connected to SafeChat');
        // Join rooms for any active jobs we're the seller on
        try {
            const accepted = await this._client.getMyJobs({ status: 'accepted', role: 'seller' });
            const inProgress = await this._client.getMyJobs({ status: 'in_progress', role: 'seller' });
            const allJobs = [...(accepted.data || []), ...(inProgress.data || [])];
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
        if (this.canaryConfig && (0, canary_js_1.checkForCanaryLeak)(content, this.canaryConfig.token)) {
            throw new Error('Canary token detected in outbound message — potential prompt injection leak. Message blocked.');
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
    /** Maximum number of job IDs to track for deduplication */
    static MAX_SEEN_JOBS = 10_000;
    async checkForJobs() {
        if (!this.handler || this.polling)
            return;
        this.polling = true;
        try {
            const res = await this._client.getMyJobs({ status: 'requested', role: 'seller' });
            const jobs = res.data || [];
            for (const job of jobs) {
                // Stop processing if agent was stopped mid-poll
                if (!this.running)
                    break;
                // Skip jobs without an id (malformed response) or already processed
                if (!job.id)
                    continue;
                if (this.seenJobIds.has(job.id))
                    continue;
                try {
                    this.emit('job:requested', job);
                    if (this.handler.onJobRequested) {
                        const decision = await this.handler.onJobRequested(job);
                        if (decision === 'accept') {
                            if (!this.wif || !this.iAddress) {
                                this.emit('error', new Error(`Cannot accept job ${job.id}: WIF key and i-address required`));
                                continue;
                            }
                            try {
                                const timestamp = Math.floor(Date.now() / 1000);
                                const acceptMessage = `VAP-ACCEPT|Job:${job.jobHash}|Buyer:${job.buyerVerusId}|Amt:${job.amount} ${job.currency}|Ts:${timestamp}|I accept this job and commit to delivering the work.`;
                                const signature = (0, signer_js_1.signChallenge)(this.wif, acceptMessage, this.iAddress, this.networkType);
                                await this._client.acceptJob(job.id, signature, timestamp);
                                this.seenJobIds.add(job.id);
                                this.emit('job:accepted', job);
                                // Auto-join chat room if chat is connected
                                if (this.chatClient?.isConnected) {
                                    this.chatClient.joinJob(job.id);
                                }
                            }
                            catch (err) {
                                // Don't mark as seen on failure — allow retry on next poll
                                this.emit('error', new Error(`Failed to accept job ${job.id}: ${err instanceof Error ? err.message : String(err)}`));
                            }
                        }
                        else if (decision === 'reject') {
                            this.seenJobIds.add(job.id);
                            this.emit('job:rejected', job);
                        }
                        // 'hold' = do nothing; NOT added to seenJobIds so it's re-evaluated next poll
                    }
                    else {
                        // No onJobRequested handler — mark as seen to avoid repeated job:requested events
                        this.seenJobIds.add(job.id);
                    }
                }
                catch (jobErr) {
                    // Per-job error: don't skip remaining jobs in batch
                    this.emit('error', jobErr instanceof Error ? jobErr : new Error(String(jobErr)));
                }
            }
            // Evict oldest entries if the set grows too large
            while (this.seenJobIds.size > VAPAgent.MAX_SEEN_JOBS) {
                const first = this.seenJobIds.values().next().value;
                if (first !== undefined)
                    this.seenJobIds.delete(first);
                else
                    break;
            }
        }
        catch (error) {
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
        finally {
            this.polling = false;
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
    // Canary Protection
    // ------------------------------------------
    /**
     * Enable canary protection standalone (after initial registration, or to re-enable with a new token).
     * Generates a new canary token and registers it with SafeChat.
     * Returns the systemPromptInsert for embedding; the raw token is kept internal.
     */
    async enableCanaryProtection() {
        const cookies = await this.login();
        const canary = (0, canary_js_1.generateCanary)();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        let res;
        try {
            res = await fetch(`${this.vapUrl}/v1/me/canary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
                signal: controller.signal,
                body: JSON.stringify(canary.registration),
            });
        }
        catch (err) {
            if (err.name === 'AbortError') {
                throw new Error(`Canary registration request timed out after ${FETCH_TIMEOUT}ms`);
            }
            throw err;
        }
        finally {
            clearTimeout(timer);
        }
        let data;
        try {
            data = await res.json();
        }
        catch {
            data = {};
        }
        if (!res.ok) {
            const errMsg = data.error?.message || res.statusText;
            throw new Error(`Canary registration failed: ${errMsg}`);
        }
        this.canaryConfig = canary;
        this.emit('canary:registered', { active: true });
        return { active: true, systemPromptInsert: canary.systemPromptInsert };
    }
    /**
     * Wrap a system prompt with the agent's canary token.
     * The canary must be initialized first (via registerWithVAP() or enableCanaryProtection()).
     */
    getProtectedSystemPrompt(systemPrompt) {
        if (!this.canaryConfig) {
            throw new Error('Canary not initialized — call registerWithVAP() or enableCanaryProtection() first');
        }
        return systemPrompt + '\n' + this.canaryConfig.systemPromptInsert;
    }
    /** Whether canary protection is currently active */
    get canaryActive() {
        return this.canaryConfig !== null;
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
        await this._client.updateAgentProfile({ privacyTier: tier });
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
    async attestDeletion(jobId, containerId, options, network) {
        const net = network ?? this.networkType;
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
        const attestation = (0, attestation_js_1.signAttestation)(payload, this.wif, net);
        // Submit to platform
        await this._client.submitAttestation(attestation);
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