/**
 * @autobb/vap-agent — Verus Agent Platform SDK
 *
 * Everything an AI agent needs to register, transact, and work
 * on the Verus Agent Platform — no Verus daemon required.
 */
export { VAPAgent, type VAPAgentConfig } from './agent.js';
export { VAPClient, type VAPClientConfig, VAPError } from './client/index.js';
export type { ChainInfo, Utxo, UtxoResponse, BroadcastResponse, TxStatus } from './client/index.js';
export type { OnboardResponse, OnboardStatus, Job } from './client/index.js';
export { generateKeypair, keypairFromWIF, type Keypair } from './identity/keypair.js';
export { signMessage, signChallenge } from './identity/signer.js';
export { buildPayment, selectUtxos, wifToAddress, wifToPubkey, type PaymentParams } from './tx/payment.js';
export { generateCanary, checkForCanaryLeak, protectSystemPrompt, type CanaryConfig } from './safety/canary.js';
export { POLICY_LABELS, getDefaultPolicy, type CommunicationPolicy, type AgentSafetyPolicy } from './safety/policy.js';
export { ChatClient, type ChatClientConfig, type IncomingMessage, type MessageHandler } from './chat/index.js';
export type { ChatMessage, ChatFile } from './chat/index.js';
export type { JobHandler, JobHandlerConfig, AutoAcceptRule } from './jobs/types.js';
export { PRIVACY_TIERS, type PrivacyTier, type PrivacyTierMeta } from './privacy/tiers.js';
export { generateAttestationPayload, signAttestation, verifyAttestationFormat, type DeletionAttestation, type AttestationParams, } from './privacy/attestation.js';
export { LLM_COSTS, IMAGE_COSTS, API_COSTS, SELF_HOSTED_COSTS, CATEGORY_MARKUPS, PLATFORM_FEE, type LLMCostEntry, type ImageCostEntry, type APICostEntry, type SelfHostedCostEntry, type JobCategory, type MarkupRange, } from './pricing/tables.js';
export { estimateJobCost, recommendPrice, privacyPremium, type RecommendPriceParams, type PricePoint, type PriceRecommendation, type AdditionalApiCost, } from './pricing/calculator.js';
export { finalizeOnboarding, type FinalizeMode, type FinalizeStage, type FinalizeState, type FinalizeOnboardingParams, type AgentProfileInput, type ServiceInput, } from './onboarding/finalize.js';
export { VDXF_KEYS, getCanonicalVdxfDefinitionCount, encodeVdxfValue, decodeVdxfValue, buildAgentContentMultimap, buildCanonicalAgentUpdate, verifyPublishedIdentity, buildUpdateIdentityPayload, buildUpdateIdentityCommand, type CanonicalAgentUpdateParams, type CanonicalIdentitySnapshot, } from './onboarding/vdxf.js';
//# sourceMappingURL=index.d.ts.map