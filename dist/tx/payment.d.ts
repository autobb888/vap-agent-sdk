/**
 * Transaction builder for VRSC payments.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for full Verus-compatible transactions.
 * Signs locally — no daemon required.
 */
import type { Utxo } from '../client/index.js';
export interface PaymentParams {
    /** WIF private key for signing */
    wif: string;
    /** Recipient R-address */
    toAddress: string;
    /** Amount in satoshis */
    amount: number;
    /** Available UTXOs (from VAPClient.getUtxos()) */
    utxos: Utxo[];
    /** Fee in satoshis (default: 10000 = 0.0001 VRSC) */
    fee?: number;
    /** Change address (defaults to sender's address derived from WIF) */
    changeAddress?: string;
    /** Network: 'verus' | 'verustest' (default: 'verustest') */
    network?: 'verus' | 'verustest';
}
/**
 * Select UTXOs using a simple largest-first algorithm.
 */
export declare function selectUtxos(utxos: Utxo[], targetAmount: number): {
    selected: Utxo[];
    total: number;
};
/**
 * Build and sign a VRSC payment transaction.
 * Returns the raw transaction hex ready for broadcast.
 */
export declare function buildPayment(params: PaymentParams): string;
/**
 * Get the R-address for a WIF private key.
 */
export declare function wifToAddress(wif: string, networkName?: 'verus' | 'verustest'): string;
/**
 * Get the compressed public key hex for a WIF private key.
 */
export declare function wifToPubkey(wif: string, networkName?: 'verus' | 'verustest'): string;
//# sourceMappingURL=payment.d.ts.map