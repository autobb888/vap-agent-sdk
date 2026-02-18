"use strict";
/**
 * Transaction builder for VRSC payments.
 * STUB: Full implementation requires transaction building library.
 *
 * For now, transactions should be built using verus-cli or the VAP platform's
 * transaction endpoints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectUtxos = selectUtxos;
exports.buildPayment = buildPayment;
exports.wifToAddress = wifToAddress;
exports.wifToPubkey = wifToPubkey;
function selectUtxos(utxos, targetAmount) {
    throw new Error('selectUtxos: Not implemented without @bitgo/utxo-lib');
}
function buildPayment(params) {
    throw new Error('buildPayment: Not implemented without @bitgo/utxo-lib. Use VAP platform transaction endpoints instead.');
}
function wifToAddress(wif, networkName = 'verustest') {
    // Use the keypair module instead
    const { keypairFromWIF } = require('../identity/keypair.js');
    return keypairFromWIF(wif, networkName).address;
}
function wifToPubkey(wif, networkName = 'verustest') {
    const { keypairFromWIF } = require('../identity/keypair.js');
    return keypairFromWIF(wif, networkName).pubkey;
}
//# sourceMappingURL=payment.js.map