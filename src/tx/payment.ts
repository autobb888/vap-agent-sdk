/**
 * Transaction builder for simple VRSC payments.
 * Constructs and signs transactions locally — no daemon required.
 * 
 * NOTE: For MVP, this wraps the raw transaction construction.
 * Future versions will use @bitgo/utxo-lib (VerusCoin fork) for
 * full support including currency conversions and identity updates.
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
  /** Change address (defaults to sender's address) */
  changeAddress?: string;
}

/**
 * Select UTXOs using a simple largest-first algorithm.
 * Returns selected UTXOs and total value.
 */
export function selectUtxos(
  utxos: Utxo[],
  targetAmount: number,
): { selected: Utxo[]; total: number } {
  // Sort by value descending (largest first)
  const sorted = [...utxos].sort((a, b) => b.satoshis - a.satoshis);

  const selected: Utxo[] = [];
  let total = 0;

  for (const utxo of sorted) {
    selected.push(utxo);
    total += utxo.satoshis;
    if (total >= targetAmount) break;
  }

  if (total < targetAmount) {
    throw new Error(
      `Insufficient funds: need ${targetAmount} satoshis, have ${total}`
    );
  }

  return { selected, total };
}

/**
 * Build a signed payment transaction.
 * 
 * TODO: Full implementation with @bitgo/utxo-lib.
 * This is a placeholder that documents the interface —
 * actual TX construction requires the VerusCoin fork of utxo-lib.
 */
export async function buildPayment(_params: PaymentParams): Promise<string> {
  // Phase C implementation will use @bitgo/utxo-lib:
  //
  // const network = verusNetwork; // from @bitgo/utxo-lib networks
  // const keyPair = ECPair.fromWIF(params.wif, network);
  // const txb = new TransactionBuilder(network);
  //
  // const { selected, total } = selectUtxos(params.utxos, params.amount + fee);
  //
  // for (const utxo of selected) {
  //   txb.addInput(utxo.txid, utxo.vout);
  // }
  //
  // txb.addOutput(params.toAddress, params.amount);
  //
  // const change = total - params.amount - fee;
  // if (change > 546) { // dust threshold
  //   txb.addOutput(params.changeAddress || keyPair.getAddress(), change);
  // }
  //
  // selected.forEach((_, i) => txb.sign(i, keyPair));
  //
  // return txb.build().toHex();

  throw new Error(
    'Transaction building requires @bitgo/utxo-lib (VerusCoin fork). ' +
    'This will be implemented in Phase C of the SDK development.'
  );
}
