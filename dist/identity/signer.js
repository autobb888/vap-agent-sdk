"use strict";
/**
 * Message signing for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for Verus-compatible signatures.
 * Compatible with `verus signmessage` / `verus verifymessage`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.signMessage = signMessage;
exports.signChallenge = signChallenge;
const utxoLib = require('@bitgo/utxo-lib');
const { createHash } = require('node:crypto');
/**
 * Sign a message with a WIF private key using the LEGACY format.
 * Compatible with `verus verifymessage` RPC (NOT IdentitySignature).
 * Used for: deletion attestations, general message signing.
 * For onboarding challenges, use signChallenge() instead (IdentitySignature format).
 *
 * Uses legacy signed message format:
 * 1. Prepend network-specific message prefix (e.g. "Verus signed data:\n")
 * 2. Double SHA-256
 * 3. Sign with secp256k1 ECDSA (compact format with recovery byte)
 * 4. Encode as Base64
 */
function signMessage(wif, message, networkName = 'verustest') {
    const network = utxoLib.networks[networkName];
    const keyPair = utxoLib.ECPair.fromWIF(wif, network);
    // Use network-specific message prefix (Verus uses "Verus signed data:\n")
    const prefix = network.messagePrefix;
    const msgBuf = Buffer.from(message, 'utf8');
    const prefixBuf = Buffer.from(prefix, 'utf8');
    const lenBuf = encodeVarInt(msgBuf.length);
    const fullMessage = Buffer.concat([prefixBuf, lenBuf, msgBuf]);
    // Double SHA-256
    const msgHash = createHash('sha256')
        .update(createHash('sha256').update(fullMessage).digest())
        .digest();
    // Sign with compact recovery format
    const signature = keyPair.sign(msgHash);
    // Get recovery flag for compact signature
    const pubkey = keyPair.getPublicKeyBuffer();
    const compressed = pubkey.length === 33;
    const recoveryFlag = getRecoveryFlag(keyPair, msgHash, signature, compressed);
    // Compact signature: 1 byte recovery + 32 bytes r + 32 bytes s = 65 bytes
    const compactSig = Buffer.alloc(65);
    compactSig[0] = recoveryFlag;
    signature.r.toBuffer(32).copy(compactSig, 1);
    signature.s.toBuffer(32).copy(compactSig, 33);
    return compactSig.toString('base64');
}
/**
 * Sign a challenge for onboarding/auth verification.
 * Uses IdentitySignature from utxo-lib for Verus-compatible signatures.
 * Returns base64-encoded COMPACT signature (65 bytes) for local verification.
 *
 * NOTE: This returns the compact signature only, not the full serialized IdentitySignature.
 * The compact signature is what verifySignatureLocally expects.
 *
 * @param wif - Private key in WIF format
 * @param challenge - Message to sign
 * @param identityAddress - The i-address of the VerusID signing (e.g. "iHax5...") or R-address for onboarding
 * @param networkName - Network name ('verus' or 'verustest')
 */
function signChallenge(wif, challenge, identityAddress, networkName = 'verustest') {
    const network = utxoLib.networks[networkName];
    const keyPair = utxoLib.ECPair.fromWIF(wif, network);
    const IdentitySignature = utxoLib.IdentitySignature;
    // Chain IDs for Verus networks
    const chainIds = {
        verus: 'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV', // VRSC mainnet
        verustest: 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq', // VRSCTEST
    };
    const chainId = chainIds[networkName];
    // version=2, hashType=HASH_SHA256(5), blockHeight=0
    // chainId = systemID, identityAddress = the VerusID that is signing
    const idSig = new IdentitySignature(network, 2, 5, 0, null, chainId, identityAddress);
    idSig.signMessageOffline(challenge, keyPair);
    // Extract the compact signature from the IdentitySignature
    // The signatures array contains the compact signatures
    if (!idSig.signatures || idSig.signatures.length === 0) {
        throw new Error('No signature generated');
    }
    // Get the first signature and convert to compact format
    const sig = idSig.signatures[0];
    // Build compact signature: recovery byte + r + s
    const compactSig = Buffer.alloc(65);
    // Recovery flag: recoveryId + 27 + (compressed ? 4 : 0)
    // For compressed keys (33 bytes), add 4
    const pubkey = keyPair.getPublicKeyBuffer();
    const compressed = pubkey.length === 33;
    const recoveryId = sig.recovery || 0;
    compactSig[0] = recoveryId + 27 + (compressed ? 4 : 0);
    // Copy r and s (32 bytes each)
    sig.r.toBuffer(32).copy(compactSig, 1);
    sig.s.toBuffer(32).copy(compactSig, 33);
    return compactSig.toString('base64');
}
// ------------------------------------------
// Helpers
// ------------------------------------------
function encodeVarInt(n) {
    if (n < 0xfd)
        return Buffer.from([n]);
    if (n <= 0xffff) {
        const buf = Buffer.alloc(3);
        buf[0] = 0xfd;
        buf.writeUInt16LE(n, 1);
        return buf;
    }
    const buf = Buffer.alloc(5);
    buf[0] = 0xfe;
    buf.writeUInt32LE(n, 1);
    return buf;
}
/**
 * Calculate recovery flag for compact signature.
 * recovery + 27 + (compressed ? 4 : 0)
 */
function getRecoveryFlag(keyPair, msgHash, signature, compressed) {
    // Try recovery IDs 0-3 to find the right one
    for (let i = 0; i < 4; i++) {
        try {
            const recovered = utxoLib.ECPair.recover(msgHash, signature, i);
            if (recovered.getPublicKeyBuffer().equals(keyPair.getPublicKeyBuffer())) {
                return i + 27 + (compressed ? 4 : 0);
            }
        }
        catch {
            continue;
        }
    }
    // Fallback — compressed key, recovery 0
    return 31;
}
//# sourceMappingURL=signer.js.map