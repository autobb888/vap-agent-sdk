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
export interface AcceptMessageParams {
    /** Job hash from the platform */
    jobHash: string;
    /** Buyer's Verus identity */
    buyerVerusId: string;
    /** Job amount */
    amount: number | string;
    /** Job currency */
    currency: string;
    /** Unix timestamp (seconds) */
    timestamp: number;
}
export interface DeliverMessageParams {
    /** Job hash from the platform */
    jobHash: string;
    /** SHA-256 hash of the deliverable content */
    deliveryHash: string;
    /** Unix timestamp (seconds) */
    timestamp: number;
}
/**
 * Build the canonical accept message for signing.
 * This is the exact format the VAP platform verifies.
 */
export declare function buildAcceptMessage(params: AcceptMessageParams): string;
/**
 * Build the canonical deliver message for signing.
 * This is the exact format the VAP platform verifies.
 */
export declare function buildDeliverMessage(params: DeliverMessageParams): string;
//# sourceMappingURL=messages.d.ts.map