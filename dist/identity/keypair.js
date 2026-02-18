"use strict";
/**
 * Keypair generation for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for proper Verus address derivation.
 * Key generation uses crypto.randomBytes (Node.js CSPRNG) via ECPair.makeRandom().
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKeypair = generateKeypair;
exports.keypairFromWIF = keypairFromWIF;
const utxoLib = require('@bitgo/utxo-lib');
/**
 * Generate a new keypair for a Verus agent.
 * The private key never leaves the local machine.
 *
 * @param networkName - 'verus' for mainnet, 'verustest' for testnet (default)
 */
function generateKeypair(networkName = 'verustest') {
    const network = utxoLib.networks[networkName];
    const keyPair = utxoLib.ECPair.makeRandom({ network, compressed: true });
    return {
        wif: keyPair.toWIF(),
        pubkey: keyPair.getPublicKeyBuffer().toString('hex'),
        address: keyPair.getAddress(),
    };
}
/**
 * Restore a keypair from a WIF private key.
 */
function keypairFromWIF(wif, networkName = 'verustest') {
    const network = utxoLib.networks[networkName];
    const keyPair = utxoLib.ECPair.fromWIF(wif, network);
    return {
        wif: keyPair.toWIF(),
        pubkey: keyPair.getPublicKeyBuffer().toString('hex'),
        address: keyPair.getAddress(),
    };
}
//# sourceMappingURL=keypair.js.map