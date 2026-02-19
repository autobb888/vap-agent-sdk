/**
 * Message signing for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for proper CIdentitySignature support.
 */
/**
 * Sign a message (legacy format compatible with verus verifymessage)
 */
export declare function signMessage(wif: string, message: string, network?: 'verus' | 'verustest'): string;
/**
 * Sign a challenge (CIdentitySignature format)
 *
 * Uses @bitgo/utxo-lib IdentitySignature for proper Verus compatibility.
 * The identityAddress can be:
 * - R-address (onboarding): signs with chainId as identity
 * - i-address (login/registration): signs with the i-address identity
 * - Identity name: resolves to the appropriate identity
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