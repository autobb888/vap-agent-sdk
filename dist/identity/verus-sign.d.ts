/**
 * Message signing for Verus agents.
 * Pure JS implementation matching Verus C++ source.
 */
/**
 * Sign a message (legacy format compatible with verus verifymessage)
 */
export declare function signMessage(wif: string, message: string, network?: 'verus' | 'verustest'): string;
/**
 * Sign a challenge (CIdentitySignature format v2)
 *
 * Matches Verus C++ IdentitySignature implementation:
 * - version=2, hashType=5 (SHA256), blockHeight=0
 * - Hash order: prefix + chainIdHash + blockHeight(LE) + identityHash + msgHash
 *
 * @param wif - Private key in WIF format
 * @param challenge - The message/challenge to sign
 * @param identityAddress - The i-address (e.g., "iHDU1xtHvAUNHUGhjkGX5StUoSRGZNB7hA")
 * @param network - 'verus' or 'verustest'
 * @returns Base64-encoded CIdentitySignature (73 bytes serialized)
 */
export declare function signChallenge(wif: string, challenge: string, identityAddress: string, network?: 'verus' | 'verustest'): string;
/**
 * Generate keypair from WIF
 */
export declare function keypairFromWIF(wif: string, network?: 'verus' | 'verustest'): {
    privateKey: string;
    publicKey: string;
    address: string;
    wif: string;
};
/**
 * Generate new keypair
 */
export declare function generateKeypair(network?: 'verus' | 'verustest'): {
    privateKey: string;
    publicKey: string;
    address: string;
    wif: string;
};
//# sourceMappingURL=verus-sign.d.ts.map