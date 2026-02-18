"use strict";
/**
 * Transaction builder for VRSC payments.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for full Verus-compatible transactions.
 * Signs locally — no daemon required.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectUtxos = selectUtxos;
exports.buildPayment = buildPayment;
exports.wifToAddress = wifToAddress;
exports.wifToPubkey = wifToPubkey;
// @bitgo/utxo-lib is CommonJS — require it
const utxoLib = require('@bitgo/utxo-lib');
// Dust threshold — outputs below this are rejected by the network
const DUST_THRESHOLD = 546;
/**
 * Get the Verus network parameters.
 */
function getNetwork(name = 'verustest') {
    return utxoLib.networks[name];
}
/**
 * Select UTXOs using a simple largest-first algorithm.
 */
function selectUtxos(utxos, targetAmount) {
    const sorted = [...utxos].sort((a, b) => b.satoshis - a.satoshis);
    const selected = [];
    let total = 0;
    for (const utxo of sorted) {
        selected.push(utxo);
        total += utxo.satoshis;
        if (total >= targetAmount)
            break;
    }
    if (total < targetAmount) {
        throw new Error(`Insufficient funds: need ${targetAmount} satoshis, have ${total}`);
    }
    return { selected, total };
}
/**
 * Build and sign a VRSC payment transaction.
 * Returns the raw transaction hex ready for broadcast.
 */
function buildPayment(params) {
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
    }
    else if (change < 0) {
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
function wifToAddress(wif, networkName = 'verustest') {
    const network = getNetwork(networkName);
    const keyPair = utxoLib.ECPair.fromWIF(wif, network);
    return keyPair.getAddress();
}
/**
 * Get the compressed public key hex for a WIF private key.
 */
function wifToPubkey(wif, networkName = 'verustest') {
    const network = getNetwork(networkName);
    const keyPair = utxoLib.ECPair.fromWIF(wif, network);
    return keyPair.getPublicKeyBuffer().toString('hex');
}
//# sourceMappingURL=payment.js.map