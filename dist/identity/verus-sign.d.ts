/**
 * Minimal Verus signing utilities
 * Extracted from @bitgo/utxo-lib Verus fork to avoid dependency issues
 */
/**
 * Sign a message (legacy format compatible with verus verifymessage)
 */
export declare function signMessage(wif: string, message: string, network?: 'verus' | 'verustest'): string;
/**
 * Sign a challenge (IdentitySignature format for onboarding)
 *
 * This creates a signature compatible with VAP's local verification:
 * - version=2, hashType=5 (SHA256), blockHeight=0
 * - chainId = VRSCTEST system ID
 * - identity = R-address (for onboarding)
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