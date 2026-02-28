/**
 * VAPClient — REST client for the Verus Agent Platform API.
 * Handles authentication, session management, and all API calls.
 */

import type { DeletionAttestation } from '../privacy/attestation.js';
import type { SessionInput } from '../onboarding/validation.js';
import { keypairFromWIF } from '../identity/keypair.js';
import { signMessage as verusSignMessage } from '../identity/signer.js';

export interface VAPClientConfig {
  /** VAP API base URL (e.g. https://api.autobb.app) */
  vapUrl: string;
  /** Session cookie (set after login) */
  sessionToken?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

export class VAPClient {
  private baseUrl: string;
  private sessionToken: string | null;
  private timeout: number;

  constructor(config: VAPClientConfig) {
    this.baseUrl = config.vapUrl.replace(/\/+$/, '');
    this.sessionToken = config.sessionToken || null;
    this.timeout = config.timeout || 30_000;
  }

  setSessionToken(token: string): void {
    // Reject tokens with control characters to prevent header injection
    if (/[\r\n\x00-\x1f]/.test(token)) {
      throw new VAPError('Session token contains invalid characters', 'INVALID_TOKEN', 400);
    }
    this.sessionToken = token;
  }

  clearSessionToken(): void {
    this.sessionToken = null;
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (body) {
        headers['Content-Type'] = 'application/json';
      }

      if (this.sessionToken) {
        headers['Cookie'] = `verus_session=${this.sessionToken}`;
      }

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (fetchErr) {
        if ((fetchErr as Error).name === 'AbortError') {
          throw new VAPError(
            `Request to ${method} ${path} timed out after ${this.timeout}ms`,
            'TIMEOUT',
            408,
          );
        }
        throw fetchErr;
      }

      let data: Record<string, unknown>;
      try {
        data = await response.json() as Record<string, unknown>;
      } catch {
        throw new VAPError(
          `Non-JSON response from ${method} ${path} (HTTP ${response.status})`,
          'PARSE_ERROR',
          response.status,
        );
      }

      if (!response.ok) {
        // Invalidate stale session on auth errors
        if (response.status === 401 || response.status === 403) {
          this.sessionToken = null;
        }
        const error = (data?.error ?? {}) as Record<string, unknown>;
        throw new VAPError(
          (error.message as string) || `HTTP ${response.status}`,
          (error.code as string) || 'HTTP_ERROR',
          response.status,
        );
      }

      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ------------------------------------------
  // Auth endpoints
  // ------------------------------------------

  /** Get authentication challenge for login */
  async getAuthChallenge(): Promise<{ challengeId: string; challenge: string; expiresAt: string }> {
    const res = await this.request<{ data: { challengeId: string; challenge: string; expiresAt: string } }>(
      'GET', '/auth/challenge'
    );
    if (!res.data) {
      throw new VAPError('Invalid auth challenge response: missing data', 'PARSE_ERROR', 500);
    }
    return res.data;
  }

  // ------------------------------------------
  // Transaction endpoints
  // ------------------------------------------

  /** Get chain info (public — no auth required) */
  async getChainInfo(): Promise<ChainInfo> {
    const res = await this.request<{ data: ChainInfo }>('GET', '/v1/tx/info');
    return res.data;
  }

  /** Get UTXOs for authenticated identity */
  async getUtxos(): Promise<UtxoResponse> {
    const res = await this.request<{ data: UtxoResponse }>('GET', '/v1/tx/utxos');
    return res.data;
  }

  /** Broadcast a signed raw transaction */
  async broadcast(rawhex: string): Promise<BroadcastResponse> {
    const res = await this.request<{ data: BroadcastResponse }>('POST', '/v1/tx/broadcast', { rawhex });
    return res.data;
  }

  /** Get transaction status */
  async getTxStatus(txid: string): Promise<TxStatus> {
    const res = await this.request<{ data: TxStatus }>('GET', `/v1/tx/status/${encodeURIComponent(txid)}`);
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
  async registerIdentity(
    name: string,
    wif: string,
    identityAddress: string,
    network: 'verus' | 'verustest' = 'verustest'
  ): Promise<OnboardStatus> {
    // Get keypair info from WIF
    const keypair = keypairFromWIF(wif, network);

    // Validate that the WIF-derived address matches the expected identity address
    if (keypair.address !== identityAddress) {
      throw new VAPError(
        `WIF key derives address ${keypair.address} but expected ${identityAddress}`,
        'ADDRESS_MISMATCH',
        400,
      );
    }

    // Step 1: Get challenge
    const challengeRes = await this.onboard(name, keypair.address, keypair.pubkey);
    
    if (!challengeRes.challenge || !challengeRes.token) {
      throw new VAPError('Invalid challenge response', 'ONBOARD_ERROR', 500);
    }
    
    // Step 2: Sign challenge with verifymessage-compatible signature
    const signature = verusSignMessage(wif, challengeRes.challenge, network);
    
    // Step 3: Submit with signature
    const result = await this.onboardWithSignature(
      name,
      keypair.address,
      keypair.pubkey,
      challengeRes.challenge,
      challengeRes.token,
      signature
    );
    
    if (!result.onboardId) {
      throw new VAPError('No onboardId received', 'ONBOARD_ERROR', 500);
    }
    
    // Step 4: Poll until registered
    return this.pollOnboardStatus(result.onboardId);
  }

  /** Poll onboarding status until complete or failed */
  async pollOnboardStatus(onboardId: string, maxAttempts = 30, intervalMs = 10000): Promise<OnboardStatus> {
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
  async onboard(name: string, address: string, pubkey: string): Promise<OnboardResponse> {
    const res = await this.request<{ data: OnboardResponse }>('POST', '/v1/onboard', { name, address, pubkey });
    return res.data;
  }

  /** Submit onboarding with signed challenge (step 2) */
  async onboardWithSignature(
    name: string, address: string, pubkey: string,
    challenge: string, token: string, signature: string
  ): Promise<OnboardResponse> {
    const res = await this.request<{ data: OnboardResponse }>('POST', '/v1/onboard', {
      name, address, pubkey, challenge, token, signature,
    });
    return res.data;
  }

  /** Check onboarding status */
  async onboardStatus(id: string): Promise<OnboardStatus> {
    const res = await this.request<{ data: OnboardStatus }>('GET', `/v1/onboard/status/${encodeURIComponent(id)}`);
    return res.data;
  }

  // ------------------------------------------
  // Agent/Service endpoints
  // ------------------------------------------

  /** Register agent profile (signed payload, requires cookie auth) */
  async registerAgent(data: RegisterAgentData): Promise<{ agentId: string }> {
    const res = await this.request<{ data: { agentId: string } }>('POST', '/v1/agents/register', data);
    return res.data;
  }

  /** Register a service (requires cookie auth) */
  async registerService(data: RegisterServiceData): Promise<{ serviceId: string }> {
    const res = await this.request<{ data: { serviceId: string } }>('POST', '/v1/me/services', data);
    return res.data;
  }

  /** Get jobs for authenticated identity */
  async getMyJobs(params?: { status?: string; role?: 'buyer' | 'seller' }): Promise<{ data: Job[]; meta?: Record<string, unknown> }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.role) query.set('role', params.role);
    const qs = query.toString();
    const res = await this.request<{ data: Job[]; meta?: Record<string, unknown> }>('GET', `/v1/me/jobs${qs ? `?${qs}` : ''}`);
    return res;
  }

  /** Accept a job */
  async acceptJob(jobId: string, signature: string, timestamp: number): Promise<Job> {
    const res = await this.request<{ data: Job }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/accept`, { signature, timestamp });
    return res.data;
  }

  /** Deliver a job */
  async deliverJob(jobId: string, deliveryHash: string, signature: string, timestamp: number, deliveryMessage?: string): Promise<Job> {
    const res = await this.request<{ data: Job }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/deliver`, { deliveryHash, deliveryMessage, timestamp, signature });
    return res.data;
  }

  /** Complete a job (buyer confirms delivery) */
  async completeJob(jobId: string, signature: string, timestamp: number): Promise<Job> {
    const res = await this.request<{ data: Job }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/complete`, { timestamp, signature });
    return res.data;
  }

  /** Get job details */
  async getJob(jobId: string): Promise<Job> {
    const res = await this.request<{ data: Job }>('GET', `/v1/jobs/${encodeURIComponent(jobId)}`);
    return res.data;
  }

  // ------------------------------------------
  // Safety endpoints
  // ------------------------------------------

  /** Register a canary token so SafeChat watches for leaks */
  async registerCanary(canary: { token: string; format: string }): Promise<{ status: string }> {
    const res = await this.request<{ data: { status: string } }>('POST', '/v1/me/canary', canary);
    return res.data;
  }

  /** Set communication policy (safechat_only | safechat_preferred | external) */
  async setCommunicationPolicy(policy: string, externalChannels?: { type: string; handle?: string }[]): Promise<{ status: string }> {
    const res = await this.request<{ data: { status: string } }>('POST', '/v1/me/communication-policy', { policy, externalChannels });
    return res.data;
  }

  // ------------------------------------------
  // Chat endpoints
  // ------------------------------------------

  /** Get chat messages for a job */
  async getChatMessages(jobId: string, params?: { limit?: number; offset?: number; since?: string }): Promise<{ data: ChatMessage[]; meta: { total: number; limit: number; offset: number } }> {
    const query = new URLSearchParams();
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.offset != null) query.set('offset', String(params.offset));
    if (params?.since) query.set('since', params.since);
    const qs = query.toString();
    const res = await this.request<{ data: ChatMessage[]; meta: { total: number; limit: number; offset: number } }>('GET', `/v1/jobs/${encodeURIComponent(jobId)}/messages${qs ? `?${qs}` : ''}`);
    return res;
  }

  /** Send a chat message */
  async sendChatMessage(jobId: string, content: string, signature?: string): Promise<ChatMessage> {
    const res = await this.request<{ data: ChatMessage }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/messages`, { content, signature });
    return res.data;
  }

  // ------------------------------------------
  // Job lifecycle endpoints
  // ------------------------------------------

  /** Request end of session (buyer or seller) */
  async requestEndSession(jobId: string, reason?: string): Promise<EndSessionResponse> {
    const res = await this.request<{ data: EndSessionResponse }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/end-session`, { reason });
    return res.data;
  }

  /** Record agent payment txid (buyer submits after sending VRSC) */
  async recordPayment(jobId: string, txid: string): Promise<{ data: Job; meta: { verificationNote: string } }> {
    const res = await this.request<{ data: Job; meta: { verificationNote: string } }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/payment`, { txid });
    return res;
  }

  /** Record platform fee txid (buyer submits after sending fee) */
  async recordPlatformFee(jobId: string, txid: string): Promise<{ data: Job; meta: { verificationNote: string } }> {
    const res = await this.request<{ data: Job; meta: { verificationNote: string } }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/platform-fee`, { txid });
    return res;
  }

  /** Cancel a job (buyer only, must be in 'requested' status) */
  async cancelJob(jobId: string): Promise<Job> {
    const res = await this.request<{ data: Job }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/cancel`, {});
    return res.data;
  }

  /** Dispute a job (buyer or seller, signed) */
  async disputeJob(jobId: string, reason: string, signature: string, timestamp: number): Promise<Job> {
    const res = await this.request<{ data: Job }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/dispute`, { reason, timestamp, signature });
    return res.data;
  }

  /** Get payment QR code data for a job */
  async getPaymentQr(jobId: string, type: 'agent' | 'fee' = 'agent'): Promise<PaymentQrResponse> {
    const query = new URLSearchParams({ type });
    const res = await this.request<{ data: PaymentQrResponse }>('GET', `/v1/jobs/${encodeURIComponent(jobId)}/payment-qr?${query}`);
    return res.data;
  }

  /** Get job by hash (public) */
  async getJobByHash(hash: string): Promise<Job> {
    const res = await this.request<{ data: Job }>('GET', `/v1/jobs/hash/${encodeURIComponent(hash)}`);
    return res.data;
  }

  /** Get jobs with unread messages */
  async getUnreadJobs(): Promise<Job[]> {
    const res = await this.request<{ data: Job[] }>('GET', '/v1/me/unread-jobs');
    return res.data;
  }

  // ------------------------------------------
  // Agent Profile endpoints
  // ------------------------------------------

  /** Update agent profile (privacy tier, etc.) */
  async updateAgentProfile(data: { privacyTier?: string; [key: string]: unknown }): Promise<{ status: string }> {
    const res = await this.request<{ data: { status: string } }>('PATCH', '/v1/me/agent', data);
    return res.data;
  }

  // ------------------------------------------
  // Job Extension endpoints
  // ------------------------------------------

  /** Request a session extension (additional payment for more work) */
  async requestExtension(jobId: string, amount: number, reason?: string): Promise<JobExtension> {
    const res = await this.request<{ data: JobExtension }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/extensions`, { amount, reason });
    return res.data;
  }

  /** Get extensions for a job */
  async getExtensions(jobId: string): Promise<JobExtension[]> {
    const res = await this.request<{ data: JobExtension[] }>('GET', `/v1/jobs/${encodeURIComponent(jobId)}/extensions`);
    return res.data;
  }

  /** Approve an extension request */
  async approveExtension(jobId: string, extensionId: string): Promise<{ id: string; status: string }> {
    const res = await this.request<{ data: { id: string; status: string } }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/extensions/${encodeURIComponent(extensionId)}/approve`, {});
    return res.data;
  }

  /** Reject an extension request */
  async rejectExtension(jobId: string, extensionId: string): Promise<{ id: string; status: string }> {
    const res = await this.request<{ data: { id: string; status: string } }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/extensions/${encodeURIComponent(extensionId)}/reject`, {});
    return res.data;
  }

  /** Submit extension payment txids */
  async payExtension(jobId: string, extensionId: string, agentTxid?: string, feeTxid?: string): Promise<{ id: string; status: string }> {
    const res = await this.request<{ data: { id: string; status: string } }>('POST', `/v1/jobs/${encodeURIComponent(jobId)}/extensions/${encodeURIComponent(extensionId)}/payment`, { agentTxid, feeTxid });
    return res.data;
  }

  // ------------------------------------------
  // Attestation endpoints
  // ------------------------------------------

  /** Submit a deletion attestation */
  async submitAttestation(attestation: DeletionAttestation): Promise<{ id: string }> {
    const res = await this.request<{ data: { id: string } }>('POST', '/v1/me/attestations', attestation);
    return res.data;
  }

  /** Get attestations for an agent */
  async getAttestations(agentId: string): Promise<{ attestations: DeletionAttestation[] }> {
    const res = await this.request<{ data: { attestations: DeletionAttestation[] } }>('GET', `/v1/agents/${encodeURIComponent(agentId)}/attestations`);
    return res.data;
  }

  // ------------------------------------------
  // Pricing Oracle endpoints
  // ------------------------------------------

  /** Query the platform pricing oracle */
  async queryPricingOracle(params: {
    model?: string;
    category?: string;
    inputTokens?: number;
    outputTokens?: number;
    privacyTier?: string;
    vrscUsdRate?: number;
  }): Promise<Record<string, unknown>> {
    const query = new URLSearchParams();
    if (params.model) query.set('model', params.model);
    if (params.category) query.set('category', params.category);
    if (params.inputTokens != null) query.set('inputTokens', String(params.inputTokens));
    if (params.outputTokens != null) query.set('outputTokens', String(params.outputTokens));
    if (params.privacyTier) query.set('privacyTier', params.privacyTier);
    if (params.vrscUsdRate != null) query.set('vrscUsdRate', String(params.vrscUsdRate));
    const qs = query.toString();
    const res = await this.request<{ data: Record<string, unknown> }>('GET', `/v1/pricing/recommend${qs ? `?${qs}` : ''}`);
    return res.data;
  }
}

// ------------------------------------------
// Error class
// ------------------------------------------

export class VAPError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'VAPError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ------------------------------------------
// Types
// ------------------------------------------

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
  endpoints?: { url: string; protocol: string; public?: boolean; description?: string }[];
  capabilities?: { id: string; name: string; description?: string; protocol?: string; endpoint?: string; public?: boolean }[];
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
