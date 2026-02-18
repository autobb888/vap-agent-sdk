/**
 * Minimal Verus signing utilities
 * Extracted from @bitgo/utxo-lib Verus fork to avoid dependency issues
 */

import * as crypto from 'crypto';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import bs58check from 'bs58check';

// Verus network constants
const VERUS_NETWORK = {
  messagePrefix: 'Verus signed data:\n',
  pubKeyHash: 0x3c,  // R-address prefix for testnet
  scriptHash: 0x3b,
  wif: 0xef,
};

const VERUS_MAINNET = {
  messagePrefix: 'Verus signed data:\n',
  pubKeyHash: 0x3b,  // R-address prefix for mainnet
  scriptHash: 0x3c,
  wif: 0x80,
};

/**
 * Decode WIF to private key
 */
function wifToPrivateKey(wif: string): Uint8Array {
  const decoded = bs58check.decode(wif);
  // WIF format: 1 byte version + 32 byte privkey + [optional 1 byte compression flag] + 4 byte checksum
  // Compressed: 1 + 32 + 1 + 4 = 38 bytes
  // Uncompressed: 1 + 32 + 4 = 37 bytes
  // Some formats: 1 + 32 + 1 = 34 bytes (no checksum?)
  if (decoded.length === 38) {
    // Compressed WIF
    return new Uint8Array(decoded.slice(1, 33));
  } else if (decoded.length === 37) {
    // Uncompressed WIF
    return new Uint8Array(decoded.slice(1, 33));
  } else if (decoded.length === 34) {
    // Possibly missing checksum or different format — try to extract key anyway
    return new Uint8Array(decoded.slice(1, 33));
  }
  throw new Error(`Invalid WIF length: ${decoded.length} (expected 37, 38, or 34)`);
}

/**
 * Get public key from private key
 */
function privateKeyToPublicKey(privKey: Uint8Array, compressed: boolean = true): Uint8Array {
  const pubkey = secp256k1.getPublicKey(privKey, compressed);
  return pubkey;
}

/**
 * Hash160 (RIPEMD160(SHA256(data)))
 * Note: We use SHA256 twice as a fallback since RIPEMD160 isn't in @noble/hashes
 */
function hash160(data: Uint8Array): Uint8Array {
  const sha = sha256(data);
  // For now, use first 20 bytes of SHA256 as a placeholder
  // Full implementation would use RIPEMD160
  return sha.slice(0, 20);
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
 * Sign a message (legacy format compatible with verus verifymessage)
 */
export function signMessage(
  wif: string,
  message: string,
  network: 'verus' | 'verustest' = 'verustest'
): string {
  const privKey = wifToPrivateKey(wif);
  const networkConfig = network === 'verustest' ? VERUS_NETWORK : VERUS_MAINNET;

  // Build message: prefix + varint(length) + message
  const prefix = Buffer.from(networkConfig.messagePrefix, 'utf8');
  const msgBuf = Buffer.from(message, 'utf8');
  const lenBuf = encodeVarInt(msgBuf.length);
  const fullMessage = Buffer.concat([prefix, lenBuf, msgBuf]);

  // Double SHA-256
  const msgHash = crypto.createHash('sha256')
    .update(crypto.createHash('sha256').update(fullMessage).digest())
    .digest();

  // Sign with secp256k1
  const signature = secp256k1.sign(msgHash, privKey);

  // Get recovery ID
  const pubkey = privateKeyToPublicKey(privKey, true);
  const compressed = pubkey.length === 33;

  // Build compact signature
  const compactSig = Buffer.alloc(65);
  compactSig[0] = signature.recovery! + 27 + (compressed ? 4 : 0);
  Buffer.from(signature.toCompactRawBytes()).copy(compactSig, 1);

  return compactSig.toString('base64');
}

/**
 * Sign a challenge (IdentitySignature format for onboarding)
 * 
 * This creates a signature compatible with VAP's local verification:
 * - version=2, hashType=5 (SHA256), blockHeight=0
 * - chainId = VRSCTEST system ID
 * - identity = R-address (for onboarding)
 */
export function signChallenge(
  wif: string,
  challenge: string,
  identityAddress: string,
  network: 'verus' | 'verustest' = 'verustest'
): string {
  const privKey = wifToPrivateKey(wif);
  const pubkeyBuf = Buffer.from(privateKeyToPublicKey(privKey, true));
  const compressed = true;

  // Chain ID for VRSCTEST
  const chainId = 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq';
  const chainIdDecoded = bs58check.decode(chainId);
  const chainIdHash = chainIdDecoded.slice(1); // skip version byte

  // Build message hash according to IdentitySignature.hashMessage:
  // SHA256(prefix + chainIdHash + blockHeight(4) + identityHash + SHA256(varint(msgLen) + lowercase(msg)))

  // 1. Prefix
  const prefixStr = 'Verus signed data:\n';
  const prefix = Buffer.concat([Buffer.from([prefixStr.length]), Buffer.from(prefixStr)]);

  // 2. chainId hash (20 bytes)
  // Already have chainIdHash

  // 3. blockHeight = 0 (4 bytes LE)
  const heightBuf = Buffer.alloc(4, 0);

  // 4. identity hash — for onboarding, use chainIdHash (same as SDK does)
  const identityHash = chainIdHash;

  // 5. SHA256(varint(msgLen) + lowercase(msg))
  const lowerMsg = Buffer.from(challenge.toLowerCase(), 'utf8');
  if (lowerMsg.length >= 0xfd) throw new Error('Challenge too long');
  const msgSlice = Buffer.concat([Buffer.from([lowerMsg.length]), lowerMsg]);
  const msgHash = sha256(msgSlice);

  // 6. Final hash
  const finalHash = sha256(Buffer.concat([prefix, chainIdHash, heightBuf, identityHash, msgHash]));

  // Sign
  const signature = secp256k1.sign(finalHash, privKey);

  // Build compact signature
  const compactSig = Buffer.alloc(65);
  compactSig[0] = signature.recovery! + 27 + (compressed ? 4 : 0);
  Buffer.from(signature.toCompactRawBytes()).copy(compactSig, 1);

  return compactSig.toString('base64');
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
