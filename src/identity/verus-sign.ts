/**
 * Message signing for Verus agents.
 * Pure JS implementation matching Verus C++ source.
 */

import * as crypto from 'crypto';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { hmac } from '@noble/hashes/hmac';
import bs58check from 'bs58check';

// @ts-ignore - no types available
import * as ripemd160 from 'ripemd160';

// Configure @noble/secp256k1 sync hash functions
secp256k1.etc.hmacSha256Sync = (key: Uint8Array, ...messages: Uint8Array[]) => {
  const h = hmac.create(sha256, key);
  for (const msg of messages) h.update(msg);
  return h.digest();
};

// VRSCTEST chain ID
const VRSCTEST_CHAIN_ID = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq';

// Verus network constants
const VERUS_NETWORK = {
  messagePrefix: 'Verus signed data:\n',
  pubKeyHash: 0x3c,
  scriptHash: 0x3b,
  wif: 0xbc,
};

const VERUS_MAINNET = {
  messagePrefix: 'Verus signed data:\n',
  pubKeyHash: 0x3b,
  scriptHash: 0x3c,
  wif: 0x80,
};

/**
 * Decode WIF to private key
 */
function wifToPrivateKey(wif: string): Uint8Array {
  const decoded = bs58check.decode(wif);
  if (decoded.length === 38) {
    return new Uint8Array(decoded.slice(1, 33));
  } else if (decoded.length === 37) {
    return new Uint8Array(decoded.slice(1, 33));
  } else if (decoded.length === 34) {
    return new Uint8Array(decoded.slice(1, 33));
  }
  throw new Error(`Invalid WIF length: ${decoded.length}`);
}

/**
 * Get public key from private key
 */
function privateKeyToPublicKey(privKey: Uint8Array, compressed: boolean = true): Uint8Array {
  return secp256k1.getPublicKey(privKey, compressed);
}

/**
 * Hash160 (RIPEMD160(SHA256(data)))
 */
function hash160(data: Uint8Array): Uint8Array {
  const sha = sha256(data);
  const ripe = new ripemd160.default();
  ripe.update(Buffer.from(sha));
  return new Uint8Array(ripe.digest());
}

/**
 * Private key to R-address
 */
function privateKeyToAddress(privKey: Uint8Array, network: 'verus' | 'verustest' = 'verustest'): string {
  const pubkey = privateKeyToPublicKey(privKey, true);
  const hash = hash160(pubkey);
  const version = network === 'verustest' ? VERUS_NETWORK.pubKeyHash : VERUS_MAINNET.pubKeyHash;
  const payload = Buffer.concat([Buffer.from([version]), hash]);
  return bs58check.encode(payload);
}

/**
 * Encode varint
 */
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
 * Decode a base58check i-address to get the identity hash
 */
function iAddressToHash(iAddress: string): Uint8Array {
  const decoded = bs58check.decode(iAddress);
  // First byte is version (0x66 for i-address), remaining 20 bytes are the hash160
  return decoded.slice(1);
}

/**
 * Sign a message (legacy format compatible with verus verifymessage)
 */
export function signMessage(
  wif: string,
  message: string,
  network: 'verus' | 'verustest' = 'verustest'
): string {
  const privKey = wifToPrivateKey(wif);
  const networkConfig = network === 'verustest' ? VERUS_NETWORK : VERUS_MAINNET;

  const prefix = Buffer.from(networkConfig.messagePrefix, 'utf8');
  const msgBuf = Buffer.from(message, 'utf8');
  const lenBuf = encodeVarInt(msgBuf.length);
  const fullMessage = Buffer.concat([prefix, lenBuf, msgBuf]);

  const msgHash = crypto.createHash('sha256')
    .update(crypto.createHash('sha256').update(fullMessage).digest())
    .digest();

  const signature = secp256k1.sign(msgHash, privKey);
  const pubkey = privateKeyToPublicKey(privKey, true);
  const compressed = pubkey.length === 33;

  const compactSig = Buffer.alloc(65);
  compactSig[0] = signature.recovery! + 27 + (compressed ? 4 : 0);
  Buffer.from(signature.toCompactRawBytes()).copy(compactSig, 1);

  return compactSig.toString('base64');
}

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
export function signChallenge(
  wif: string,
  challenge: string,
  identityAddress: string,
  network: 'verus' | 'verustest' = 'verustest'
): string {
  const privKey = wifToPrivateKey(wif);
  const pubkey = privateKeyToPublicKey(privKey, true);
  const compressed = true;

  // Decode chain ID
  const chainIdDecoded = bs58check.decode(VRSCTEST_CHAIN_ID);
  const chainIdHash = chainIdDecoded.slice(1); // skip version byte

  // Get identity hash from i-address
  let identityHash: Uint8Array;
  if (identityAddress.startsWith('i')) {
    identityHash = iAddressToHash(identityAddress);
  } else {
    // Fallback: for R-addresses, use chainIdHash (onboarding case)
    identityHash = chainIdHash;
  }

  // Build the message hash according to IdentitySignature.hashMessage():
  // SHA256(prefix + chainIdHash + blockHeight(4 LE) + identityHash + SHA256(varint(msgLen) + lowercase(msg)))

  // 1. Prefix with compactSize length
  const prefixStr = 'Verus signed data:\n';
  const prefixBuf = Buffer.from(prefixStr, 'utf8');
  const prefix = Buffer.concat([Buffer.from([prefixBuf.length]), prefixBuf]);

  // 2. chainId hash (20 bytes)
  // Already have chainIdHash

  // 3. blockHeight = 0 (4 bytes LE)
  const heightBuf = Buffer.alloc(4, 0);

  // 4. identity hash (20 bytes from i-address)
  // Already have identityHash

  // 5. SHA256(varint(msgLen) + lowercase(msg))
  const lowerMsg = Buffer.from(challenge.toLowerCase(), 'utf8');
  const msgSlice = Buffer.concat([encodeVarInt(lowerMsg.length), lowerMsg]);
  const msgHash = sha256(msgSlice);

  // 6. Final hash: SHA256(prefix + chainIdHash + heightBuf + identityHash + msgHash)
  const finalHash = sha256(Buffer.concat([prefix, chainIdHash, heightBuf, identityHash, msgHash]));

  // Sign with secp256k1
  const signature = secp256k1.sign(finalHash, privKey);

  // Build compact signature (65 bytes)
  const compactSig = Buffer.alloc(65);
  compactSig[0] = signature.recovery! + 27 + (compressed ? 4 : 0);
  Buffer.from(signature.toCompactRawBytes()).copy(compactSig, 1);

  // Build CIdentitySignature v2 serialized format (73 bytes for single sig):
  // [version:1][hashType:1][blockHeight:4 LE][numSigs:varint][sigLen:varint][sig:65]
  const version = 2;
  const hashType = 5; // SHA256
  const blockHeight = 0;
  const numSigs = 1;

  const result = Buffer.alloc(73);
  result[0] = version;
  result[1] = hashType;
  result.writeUInt32LE(blockHeight, 2);
  result[6] = numSigs; // compactSize for 1
  result[7] = 65; // signature length
  compactSig.copy(result, 8);

  return result.toString('base64');
}

/**
 * Generate keypair from WIF
 */
export function keypairFromWIF(wif: string, network: 'verus' | 'verustest' = 'verustest') {
  const privKey = wifToPrivateKey(wif);
  const pubkey = privateKeyToPublicKey(privKey, true);
  const address = privateKeyToAddress(privKey, network);

  return {
    privateKey: Buffer.from(privKey).toString('hex'),
    publicKey: Buffer.from(pubkey).toString('hex'),
    address,
    wif,
  };
}

/**
 * Generate new keypair
 */
export function generateKeypair(network: 'verus' | 'verustest' = 'verustest') {
  const privKey = crypto.randomBytes(32);
  const wifVersion = network === 'verustest' ? VERUS_NETWORK.wif : VERUS_MAINNET.wif;
  const wifPayload = Buffer.concat([Buffer.from([wifVersion]), privKey, Buffer.from([0x01])]);
  const wif = bs58check.encode(wifPayload);

  return keypairFromWIF(wif, network);
}
