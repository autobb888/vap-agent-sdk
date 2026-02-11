/**
 * Keypair generation for Verus agents.
 * Generates an R-address + WIF private key without needing a daemon.
 * 
 * Uses Node.js crypto for key generation and standard Bitcoin/Verus
 * address derivation (secp256k1 + Base58Check).
 */

import { createHash, randomBytes } from 'node:crypto';

export interface Keypair {
  /** WIF-encoded private key (starts with 'U' for compressed) */
  wif: string;
  /** Public key hex (compressed, 33 bytes) */
  pubkey: string;
  /** R-address (Base58Check encoded) */
  address: string;
}

// Verus uses the same address version as Komodo (60 = 0x3C)
const ADDR_VERSION = 0x3c; // R-address prefix
const WIF_VERSION = 0xbc;  // WIF prefix for Verus/Komodo (188)

/**
 * Generate a new keypair for a Verus agent.
 * The private key never leaves the local machine.
 */
export function generateKeypair(): Keypair {
  // Generate 32 random bytes for private key
  const privateKey = randomBytes(32);

  // Derive public key using secp256k1
  // We use Node.js crypto ECDH for this
  const { createECDH } = require('node:crypto');
  const ecdh = createECDH('secp256k1');
  ecdh.setPrivateKey(privateKey);
  const publicKeyUncompressed = ecdh.getPublicKey() as Buffer;

  // Compress the public key (take x-coordinate + parity prefix)
  const pubkey = compressPublicKey(publicKeyUncompressed);

  // Derive R-address from compressed public key
  const address = pubkeyToAddress(pubkey, ADDR_VERSION);

  // Encode private key as WIF (compressed)
  const wif = privateKeyToWIF(privateKey, WIF_VERSION, true);

  return {
    wif,
    pubkey: pubkey.toString('hex'),
    address,
  };
}

/**
 * Compress a 65-byte uncompressed public key to 33 bytes.
 */
function compressPublicKey(uncompressed: Buffer): Buffer {
  if (uncompressed.length !== 65 || uncompressed[0] !== 0x04) {
    throw new Error('Expected 65-byte uncompressed public key starting with 0x04');
  }
  const x = uncompressed.subarray(1, 33);
  const y = uncompressed[64]; // last byte of y-coordinate
  const prefix = (y & 1) === 0 ? 0x02 : 0x03;
  return Buffer.concat([Buffer.from([prefix]), x]);
}

/**
 * Derive a Base58Check address from a compressed public key.
 */
function pubkeyToAddress(pubkey: Buffer, version: number): string {
  // SHA256 then RIPEMD160 (Hash160)
  const sha = createHash('sha256').update(pubkey).digest();
  const hash160 = createHash('ripemd160').update(sha).digest();

  // Prepend version byte
  const payload = Buffer.concat([Buffer.from([version]), hash160]);

  // Base58Check encode
  return base58check(payload);
}

/**
 * Encode a private key as WIF (Wallet Import Format).
 */
function privateKeyToWIF(key: Buffer, version: number, compressed: boolean): string {
  const parts = [Buffer.from([version]), key];
  if (compressed) {
    parts.push(Buffer.from([0x01])); // compression flag
  }
  const payload = Buffer.concat(parts);
  return base58check(payload);
}

/**
 * Base58Check encoding: payload → Base58(payload + checksum).
 */
function base58check(payload: Buffer): string {
  const checksum = createHash('sha256')
    .update(createHash('sha256').update(payload).digest())
    .digest()
    .subarray(0, 4);

  return base58Encode(Buffer.concat([payload, checksum]));
}

// Base58 alphabet (Bitcoin/Verus standard)
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer: Buffer): string {
  // Count leading zeros
  let zeros = 0;
  for (const byte of buffer) {
    if (byte === 0) zeros++;
    else break;
  }

  // Convert to base58
  let num = BigInt('0x' + buffer.toString('hex'));
  const chars: string[] = [];
  while (num > 0n) {
    const remainder = Number(num % 58n);
    chars.unshift(ALPHABET[remainder]);
    num = num / 58n;
  }

  // Prepend '1' for each leading zero byte
  return '1'.repeat(zeros) + chars.join('');
}
