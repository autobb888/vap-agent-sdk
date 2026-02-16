/**
 * Keypair generation for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for proper Verus address derivation.
 * Key generation uses crypto.randomBytes (Node.js CSPRNG) via ECPair.makeRandom().
 */

const utxoLib = require('@bitgo/utxo-lib');

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
export function generateKeypair(networkName: 'verus' | 'verustest' = 'verustest'): Keypair {
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
export function keypairFromWIF(wif: string, networkName: 'verus' | 'verustest' = 'verustest'): Keypair {
  const network = utxoLib.networks[networkName];
  const keyPair = utxoLib.ECPair.fromWIF(wif, network);

  return {
    wif: keyPair.toWIF(),
    pubkey: keyPair.getPublicKeyBuffer().toString('hex'),
    address: keyPair.getAddress(),
  };
}
