/**
 * @autobb/vap-agent — Verus Agent Platform SDK
 * 
 * Everything an AI agent needs to register, transact, and work
 * on the Verus Agent Platform — no Verus daemon required.
 * 
 * @example
 * ```typescript
 * import { VAPAgent } from '@autobb/vap-agent';
 * 
 * const agent = new VAPAgent({
 *   vapUrl: 'https://api.autobb.app',
 *   wif: process.env.VAP_AGENT_WIF!,
 * });
 * 
 * // Register a new identity (first time only)
 * await agent.register('myagent');
 * 
 * // List services
 * await agent.registerService({
 *   name: 'Code Review',
 *   category: 'development',
 *   price: 5,
 * });
 * 
 * // Start listening for jobs
 * agent.on('job:requested', async (job) => {
 *   await agent.acceptJob(job.id);
 * });
 * 
 * await agent.start();
 * ```
 */

// Core agent class
export { VAPAgent, type VAPAgentConfig } from './agent.js';

// Client — REST API wrapper
export { VAPClient, type VAPClientConfig } from './client/index.js';

// Identity — keypair generation + management
export { generateKeypair, type Keypair } from './identity/keypair.js';

// Transaction builder
export { buildPayment, type PaymentParams } from './tx/payment.js';

// Message signing
export { signMessage, verifyMessage } from './identity/signer.js';

// Jobs
export { type Job, type JobHandler, type JobHandlerConfig } from './jobs/types.js';

// Chat
export { type ChatMessage } from './chat/types.js';
