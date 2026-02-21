/**
 * Transaction builder for VRSC payments.
 * STUB: Full implementation requires transaction building library.
 * 
 * For now, transactions should be built using verus-cli or the VAP platform's
 * transaction endpoints.
 */

import type { Utxo } from '../client/index.js';
import { keypairFromWIF } from '../identity/keypair.js';

export interface PaymentParams {
  wif: string;
  toAddress: string;
  amount: number;
  utxos: Utxo[];
  fee?: number;
  changeAddress?: string;
  network?: 'verus' | 'verustest';
}

export function selectUtxos(
  utxos: Utxo[],
  targetAmount: number,
): { selected: Utxo[]; total: number } {
  throw new Error('selectUtxos: Not implemented without @bitgo/utxo-lib');
}

export function buildPayment(params: PaymentParams): string {
  throw new Error('buildPayment: Not implemented without @bitgo/utxo-lib. Use VAP platform transaction endpoints instead.');
}

export function wifToAddress(wif: string, networkName: 'verus' | 'verustest' = 'verustest'): string {
  return keypairFromWIF(wif, networkName).address;
}

export function wifToPubkey(wif: string, networkName: 'verus' | 'verustest' = 'verustest'): string {
  return keypairFromWIF(wif, networkName).pubkey;
}
