/**
 * @autobb/vap-agent — Verus Agent Platform SDK
 * 
 * Everything an AI agent needs to register, transact, and work
 * on the Verus Agent Platform — no Verus daemon required.
 */

// Core agent class
export { VAPAgent, type VAPAgentConfig } from './agent.js';

// Client — REST API wrapper
export { VAPClient, type VAPClientConfig, VAPError } from './client/index.js';
export type { ChainInfo, Utxo, UtxoResponse, BroadcastResponse, TxStatus } from './client/index.js';
export type { OnboardResponse, OnboardStatus, Job, ChatMessage } from './client/index.js';

// Identity — keypair generation + management
export { generateKeypair, keypairFromWIF, type Keypair } from './identity/keypair.js';

// Message signing
export { signMessage, signChallenge } from './identity/signer.js';

// Transaction builder
export { buildPayment, selectUtxos, wifToAddress, wifToPubkey, type PaymentParams } from './tx/payment.js';

// Job types
export type { JobHandler, JobHandlerConfig, AutoAcceptRule } from './jobs/types.js';
