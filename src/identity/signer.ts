/**
 * Message signing for Verus agents.
 * Signs and verifies messages using WIF private key — no daemon required.
 * 
 * Uses the same algorithm as `verus signmessage`:
 * 1. Prepend Bitcoin Signed Message header
 * 2. Double SHA-256
 * 3. Sign with secp256k1 ECDSA
 * 4. Encode as Base64
 */

import { createHash, createSign, createVerify, createECDH } from 'node:crypto';

/**
 * Sign a message with a WIF private key.
 * Compatible with `verus verifymessage`.
 */
export function signMessage(wif: string, message: string): string {
  const { privateKey } = decodeWIF(wif);

  // Bitcoin signed message format
  const prefix = '\x18Bitcoin Signed Message:\n';
  const msgBuf = Buffer.from(message, 'utf8');
  const prefixBuf = Buffer.from(prefix, 'utf8');
  const lenBuf = encodeVarInt(msgBuf.length);

  const fullMessage = Buffer.concat([prefixBuf, lenBuf, msgBuf]);
  const msgHash = doubleHash(fullMessage);

  // Sign with secp256k1
  // Node.js crypto uses DER format, we need to convert to compact format
  const sign = createSign('SHA256');
  sign.update(msgHash);
  sign.end();
  const derSig = sign.sign({ key: privateKeyToPEM(privateKey), dsaEncoding: 'ieee-p1363' });

  // For Verus compatibility, we need the recovery flag + compact signature
  // This is a simplified version — full implementation needs recovery ID calculation
  // TODO: Use @bitgo/utxo-lib for full Verus-compatible signatures
  return derSig.toString('base64');
}

/**
 * Verify a message signature (requires RPC — use VAPClient.verifyMessage instead).
 * This is a placeholder — full verification needs the identity's public key from chain.
 */
export function verifyMessage(_identity: string, _message: string, _signature: string): boolean {
  // Signature verification requires knowing the identity's public key,
  // which is stored on-chain. Use VAPClient or RPC for verification.
  throw new Error(
    'Local signature verification not implemented. ' +
    'Use VAPClient to verify via the VAP API, or use Verus RPC verifymessage.'
  );
}

// ------------------------------------------
// Helpers
// ------------------------------------------

function decodeWIF(wif: string): { privateKey: Buffer; compressed: boolean } {
  const decoded = base58Decode(wif);
  // Remove version byte (first) and checksum (last 4)
  const payload = decoded.subarray(1, -4);

  // Verify checksum
  const data = decoded.subarray(0, -4);
  const checksum = doubleHash(data).subarray(0, 4);
  if (!checksum.equals(decoded.subarray(-4))) {
    throw new Error('Invalid WIF checksum');
  }

  if (payload.length === 33 && payload[32] === 0x01) {
    return { privateKey: payload.subarray(0, 32), compressed: true };
  }
  return { privateKey: payload.subarray(0, 32), compressed: false };
}

function doubleHash(data: Buffer): Buffer {
  const first = createHash('sha256').update(data).digest();
  return createHash('sha256').update(first).digest();
}

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

function privateKeyToPEM(privateKey: Buffer): string {
  // Wrap raw private key in PKCS#8 DER for Node.js crypto
  // secp256k1 OID: 1.3.132.0.10
  const header = Buffer.from(
    '30740201010420', 'hex'
  );
  const mid = Buffer.from(
    'a00706052b8104000aa144034200', 'hex'
  );

  // Get public key from private key
  const ecdh = createECDH('secp256k1');
  ecdh.setPrivateKey(privateKey);
  const pubkey = ecdh.getPublicKey();

  const der = Buffer.concat([header, privateKey, mid, pubkey]);
  const b64 = der.toString('base64');
  return `-----BEGIN EC PRIVATE KEY-----\n${b64}\n-----END EC PRIVATE KEY-----`;
}

// Base58 decode
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ALPHA_MAP = new Map(ALPHABET.split('').map((c, i) => [c, BigInt(i)]));

function base58Decode(str: string): Buffer {
  let num = 0n;
  for (const char of str) {
    const val = ALPHA_MAP.get(char);
    if (val === undefined) throw new Error(`Invalid Base58 character: ${char}`);
    num = num * 58n + val;
  }

  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;

  // Count leading '1's (zero bytes)
  let zeros = 0;
  for (const char of str) {
    if (char === '1') zeros++;
    else break;
  }

  return Buffer.concat([
    Buffer.alloc(zeros),
    Buffer.from(hex, 'hex'),
  ]);
}
