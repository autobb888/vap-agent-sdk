"use strict";
/**
 * Keypair generation for Verus agents.
 * Uses minimal extracted utilities to avoid @bitgo/utxo-lib dependency issues.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKeypair = generateKeypair;
exports.keypairFromWIF = keypairFromWIF;
const verus_sign_js_1 = require("./verus-sign.js");
/**
 * Generate a new keypair for a Verus agent.
 * The private key never leaves the local machine.
 *
 * @param networkName - 'verus' for mainnet, 'verustest' for testnet (default)
 */
function generateKeypair(networkName = 'verustest') {
    const kp = (0, verus_sign_js_1.generateKeypair)(networkName);
    return {
        wif: kp.wif,
        pubkey: kp.publicKey,
        address: kp.address,
    };
}
/**
 * Restore a keypair from a WIF private key.
 */
function keypairFromWIF(wif, networkName = 'verustest') {
    const kp = (0, verus_sign_js_1.keypairFromWIF)(wif, networkName);
    return {
        wif: kp.wif,
        pubkey: kp.publicKey,
        address: kp.address,
    };
}
//# sourceMappingURL=keypair.js.map