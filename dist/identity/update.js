"use strict";
/**
 * Identity update transaction builder.
 * Builds and signs `updateidentity` transactions offline using @bitgo/utxo-lib.
 * No Verus daemon required — uses platform APIs for chain data.
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
exports.buildIdentityUpdateTx = buildIdentityUpdateTx;
// @ts-ignore - VerusCoin fork, no TS declarations
const utxolib = __importStar(require("@bitgo/utxo-lib"));
// @ts-ignore - VerusCoin fork dependency
const verus_typescript_primitives_1 = require("verus-typescript-primitives");
const DEFAULT_FEE = 10000; // 0.0001 VRSC in satoshis
const SATS_PER_COIN = 100000000;
/**
 * Select UTXOs to cover the target amount (simple greedy algorithm).
 * Prefers larger UTXOs to minimize inputs.
 */
function selectUtxos(utxos, targetSatoshis) {
    // Sort descending by value
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
 * Build a signed updateidentity transaction that adds VDXF data to contentmultimap.
 *
 * @returns Signed raw transaction hex ready for broadcast
 */
function buildIdentityUpdateTx(params) {
    const { wif, identityData, utxos, vdxfAdditions, network = 'verustest', fee = DEFAULT_FEE, } = params;
    const networkObj = network === 'verustest'
        ? utxolib.networks.verustest
        : utxolib.networks.verus;
    // Validate required data
    if (!identityData.prevOutput) {
        throw new Error('Identity prevOutput is required (previous identity transaction output)');
    }
    if (!identityData.identity) {
        throw new Error('Identity data is required');
    }
    if (utxos.length === 0) {
        throw new Error('At least one UTXO is required to fund the transaction fee');
    }
    // 1. Merge VDXF additions into current identity's contentmultimap
    const currentCmm = {};
    // Copy existing contentmultimap
    if (identityData.identity.contentmultimap) {
        for (const [key, values] of Object.entries(identityData.identity.contentmultimap)) {
            currentCmm[key] = Array.isArray(values) ? [...values] : [values];
        }
    }
    // Append new VDXF data
    for (const [key, values] of Object.entries(vdxfAdditions)) {
        if (!currentCmm[key]) {
            currentCmm[key] = [];
        }
        currentCmm[key].push(...values);
    }
    // 2. Build updated identity JSON (matching getidentity RPC output format)
    const idJson = {
        version: identityData.identity.version ?? 3,
        flags: identityData.identity.flags ?? 0,
        minimumsignatures: identityData.identity.minimumsignatures,
        primaryaddresses: identityData.identity.primaryaddresses,
        parent: identityData.identity.parent,
        name: identityData.identity.name,
        contentmap: identityData.identity.contentmap || {},
        contentmultimap: currentCmm,
        revocationauthority: identityData.identity.revocationauthority,
        recoveryauthority: identityData.identity.recoveryauthority,
        systemid: identityData.identity.parent, // systemid is typically the parent chain
        timelock: 0,
    };
    // 3. Create Identity object and get output script
    const identity = verus_typescript_primitives_1.Identity.fromJson(idJson);
    const idOutputScript = verus_typescript_primitives_1.IdentityScript.fromIdentity(identity).toBuffer();
    // 4. Select UTXOs to cover fee
    const { selected: selectedUtxos, total: totalInput } = selectUtxos(utxos, fee);
    // 5. Create key pair from WIF
    const keyPair = utxolib.ECPair.fromWIF(wif, networkObj);
    const agentAddress = keyPair.getAddress();
    const agentScript = utxolib.address.toOutputScript(agentAddress, networkObj);
    // 6. Build the transaction
    const txb = new utxolib.TransactionBuilder(networkObj);
    txb.setVersion(4);
    txb.setExpiryHeight(identityData.blockHeight + 200);
    txb.setVersionGroupId(0x892f2085); // Sapling version group ID
    // Output 0: Updated identity (value=0)
    txb.addOutput(idOutputScript, 0);
    // Inputs: UTXOs for fee funding
    for (const utxo of selectedUtxos) {
        const txidBuf = Buffer.from(utxo.txid, 'hex').reverse(); // txid is little-endian
        txb.addInput(txidBuf, utxo.vout, 0xffffffff, agentScript);
    }
    // Output 1: Change (input total minus fee)
    const change = totalInput - fee;
    if (change > 0) {
        txb.addOutput(agentScript, change);
    }
    // Input: Previous identity UTXO (spending the identity to update it)
    const prevIdTxid = Buffer.from(identityData.prevOutput.txid, 'hex').reverse();
    const prevIdScript = Buffer.from(identityData.prevOutput.scriptHex, 'hex');
    txb.addInput(prevIdTxid, identityData.prevOutput.vout, 0xffffffff, prevIdScript);
    // 7. Sign all inputs
    const identityInputIndex = selectedUtxos.length + (change > 0 ? 0 : 0); // last input
    const SIGHASH_ALL = utxolib.Transaction.SIGHASH_ALL;
    // Sign UTXO inputs
    for (let i = 0; i < selectedUtxos.length; i++) {
        txb.sign(i, keyPair, undefined, SIGHASH_ALL, selectedUtxos[i].satoshis);
    }
    // Sign identity input (value=0 for identity UTXOs)
    const identityIdx = selectedUtxos.length; // identity input is after all UTXO inputs
    txb.sign(identityIdx, keyPair, undefined, SIGHASH_ALL, Math.round(identityData.prevOutput.value * SATS_PER_COIN));
    // 8. Build and return signed transaction hex
    const signedTx = txb.build();
    return signedTx.toHex();
}
//# sourceMappingURL=update.js.map