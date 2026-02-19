/**
 * Message signing for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for proper CIdentitySignature support.
 */

import * as crypto from 'crypto';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { hmac } from '@noble/hashes/hmac';
import bs58check from 'bs58check';

// @ts-ignore - no types available
import * as ripemd160 from 'ripemd160';

// @bitgo/utxo-lib (VerusCoin fork) for IdentitySignature
// @ts-ignore
import { IdentitySignature } from '@bitgo/utxo-lib/dist/cjs/vrsc/IdentitySignature';

// Configure @noble/secp256k1 sync hash functions
secp256k1.etc.hmacSha256Sync = (key: Uint8Array, ...messages: Uint8Array[]) => {
  const h = hmac.create(sha256, key);
  for (const msg of messages) h.update(msg);
  return h.digest();
};

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
 * Sign a challenge (CIdentitySignature format)
 * 
 * Uses @bitgo/utxo-lib IdentitySignature for proper Verus compatibility.
 * The identityAddress can be:
 * - R-address (onboarding): signs with chainId as identity
 * - i-address (login/registration): signs with the i-address identity
 * - Identity name: resolves to the appropriate identity
 */
export function signChallenge(
  wif: string,
  challenge: string,
  identityAddress: string,
  network: 'verus' | 'verustest' = 'verustest'
): string {
  const privKey = wifToPrivateKey(wif);
  
  // Get private key as hex for IdentitySignature
  const privKeyHex = Buffer.from(privKey).toString('hex');
  
  // Determine the signing identity
  // For R-addresses (onboarding), the SDK uses the R-address itself in some contexts
  // For i-addresses/login, use the i-address
  const signingIdentity = identityAddress;
  
  // Use IdentitySignature from @bitgo/utxo-lib for proper CIdentitySignature format
  // version=2, hashType=5 (SHA256), blockHeight=0
  try {
    const idSig = IdentitySignature.signMessageOffline(
      challenge,
      signingIdentity,
      privKeyHex,
      2, // version
      5, // hashType (SHA256)
      0, // blockHeight
      'VRSCTEST' // system ID
    );
    
    // Return serialized CIdentitySignature (base64)
    return idSig.toBuffer().toString('base64');
  } catch (err) {
    console.error('[signChallenge] IdentitySignature failed:', err);
    throw err;
  }
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
