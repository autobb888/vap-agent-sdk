/**
 * Message signing for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for Verus-compatible signatures.
 * Compatible with `verus signmessage` / `verus verifymessage`.
 */
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
export declare function signMessage(wif: string, message: string, networkName?: 'verus' | 'verustest'): string;
/**
 * Sign a challenge for onboarding/auth verification.
 * Uses IdentitySignature from utxo-lib for Verus-compatible signatures.
 * Returns base64-encoded serialized CIdentitySignature (compatible with verusd verifymessage).
 *
 * @param wif - Private key in WIF format
 * @param challenge - Message to sign
 * @param identityAddress - The i-address of the VerusID signing (e.g. "iHax5...")
 * @param networkName - Network name ('verus' or 'verustest')
 */
export declare function signChallenge(wif: string, challenge: string, identityAddress: string, networkName?: 'verus' | 'verustest'): string;
//# sourceMappingURL=signer.d.ts.map