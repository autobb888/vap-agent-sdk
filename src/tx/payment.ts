/**
 * Transaction builder for VRSC payments.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for full Verus-compatible transactions.
 * Signs locally — no daemon required.
 */

import type { Utxo } from '../client/index.js';

// @bitgo/utxo-lib is CommonJS — require it
const utxoLib = require('@bitgo/utxo-lib');

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

// Dust threshold — outputs below this are rejected by the network
const DUST_THRESHOLD = 546;

/**
 * Get the Verus network parameters.
 */
function getNetwork(name: 'verus' | 'verustest' = 'verustest') {
  return utxoLib.networks[name];
}

/**
 * Select UTXOs using a simple largest-first algorithm.
 */
export function selectUtxos(
  utxos: Utxo[],
  targetAmount: number,
): { selected: Utxo[]; total: number } {
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
 * Build and sign a VRSC payment transaction.
 * Returns the raw transaction hex ready for broadcast.
 */
export function buildPayment(params: PaymentParams): string {
  const network = getNetwork(params.network);
  const fee = params.fee ?? 10_000; // 0.0001 VRSC default
  const keyPair = utxoLib.ECPair.fromWIF(params.wif, network);
  const senderAddress = keyPair.getAddress();

  // Select UTXOs
  const needed = params.amount + fee;
  const { selected, total } = selectUtxos(params.utxos, needed);

  // Build transaction (Verus uses Sapling version 4)
  const txb = new utxoLib.TransactionBuilder(network);
  txb.setVersion(4);
  txb.setVersionGroupId(0x892f2085);

  // Add inputs
  for (const utxo of selected) {
    txb.addInput(utxo.txid, utxo.vout);
  }

  // Add payment output
  txb.addOutput(params.toAddress, params.amount);

  // Add change output (if above dust threshold)
  const change = total - params.amount - fee;
  if (change > DUST_THRESHOLD) {
    const changeAddr = params.changeAddress || senderAddress;
    txb.addOutput(changeAddr, change);
  } else if (change < 0) {
    throw new Error(`Insufficient funds after fee: need ${needed}, have ${total}`);
  }
  // If 0 < change <= DUST_THRESHOLD, it goes to the miner as extra fee

  // Sign all inputs (Verus requires value for Overwinter+ signing)
  for (let i = 0; i < selected.length; i++) {
    txb.sign(i, keyPair, undefined, undefined, selected[i].satoshis);
  }

  // Build and return hex
  return txb.build().toHex();
}

/**
 * Get the R-address for a WIF private key.
 */
export function wifToAddress(wif: string, networkName: 'verus' | 'verustest' = 'verustest'): string {
  const network = getNetwork(networkName);
  const keyPair = utxoLib.ECPair.fromWIF(wif, network);
  return keyPair.getAddress();
}

/**
 * Get the compressed public key hex for a WIF private key.
 */
export function wifToPubkey(wif: string, networkName: 'verus' | 'verustest' = 'verustest'): string {
  const network = getNetwork(networkName);
  const keyPair = utxoLib.ECPair.fromWIF(wif, network);
  return keyPair.getPublicKeyBuffer().toString('hex');
}
