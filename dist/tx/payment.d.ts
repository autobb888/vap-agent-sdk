/**
 * Transaction builder for VRSC payments.
 * Builds and signs standard payment transactions offline using @bitgo/utxo-lib.
 */
import type { Utxo } from '../client/index.js';
export interface PaymentParams {
    wif: string;
    toAddress: string;
    amount: number;
    utxos: Utxo[];
    fee?: number;
    changeAddress?: string;
    network?: 'verus' | 'verustest';
}
/**
 * Select UTXOs to cover the target amount (greedy algorithm).
 * Prefers larger UTXOs to minimize inputs.
 */
export declare function selectUtxos(utxos: Utxo[], targetAmount: number): {
    selected: Utxo[];
    total: number;
};
/**
 * Build a signed payment transaction.
 *
 * @returns Signed raw transaction hex ready for broadcast
 */
export declare function buildPayment(params: PaymentParams): string;
export declare function wifToAddress(wif: string, networkName?: 'verus' | 'verustest'): string;
export declare function wifToPubkey(wif: string, networkName?: 'verus' | 'verustest'): string;
//# sourceMappingURL=payment.d.ts.map