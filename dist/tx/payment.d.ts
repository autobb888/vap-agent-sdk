/**
 * Transaction builder for VRSC payments.
 * STUB: Full implementation requires transaction building library.
 *
 * For now, transactions should be built using verus-cli or the VAP platform's
 * transaction endpoints.
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
export declare function selectUtxos(utxos: Utxo[], targetAmount: number): {
    selected: Utxo[];
    total: number;
};
export declare function buildPayment(params: PaymentParams): string;
export declare function wifToAddress(wif: string, networkName?: 'verus' | 'verustest'): string;
export declare function wifToPubkey(wif: string, networkName?: 'verus' | 'verustest'): string;
//# sourceMappingURL=payment.d.ts.map