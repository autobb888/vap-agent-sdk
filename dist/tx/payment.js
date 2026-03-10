"use strict";
/**
 * Transaction builder for VRSC payments.
 * Builds and signs standard payment transactions offline using @bitgo/utxo-lib.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectUtxos = selectUtxos;
exports.buildPayment = buildPayment;
exports.wifToAddress = wifToAddress;
exports.wifToPubkey = wifToPubkey;
// @ts-ignore - VerusCoin fork, no TS declarations
const utxolib = __importStar(require("@bitgo/utxo-lib"));
const keypair_js_1 = require("../identity/keypair.js");
const DEFAULT_FEE = 10000; // 0.0001 VRSC in satoshis
const SATS_PER_COIN = 100000000;
/**
 * Select UTXOs to cover the target amount (greedy algorithm).
 * Prefers larger UTXOs to minimize inputs.
 */
function selectUtxos(utxos, targetAmount) {
    const targetSatoshis = Math.ceil(targetAmount * SATS_PER_COIN);
    const sorted = [...utxos].sort((a, b) => b.satoshis - a.satoshis);
    const selected = [];
    let total = 0;
    for (const utxo of sorted) {
        selected.push(utxo);
        total += utxo.satoshis;
        if (total >= targetSatoshis)
            break;
    }
    if (total < targetSatoshis) {
        throw new Error(`Insufficient funds: need ${targetSatoshis} satoshis, have ${total}`);
    }
    return { selected, total };
}
/**
 * Build a signed payment transaction.
 *
 * @returns Signed raw transaction hex ready for broadcast
 */
function buildPayment(params) {
    const { wif, toAddress, amount, utxos, fee = DEFAULT_FEE, network = 'verustest', } = params;
    const networkObj = network === 'verustest'
        ? utxolib.networks.verustest
        : utxolib.networks.verus;
    const amountSatoshis = Math.ceil(amount * SATS_PER_COIN);
    const totalNeeded = amountSatoshis + fee;
    const { selected, total: inputTotal } = selectUtxos(utxos, totalNeeded / SATS_PER_COIN);
    const changeAddress = params.changeAddress || (0, keypair_js_1.keypairFromWIF)(wif, network).address;
    const changeSatoshis = inputTotal - amountSatoshis - fee;
    // Build transaction
    const keyPair = utxolib.ECPair.fromWIF(wif, networkObj);
    const txb = new utxolib.TransactionBuilder(networkObj);
    txb.setVersion(4);
    txb.setVersionGroupId(0x892f2085);
    // Add inputs
    for (const utxo of selected) {
        txb.addInput(utxo.txid, utxo.vout);
    }
    // Payment output
    txb.addOutput(utxolib.address.toOutputScript(toAddress, networkObj), amountSatoshis);
    // Change output (if above dust threshold)
    if (changeSatoshis > 1000) {
        txb.addOutput(utxolib.address.toOutputScript(changeAddress, networkObj), changeSatoshis);
    }
    // Sign all inputs
    for (let i = 0; i < selected.length; i++) {
        txb.sign(i, keyPair, undefined, utxolib.Transaction.SIGHASH_ALL, selected[i].satoshis);
    }
    return txb.build().toHex();
}
function wifToAddress(wif, networkName = 'verustest') {
    return (0, keypair_js_1.keypairFromWIF)(wif, networkName).address;
}
function wifToPubkey(wif, networkName = 'verustest') {
    return (0, keypair_js_1.keypairFromWIF)(wif, networkName).pubkey;
}
//# sourceMappingURL=payment.js.map