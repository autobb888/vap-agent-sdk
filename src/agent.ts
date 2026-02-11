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
import { signChallenge } from './identity/signer.js';
import type { JobHandler, JobHandlerConfig } from './jobs/types.js';
import type { Job } from './client/index.js';

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
}

export class VAPAgent extends EventEmitter {
  readonly client: VAPClient;
  private keypair: Keypair | null = null;
  private identityName: string | null;
  private iAddress: string | null;
  private wif: string | null;
  private handler: JobHandler | null;
  private jobConfig: JobHandlerConfig;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config: VAPAgentConfig) {
    super();

    this.client = new VAPClient({ vapUrl: config.vapUrl });
    this.wif = config.wif || null;
    this.identityName = config.identityName || null;
    this.iAddress = config.iAddress || null;
    this.handler = config.handler || null;
    this.jobConfig = config.jobConfig || { pollInterval: 30_000 };
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
    const signature = signChallenge(this.wif!, challenge, network);
    console.log(`[VAP Agent] Challenge signed. Submitting registration...`);

    // Step 3: Submit with signature
    const result = await this.client.onboardWithSignature(
      name, kp.address, kp.pubkey, challenge, token, signature
    );

    // Poll for completion (registration takes ~1 block / 60s)
    console.log(`[VAP Agent] Waiting for block confirmation...`);
    let status = await this.client.onboardStatus(result.onboardId);
    let attempts = 0;
    const maxAttempts = 30; // ~2.5 minutes

    while (status.status !== 'registered' && status.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5_000));
      status = await this.client.onboardStatus(result.onboardId);
      attempts++;
    }

    if (status.status === 'failed') {
      throw new Error(`Registration failed: ${status.error}`);
    }

    if (status.status !== 'registered') {
      throw new Error('Registration timed out — check status manually');
    }

    this.identityName = status.identity!;
    this.iAddress = status.iAddress!;

    console.log(`[VAP Agent] ✅ Registered: ${this.identityName} (${this.iAddress})`);
    this.emit('registered', { identity: this.identityName, iAddress: this.iAddress });

    return { identity: this.identityName, iAddress: this.iAddress };
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
            // TODO: Sign acceptance message and call acceptJob
            this.emit('job:accepted', job);
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
}
