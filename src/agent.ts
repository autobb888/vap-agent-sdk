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
import { VAPClient, type VAPClientConfig } from './client/index.js';
import { generateKeypair, keypairFromWIF, type Keypair } from './identity/keypair.js';
import { signChallenge, signMessage } from './identity/signer.js';
import { ChatClient, type IncomingMessage, type MessageHandler } from './chat/client.js';
import type { JobHandler, JobHandlerConfig } from './jobs/types.js';
import type { Job } from './client/index.js';
import type { PrivacyTier } from './privacy/tiers.js';
import { generateAttestationPayload, signAttestation, type DeletionAttestation } from './privacy/attestation.js';
import { recommendPrice, type PriceRecommendation } from './pricing/calculator.js';
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

export class VAPAgent extends EventEmitter {
  readonly client: VAPClient;
  private keypair: Keypair | null = null;
  private identityName: string | null;
  private iAddress: string | null;
  private wif: string | null;
  private handler: JobHandler | null;
  private jobConfig: JobHandlerConfig;
  private networkType: 'verus' | 'verustest' = 'verustest';
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private chatClient: ChatClient | null = null;
  private chatHandler: ((jobId: string, message: IncomingMessage) => void | Promise<void>) | null = null;
  private vapUrl: string;

  constructor(config: VAPAgentConfig) {
    super();

    this.vapUrl = config.vapUrl;
    this.client = new VAPClient({ vapUrl: config.vapUrl });
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
  generateKeys(network: 'verus' | 'verustest' = 'verustest'): Keypair {
    this.keypair = generateKeypair(network);
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
  async register(name: string, network: 'verus' | 'verustest' = 'verustest'): Promise<{ identity: string; iAddress: string }> {
    this.networkType = network;
    if (!this.keypair && this.wif) {
      this.keypair = keypairFromWIF(this.wif, network);
    } else if (!this.keypair) {
      this.generateKeys(network);
    }

    const kp = this.keypair!;

    console.log(`[VAP Agent] Registering "${name}.agentplatform@"...`);

    // Step 1: Request challenge
    console.log(`[VAP Agent] Requesting challenge...`);
    const challengeResp = await this.client.onboard(name, kp.address, kp.pubkey);
    
    if (challengeResp.status !== 'challenge') {
      throw new Error(`Unexpected response: ${JSON.stringify(challengeResp)}`);
    }

    // Step 2: Sign the challenge with our private key
    const challenge = (challengeResp as any).challenge as string;
    const token = (challengeResp as any).token as string;
    // Onboarding: Use IdentitySignature format with R-address as identity
    // (the local verification expects this format, not legacy signMessage)
    // Onboarding challenge uses R-address message verification path on server.
    // Use legacy signMessage here; keep signChallenge for identity/i-address flows.
    const signature = signMessage(this.wif!, challenge, network);
    console.log(`[VAP Agent] Challenge signed. Submitting registration...`);

    // Step 3: Submit with signature
    const result = await this.client.onboardWithSignature(
      name, kp.address, kp.pubkey, challenge, token, signature
    );

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

    this.identityName = status.identity!;
    this.iAddress = status.iAddress!;

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
  async registerWithVAP(agentData: {
    name: string;
    type?: 'autonomous' | 'assisted' | 'hybrid' | 'tool';
    description?: string;
    category?: string;
  }): Promise<{ agentId: string }> {
    if (!this.wif) {
      throw new Error('WIF key required for registration');
    }

    // Ensure keypair is derived when agent is instantiated from existing WIF
    if (!this.keypair) {
      this.keypair = keypairFromWIF(this.wif, this.networkType);
    }

    if (!this.identityName) {
      throw new Error('Identity name required (call register() first or set identityName)');
    }

    const iAddress = this.iAddress || this.keypair.address;

    console.log(`[VAP Agent] Registering with VAP platform...`);

    // Step 1: Login
    console.log(`[VAP Agent] Logging in...`);
    const challengeRes = await this.client.getAuthChallenge();
    // /auth/login uses verifymessage-compatible signatures
    const signature = signMessage(this.wif, challengeRes.challenge, this.networkType);
    
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
    const { randomUUID } = await import('crypto');
    const { canonicalize } = await import('json-canonicalize');

    const payload = {
      verusId: this.identityName,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: randomUUID(),
      action: 'register' as const,
      data: agentData,
    };

    const message = canonicalize(payload);
    // Registration route verifies against resolved i-address.
    // Use IdentitySignature with i-address (not identity name string).
    const regSignature = signChallenge(this.wif, message, iAddress, this.networkType);

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
  async registerService(serviceData: {
    name: string;
    description?: string;
    category?: string;
    price?: number;
    currency?: string;
    turnaround?: string;
  }): Promise<{ serviceId: string }> {
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
    // /auth/login uses verifymessage-compatible signatures
    const signature = signMessage(this.wif, challengeRes.challenge, this.networkType);
    
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
  setHandler(handler: JobHandler): void {
    this.handler = handler;
  }

  /**
   * Start listening for jobs.
   * Uses polling by default — webhook and websocket support coming.
   */
  async start(): Promise<void> {
    if (this.running) return;
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
  stop(): void {
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
  async connectChat(): Promise<void> {
    if (!this.client.getSessionToken()) {
      throw new Error('Must be logged in before connecting to chat');
    }

    this.chatClient = new ChatClient({
      vapUrl: (this.client as any).baseUrl,
      sessionToken: this.client.getSessionToken()!,
    });

    this.chatClient.onMessage((msg) => {
      // Don't handle our own messages
      const myId = this.iAddress || this.identityName;
      if (msg.senderVerusId === myId || msg.senderVerusId === this.identityName) return;

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
    } catch (e) {
      console.error('[CHAT] Failed to join existing job rooms:', e);
    }
  }

  /**
   * Set a handler for incoming chat messages.
   * Handler receives (jobId, message) and can call sendChatMessage() to reply.
   */
  onChatMessage(handler: (jobId: string, message: IncomingMessage) => void | Promise<void>): void {
    this.chatHandler = handler;
  }

  /**
   * Send a chat message in a job room.
   */
  sendChatMessage(jobId: string, content: string): void {
    if (!this.chatClient?.isConnected) {
      throw new Error('Chat not connected');
    }
    this.chatClient.sendMessage(jobId, content);
  }

  /**
   * Join a specific job's chat room.
   */
  joinJobChat(jobId: string): void {
    this.chatClient?.joinJob(jobId);
  }

  /**
   * Check for new job requests and process them.
   */
  private async checkForJobs(): Promise<void> {
    if (!this.handler) return;

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
              const signature = signChallenge(this.wif!, acceptMessage, this.iAddress!, this.networkType);
              await this.client.acceptJob(job.id, signature, timestamp);
              this.emit('job:accepted', job);
              // Auto-join chat room if chat is connected
              if (this.chatClient?.isConnected) {
                this.chatClient.joinJob(job.id);
              }
            } catch (err) {
              this.emit('error', new Error(`Failed to accept job ${job.id}: ${err}`));
            }
          } else if (decision === 'reject') {
            this.emit('job:rejected', job);
          }
          // 'hold' = do nothing, agent will decide later
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /** Get the agent's identity name */
  get identity(): string | null {
    return this.identityName;
  }

  /** Get the agent's i-address */
  get address(): string | null {
    return this.iAddress;
  }

  /** Check if agent is currently listening for jobs */
  get isRunning(): boolean {
    return this.running;
  }

  // ------------------------------------------
  // Privacy Tier
  // ------------------------------------------

  private privacyTier: PrivacyTier = 'standard';

  /**
   * Set the agent's privacy tier.
   * Stores locally and updates the platform profile.
   */
  async setPrivacyTier(tier: PrivacyTier): Promise<void> {
    this.privacyTier = tier;
    await this.client.updateAgentProfile({ privacyTier: tier });
    this.emit('privacy:updated', tier);
  }

  /** Get the current privacy tier */
  getPrivacyTier(): PrivacyTier {
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
  async attestDeletion(
    jobId: string,
    containerId: string,
    options?: {
      createdAt?: string;
      destroyedAt?: string;
      dataVolumes?: string[];
      deletionMethod?: string;
    },
    network: 'verus' | 'verustest' = 'verustest',
  ): Promise<DeletionAttestation> {
    if (!this.wif) {
      throw new Error('WIF key required for signing attestations');
    }
    if (!this.identityName) {
      throw new Error('Agent must be registered before attesting deletions');
    }

    const now = new Date().toISOString();
    const payload = generateAttestationPayload({
      jobId,
      containerId,
      createdAt: options?.createdAt || now,
      destroyedAt: options?.destroyedAt || now,
      dataVolumes: options?.dataVolumes,
      deletionMethod: options?.deletionMethod,
      attestedBy: this.identityName,
    });

    const attestation = signAttestation(payload, this.wif, network);

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
  estimatePrice(
    model: string,
    category: JobCategory,
    inputTokens: number = 2000,
    outputTokens: number = 1000,
  ): PriceRecommendation {
    return recommendPrice({
      model,
      inputTokens,
      outputTokens,
      category,
      privacyTier: this.privacyTier,
    });
  }
}
