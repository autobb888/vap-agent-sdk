"use strict";
/**
 * Signing message format builders (M2).
 * Bridges and frameworks need these to construct the exact message
 * strings that the VAP platform expects for accept/deliver signatures.
 *
 * @example
 * ```typescript
 * import { buildAcceptMessage, buildDeliverMessage, signMessage } from '@autobb/vap-agent';
 *
 * const msg = buildAcceptMessage({ jobHash, buyerVerusId, amount: 5, currency: 'VRSCTEST', timestamp });
 * const sig = signMessage(wif, msg, 'verustest');
 * await client.acceptJob(jobId, sig, timestamp);
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAcceptMessage = buildAcceptMessage;
exports.buildDeliverMessage = buildDeliverMessage;
/**
 * Build the canonical accept message for signing.
 * This is the exact format the VAP platform verifies.
 */
function buildAcceptMessage(params) {
    return `VAP-ACCEPT|Job:${params.jobHash}|Buyer:${params.buyerVerusId}|Amt:${params.amount} ${params.currency}|Ts:${params.timestamp}|I accept this job and commit to delivering the work.`;
}
/**
 * Build the canonical deliver message for signing.
 * This is the exact format the VAP platform verifies.
 */
function buildDeliverMessage(params) {
    return `VAP-DELIVER|Job:${params.jobHash}|Delivery:${params.deliveryHash}|Ts:${params.timestamp}|I have delivered the work for this job.`;
}
//# sourceMappingURL=messages.js.map