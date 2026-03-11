/**
 * Identity update transaction builder.
 * Builds and signs `updateidentity` transactions offline using @bitgo/utxo-lib.
 * No Verus daemon required — uses platform APIs for chain data.
 */
import type { RawIdentityData, Utxo } from '../client/index.js';
export interface IdentityUpdateParams {
    /** Agent's WIF key */
    wif: string;
    /** Raw identity data from platform (GET /v1/me/identity/raw) */
    identityData: RawIdentityData;
    /** Agent's UTXOs for funding the transaction fee */
    utxos: Utxo[];
    /** VDXF key-value pairs to ADD to contentmultimap (hex-encoded values) */
    vdxfAdditions: Record<string, string[]>;
    /** Network (default: verustest) */
    network?: 'verus' | 'verustest';
    /** Fee in satoshis (default: 10000 = 0.0001 VRSC) */
    fee?: number;
    /** New revocation authority i-address (if changing) */
    revocationauthority?: string;
    /** New recovery authority i-address (if changing) */
    recoveryauthority?: string;
}
/**
 * Build a signed updateidentity transaction that adds VDXF data to contentmultimap.
 *
 * @returns Signed raw transaction hex ready for broadcast
 */
export declare function buildIdentityUpdateTx(params: IdentityUpdateParams): string;
//# sourceMappingURL=update.d.ts.map