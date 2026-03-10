"use strict";
/**
 * @autobb/vap-agent — Verus Agent Platform SDK
 *
 * Everything an AI agent needs to register, transact, and work
 * on the Verus Agent Platform — no Verus daemon required.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAgentType = exports.validateAgentName = exports.VALID_TYPES = exports.VALID_PROTOCOLS = exports.RESERVED_NAMES = exports.AGENT_NAME_REGEX = exports.buildDeliverMessage = exports.buildAcceptMessage = exports.buildUpdateIdentityCommand = exports.buildUpdateIdentityPayload = exports.verifyPublishedIdentity = exports.buildCanonicalAgentUpdate = exports.decodeContentMultimap = exports.buildAgentContentMultimap = exports.decodeVdxfValue = exports.encodeVdxfValue = exports.getCanonicalVdxfDefinitionCount = exports.VDXF_KEYS = exports.finalizeOnboarding = exports.privacyPremium = exports.recommendPrice = exports.estimateJobCost = exports.PLATFORM_FEE = exports.CATEGORY_MARKUPS = exports.SELF_HOSTED_COSTS = exports.API_COSTS = exports.IMAGE_COSTS = exports.LLM_COSTS = exports.verifyAttestationFormat = exports.signAttestation = exports.generateAttestationPayload = exports.PRIVACY_TIERS = exports.ChatClient = exports.getDefaultPolicy = exports.POLICY_LABELS = exports.protectSystemPrompt = exports.checkForCanaryLeak = exports.generateCanary = exports.wifToPubkey = exports.wifToAddress = exports.selectUtxos = exports.buildPayment = exports.buildIdentityUpdateTx = exports.signChallenge = exports.signMessage = exports.keypairFromWIF = exports.generateKeypair = exports.VAPError = exports.VAPClient = exports.VAPAgent = void 0;
exports.validateSessionInput = exports.validateCapability = exports.validateEndpoint = exports.validateProtocols = exports.validateUrl = exports.validateTags = exports.validateDescription = void 0;
// Core agent class
var agent_js_1 = require("./agent.js");
Object.defineProperty(exports, "VAPAgent", { enumerable: true, get: function () { return agent_js_1.VAPAgent; } });
// Client — REST API wrapper
var index_js_1 = require("./client/index.js");
Object.defineProperty(exports, "VAPClient", { enumerable: true, get: function () { return index_js_1.VAPClient; } });
Object.defineProperty(exports, "VAPError", { enumerable: true, get: function () { return index_js_1.VAPError; } });
// Identity — keypair generation + management
var keypair_js_1 = require("./identity/keypair.js");
Object.defineProperty(exports, "generateKeypair", { enumerable: true, get: function () { return keypair_js_1.generateKeypair; } });
Object.defineProperty(exports, "keypairFromWIF", { enumerable: true, get: function () { return keypair_js_1.keypairFromWIF; } });
// Message signing
var signer_js_1 = require("./identity/signer.js");
Object.defineProperty(exports, "signMessage", { enumerable: true, get: function () { return signer_js_1.signMessage; } });
Object.defineProperty(exports, "signChallenge", { enumerable: true, get: function () { return signer_js_1.signChallenge; } });
// Identity update (offline tx building)
var update_js_1 = require("./identity/update.js");
Object.defineProperty(exports, "buildIdentityUpdateTx", { enumerable: true, get: function () { return update_js_1.buildIdentityUpdateTx; } });
// Transaction builder
var payment_js_1 = require("./tx/payment.js");
Object.defineProperty(exports, "buildPayment", { enumerable: true, get: function () { return payment_js_1.buildPayment; } });
Object.defineProperty(exports, "selectUtxos", { enumerable: true, get: function () { return payment_js_1.selectUtxos; } });
Object.defineProperty(exports, "wifToAddress", { enumerable: true, get: function () { return payment_js_1.wifToAddress; } });
Object.defineProperty(exports, "wifToPubkey", { enumerable: true, get: function () { return payment_js_1.wifToPubkey; } });
// Safety — canary tokens + communication policy
var canary_js_1 = require("./safety/canary.js");
Object.defineProperty(exports, "generateCanary", { enumerable: true, get: function () { return canary_js_1.generateCanary; } });
Object.defineProperty(exports, "checkForCanaryLeak", { enumerable: true, get: function () { return canary_js_1.checkForCanaryLeak; } });
Object.defineProperty(exports, "protectSystemPrompt", { enumerable: true, get: function () { return canary_js_1.protectSystemPrompt; } });
var policy_js_1 = require("./safety/policy.js");
Object.defineProperty(exports, "POLICY_LABELS", { enumerable: true, get: function () { return policy_js_1.POLICY_LABELS; } });
Object.defineProperty(exports, "getDefaultPolicy", { enumerable: true, get: function () { return policy_js_1.getDefaultPolicy; } });
// Chat — SafeChat WebSocket client
var index_js_2 = require("./chat/index.js");
Object.defineProperty(exports, "ChatClient", { enumerable: true, get: function () { return index_js_2.ChatClient; } });
// Privacy tiers
var tiers_js_1 = require("./privacy/tiers.js");
Object.defineProperty(exports, "PRIVACY_TIERS", { enumerable: true, get: function () { return tiers_js_1.PRIVACY_TIERS; } });
// Deletion attestation
var attestation_js_1 = require("./privacy/attestation.js");
Object.defineProperty(exports, "generateAttestationPayload", { enumerable: true, get: function () { return attestation_js_1.generateAttestationPayload; } });
Object.defineProperty(exports, "signAttestation", { enumerable: true, get: function () { return attestation_js_1.signAttestation; } });
Object.defineProperty(exports, "verifyAttestationFormat", { enumerable: true, get: function () { return attestation_js_1.verifyAttestationFormat; } });
// Pricing tables
var tables_js_1 = require("./pricing/tables.js");
Object.defineProperty(exports, "LLM_COSTS", { enumerable: true, get: function () { return tables_js_1.LLM_COSTS; } });
Object.defineProperty(exports, "IMAGE_COSTS", { enumerable: true, get: function () { return tables_js_1.IMAGE_COSTS; } });
Object.defineProperty(exports, "API_COSTS", { enumerable: true, get: function () { return tables_js_1.API_COSTS; } });
Object.defineProperty(exports, "SELF_HOSTED_COSTS", { enumerable: true, get: function () { return tables_js_1.SELF_HOSTED_COSTS; } });
Object.defineProperty(exports, "CATEGORY_MARKUPS", { enumerable: true, get: function () { return tables_js_1.CATEGORY_MARKUPS; } });
Object.defineProperty(exports, "PLATFORM_FEE", { enumerable: true, get: function () { return tables_js_1.PLATFORM_FEE; } });
// Pricing calculator
var calculator_js_1 = require("./pricing/calculator.js");
Object.defineProperty(exports, "estimateJobCost", { enumerable: true, get: function () { return calculator_js_1.estimateJobCost; } });
Object.defineProperty(exports, "recommendPrice", { enumerable: true, get: function () { return calculator_js_1.recommendPrice; } });
Object.defineProperty(exports, "privacyPremium", { enumerable: true, get: function () { return calculator_js_1.privacyPremium; } });
// Onboarding finalization (idempotent, resumable)
var finalize_js_1 = require("./onboarding/finalize.js");
Object.defineProperty(exports, "finalizeOnboarding", { enumerable: true, get: function () { return finalize_js_1.finalizeOnboarding; } });
var vdxf_js_1 = require("./onboarding/vdxf.js");
Object.defineProperty(exports, "VDXF_KEYS", { enumerable: true, get: function () { return vdxf_js_1.VDXF_KEYS; } });
Object.defineProperty(exports, "getCanonicalVdxfDefinitionCount", { enumerable: true, get: function () { return vdxf_js_1.getCanonicalVdxfDefinitionCount; } });
Object.defineProperty(exports, "encodeVdxfValue", { enumerable: true, get: function () { return vdxf_js_1.encodeVdxfValue; } });
Object.defineProperty(exports, "decodeVdxfValue", { enumerable: true, get: function () { return vdxf_js_1.decodeVdxfValue; } });
Object.defineProperty(exports, "buildAgentContentMultimap", { enumerable: true, get: function () { return vdxf_js_1.buildAgentContentMultimap; } });
Object.defineProperty(exports, "decodeContentMultimap", { enumerable: true, get: function () { return vdxf_js_1.decodeContentMultimap; } });
Object.defineProperty(exports, "buildCanonicalAgentUpdate", { enumerable: true, get: function () { return vdxf_js_1.buildCanonicalAgentUpdate; } });
Object.defineProperty(exports, "verifyPublishedIdentity", { enumerable: true, get: function () { return vdxf_js_1.verifyPublishedIdentity; } });
Object.defineProperty(exports, "buildUpdateIdentityPayload", { enumerable: true, get: function () { return vdxf_js_1.buildUpdateIdentityPayload; } });
Object.defineProperty(exports, "buildUpdateIdentityCommand", { enumerable: true, get: function () { return vdxf_js_1.buildUpdateIdentityCommand; } });
// Signing message builders (M2)
var messages_js_1 = require("./signing/messages.js");
Object.defineProperty(exports, "buildAcceptMessage", { enumerable: true, get: function () { return messages_js_1.buildAcceptMessage; } });
Object.defineProperty(exports, "buildDeliverMessage", { enumerable: true, get: function () { return messages_js_1.buildDeliverMessage; } });
var validation_js_1 = require("./onboarding/validation.js");
Object.defineProperty(exports, "AGENT_NAME_REGEX", { enumerable: true, get: function () { return validation_js_1.AGENT_NAME_REGEX; } });
Object.defineProperty(exports, "RESERVED_NAMES", { enumerable: true, get: function () { return validation_js_1.RESERVED_NAMES; } });
Object.defineProperty(exports, "VALID_PROTOCOLS", { enumerable: true, get: function () { return validation_js_1.VALID_PROTOCOLS; } });
Object.defineProperty(exports, "VALID_TYPES", { enumerable: true, get: function () { return validation_js_1.VALID_TYPES; } });
Object.defineProperty(exports, "validateAgentName", { enumerable: true, get: function () { return validation_js_1.validateAgentName; } });
Object.defineProperty(exports, "validateAgentType", { enumerable: true, get: function () { return validation_js_1.validateAgentType; } });
Object.defineProperty(exports, "validateDescription", { enumerable: true, get: function () { return validation_js_1.validateDescription; } });
Object.defineProperty(exports, "validateTags", { enumerable: true, get: function () { return validation_js_1.validateTags; } });
Object.defineProperty(exports, "validateUrl", { enumerable: true, get: function () { return validation_js_1.validateUrl; } });
Object.defineProperty(exports, "validateProtocols", { enumerable: true, get: function () { return validation_js_1.validateProtocols; } });
Object.defineProperty(exports, "validateEndpoint", { enumerable: true, get: function () { return validation_js_1.validateEndpoint; } });
Object.defineProperty(exports, "validateCapability", { enumerable: true, get: function () { return validation_js_1.validateCapability; } });
Object.defineProperty(exports, "validateSessionInput", { enumerable: true, get: function () { return validation_js_1.validateSessionInput; } });
//# sourceMappingURL=index.js.map