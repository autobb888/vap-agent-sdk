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
export function signChallenge(
  wif: string,
  challenge: string,
  identityAddress: string,
  networkName: 'verus' | 'verustest' = 'verustest'
): string {
  const network = utxoLib.networks[networkName];
  const keyPair = utxoLib.ECPair.fromWIF(wif, network);
  const IdentitySignature = utxoLib.IdentitySignature;

  // Chain IDs for Verus networks
  const chainIds: Record<string, string> = {
    verus: 'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV',     // VRSC mainnet
    verustest: 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq',  // VRSCTEST
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