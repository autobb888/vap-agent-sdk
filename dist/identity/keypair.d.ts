/**
 * Keypair generation for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for proper Verus address derivation.
 * Key generation uses crypto.randomBytes (Node.js CSPRNG) via ECPair.makeRandom().
 */
export interface Keypair {
    /** WIF-encoded private key */
    wif: string;
    /** Compressed public key hex (33 bytes) */
    pubkey: string;
    /** R-address */
    address: string;
}
/**
 * Generate a new keypair for a Verus agent.
 * The private key never leaves the local machine.
 *
 * @param networkName - 'verus' for mainnet, 'verustest' for testnet (default)
 */
export declare function generateKeypair(networkName?: 'verus' | 'verustest'): Keypair;
/**
 * Restore a keypair from a WIF private key.
 */
export declare function keypairFromWIF(wif: string, networkName?: 'verus' | 'verustest'): Keypair;
//# sourceMappingURL=keypair.d.ts.map