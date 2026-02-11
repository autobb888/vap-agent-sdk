/**
 * VAPClient — REST client for the Verus Agent Platform API.
 * Handles authentication, session management, and all API calls.
 */

export interface VAPClientConfig {
  /** VAP API base URL (e.g. https://api.autobb.app) */
  vapUrl: string;
  /** Session cookie (set after login) */
  sessionToken?: string;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
}

export class VAPClient {
  private baseUrl: string;
  private sessionToken: string | null;
  private timeout: number;

  constructor(config: VAPClientConfig) {
    this.baseUrl = config.vapUrl.replace(/\/+$/, '');
    this.sessionToken = config.sessionToken || null;
    this.timeout = config.timeout || 10_000;
  }

  setSessionToken(token: string): void {
    this.sessionToken = token;
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
        headers['Cookie'] = `session=${this.sessionToken}`;
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await response.json() as any;

      if (!response.ok) {
        const error = data?.error || {};
        throw new VAPError(
          error.message || `HTTP ${response.status}`,
          error.code || 'HTTP_ERROR',
          response.status,
        );
      }

      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ------------------------------------------
  // Transaction endpoints
  // ------------------------------------------

  /** Get chain info (public — no auth required) */
  async getChainInfo(): Promise<ChainInfo> {
    return this.request('GET', '/v1/tx/info');
  }

  /** Get UTXOs for authenticated identity */
  async getUtxos(): Promise<UtxoResponse> {
    return this.request('GET', '/v1/tx/utxos');
  }

  /** Broadcast a signed raw transaction */
  async broadcast(rawhex: string): Promise<BroadcastResponse> {
    return this.request('POST', '/v1/tx/broadcast', { rawhex });
  }

  /** Get transaction status */
  async getTxStatus(txid: string): Promise<TxStatus> {
    return this.request('GET', `/v1/tx/status/${txid}`);
  }

  // ------------------------------------------
  // Onboarding endpoints
  // ------------------------------------------

  /** Request onboarding challenge (step 1) */
  async onboard(name: string, address: string, pubkey: string): Promise<OnboardResponse> {
    return this.request('POST', '/v1/onboard', { name, address, pubkey });
  }

  /** Submit onboarding with signed challenge (step 2) */
  async onboardWithSignature(
    name: string, address: string, pubkey: string,
    challenge: string, token: string, signature: string
  ): Promise<OnboardResponse> {
    return this.request('POST', '/v1/onboard', {
      name, address, pubkey, challenge, token, signature,
    });
  }

  /** Check onboarding status */
  async onboardStatus(id: string): Promise<OnboardStatus> {
    return this.request('GET', `/v1/onboard/status/${id}`);
  }

  // ------------------------------------------
  // Agent/Service endpoints
  // ------------------------------------------

  /** Register agent profile */
  async registerAgent(data: RegisterAgentData): Promise<{ agentId: string }> {
    return this.request('POST', '/v1/register', data);
  }

  /** Register a service */
  async registerService(data: RegisterServiceData): Promise<{ serviceId: string }> {
    return this.request('POST', '/v1/my-services', data);
  }

  /** Get jobs for authenticated identity */
  async getMyJobs(params?: { status?: string; role?: 'buyer' | 'seller' }): Promise<{ jobs: Job[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.role) query.set('role', params.role);
    const qs = query.toString();
    return this.request('GET', `/v1/me/jobs${qs ? `?${qs}` : ''}`);
  }

  /** Accept a job */
  async acceptJob(jobId: string, signature: string, message: string): Promise<{ status: string }> {
    return this.request('POST', `/v1/jobs/${jobId}/accept`, { signature, message });
  }

  /** Deliver a job */
  async deliverJob(jobId: string, signature: string, message: string, content?: string): Promise<{ status: string }> {
    return this.request('POST', `/v1/jobs/${jobId}/deliver`, { signature, message, content });
  }

  /** Get job details */
  async getJob(jobId: string): Promise<Job> {
    return this.request('GET', `/v1/jobs/${jobId}`);
  }

  // ------------------------------------------
  // Chat endpoints
  // ------------------------------------------

  // ------------------------------------------
  // Safety endpoints
  // ------------------------------------------

  /** Register a canary token so SafeChat watches for leaks */
  async registerCanary(canary: { token: string; format: string }): Promise<{ status: string }> {
    return this.request('POST', '/v1/me/canary', canary);
  }

  // ------------------------------------------
  // Chat endpoints
  // ------------------------------------------

  /** Get chat messages for a job */
  async getChatMessages(jobId: string, limit?: number): Promise<{ messages: ChatMessage[] }> {
    const qs = limit ? `?limit=${limit}` : '';
    return this.request('GET', `/v1/chat/${jobId}/messages${qs}`);
  }

  /** Send a chat message */
  async sendChatMessage(jobId: string, content: string): Promise<{ messageId: string }> {
    return this.request('POST', `/v1/chat/${jobId}/messages`, { content });
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
  status: string;
  onboardId: string;
  identity?: string;
  iAddress?: string;
  txid?: string;
}

export interface OnboardStatus {
  status: 'pending' | 'confirming' | 'registered' | 'failed';
  identity?: string;
  iAddress?: string;
  error?: string;
}

export interface RegisterAgentData {
  name: string;
  description?: string;
  category?: string;
  paymentAddress?: string;
}

export interface RegisterServiceData {
  name: string;
  description?: string;
  category?: string;
  price?: number;
  priceCurrency?: string;
  paymentTerms?: 'prepay' | 'postpay';
}

export interface Job {
  id: string;
  status: 'requested' | 'accepted' | 'in_progress' | 'delivered' | 'completed' | 'disputed' | 'cancelled';
  buyerVerusId: string;
  sellerVerusId: string;
  serviceId?: string;
  description: string;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  jobId: string;
  senderVerusId: string;
  content: string;
  createdAt: string;
}
