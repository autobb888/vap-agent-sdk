/**
 * Message signing for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for Verus-compatible signatures.
 * Compatible with `verus signmessage` / `verus verifymessage`.
 */

const utxoLib = require('@bitgo/utxo-lib');
const { createHash } = require('node:crypto');

/**
 * Sign a message with a WIF private key.
 * Compatible with `verus verifymessage`.
 * 
 * Uses Bitcoin Signed Message format:
 * 1. Prepend "Bitcoin Signed Message:\n" header
 * 2. Double SHA-256
 * 3. Sign with secp256k1 ECDSA (compact format with recovery byte)
 * 4. Encode as Base64
 */
export function signMessage(
  wif: string,
  message: string,
  networkName: 'verus' | 'verustest' = 'verustest'
): string {
  const network = utxoLib.networks[networkName];
  const keyPair = utxoLib.ECPair.fromWIF(wif, network);

  // Bitcoin signed message format
  const prefix = '\x18Bitcoin Signed Message:\n';
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
 * Sign a challenge for onboarding verification.
 * Returns base64-encoded signature (compatible with Verus verifymessage RPC).
 */
export function signChallenge(
  wif: string,
  challenge: string,
  networkName: 'verus' | 'verustest' = 'verustest'
): string {
  const network = utxoLib.networks[networkName];
  const keyPair = utxoLib.ECPair.fromWIF(wif, network);

  // Hash the challenge with Bitcoin signed message format
  const prefix = '\x18Bitcoin Signed Message:\n';
  const msgBuf = Buffer.from(challenge, 'utf8');
  const prefixBuf = Buffer.from(prefix, 'utf8');
  const lenBuf = encodeVarInt(msgBuf.length);

  const fullMessage = Buffer.concat([prefixBuf, lenBuf, msgBuf]);
  const msgHash = createHash('sha256')
    .update(createHash('sha256').update(fullMessage).digest())
    .digest();

  // Sign and return compact signature as base64 (Verus verifymessage format)
  const signature = keyPair.sign(msgHash);
  const pubkey = keyPair.getPublicKeyBuffer();
  const compressed = pubkey.length === 33;
  const recoveryFlag = getRecoveryFlag(keyPair, msgHash, signature, compressed);

  const compactSig = Buffer.alloc(65);
  compactSig[0] = recoveryFlag;
  signature.r.toBuffer(32).copy(compactSig, 1);
  signature.s.toBuffer(32).copy(compactSig, 33);

  return compactSig.toString('base64');
}

// ------------------------------------------
// Helpers
// ------------------------------------------

function encodeVarInt(n: number): Buffer {
  if (n < 0xfd) return Buffer.from([n]);
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
function getRecoveryFlag(keyPair: any, msgHash: Buffer, signature: any, compressed: boolean): number {
  // Try recovery IDs 0-3 to find the right one
  for (let i = 0; i < 4; i++) {
    try {
      const recovered = utxoLib.ECPair.recover(msgHash, signature, i);
      if (recovered.getPublicKeyBuffer().equals(keyPair.getPublicKeyBuffer())) {
        return i + 27 + (compressed ? 4 : 0);
      }
    } catch {
      continue;
    }
  }
  // Fallback — compressed key, recovery 0
  return 31;
}
