/**
 * Message signing for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for proper CIdentitySignature support.
 */

import * as crypto from 'crypto';
import bs58check from 'bs58check';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';

// @ts-ignore - VerusCoin fork
import * as utxolib from '@bitgo/utxo-lib';

// Extract what we need from utxolib
const ECPair = utxolib.ECPair;
const IdentitySignature = utxolib.IdentitySignature;
const networks = utxolib.networks;

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

// Configure noble secp256k1 hash functions
secp256k1.hashes.sha256 = (...msgs: Uint8Array[]) => {
  const hasher = sha256.create();
  for (const msg of msgs) hasher.update(msg);
  return hasher.digest();
};
secp256k1.hashes.hmacSha256 = (key: Uint8Array, ...msgs: Uint8Array[]) => {
  const hasher = hmac.create(sha256, key);
  for (const msg of msgs) hasher.update(msg);
  return hasher.digest();
};

/**
 * Decode WIF to private key
 */
function wifToPrivateKey(wif: string): Uint8Array {
  const decoded = bs58check.decode(wif);
  // bs58check.decode() returns payload without checksum.
  // Valid WIF payload lengths are:
  // - 33 bytes: 1-byte version + 32-byte key (uncompressed)
  // - 34 bytes: 1-byte version + 32-byte key + 0x01 (compressed)
  if (decoded.length === 33 || decoded.length === 34) {
    return new Uint8Array(decoded.slice(1, 33));
  }
  throw new Error(`Invalid WIF length: ${decoded.length}`);
}

/**
 * Get public key from private key
 */
function privateKeyToPublicKey(privKey: Uint8Array, compressed: boolean = true): Uint8Array {
  const network = { ...VERUS_NETWORK, bip32: { public: 0x0488b21e, private: 0x0488ade4 } };
  const keyPair = ECPair.fromWIF(bs58check.encode(Buffer.concat([Buffer.from([network.wif]), privKey, Buffer.from([0x01])])), network);
  return new Uint8Array(keyPair.getPublicKeyBuffer());
}

/**
 * Hash160 (RIPEMD160(SHA256(data)))
 */
function hash160(data: Uint8Array): Uint8Array {
  const sha = crypto.createHash('sha256').update(data).digest();
  const ripe = crypto.createHash('ripemd160').update(sha).digest();
  return new Uint8Array(ripe);
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

  // Verus/Bitcoin message hash (bitcoinjs-message compatible):
  // SHA256(SHA256(prefix + varint(msgLen) + msg))
  // NOTE: prefix already contains leading control byte (e.g. \x15Verus signed data:\n)
  const prefix = Buffer.from(networkConfig.messagePrefix, 'utf8');
  const msgBuf = Buffer.from(message, 'utf8');
  const fullMessage = Buffer.concat([
    prefix,
    encodeVarInt(msgBuf.length),
    msgBuf,
  ]);

  const msgHash = crypto.createHash('sha256')
    .update(crypto.createHash('sha256').update(fullMessage).digest())
    .digest();

  // Create recoverable compact signature (65 bytes: [recid(0-3), r(32), s(32)])
  const recoveredSig = secp256k1.sign(msgHash, privKey, {
    prehash: false,
    format: 'recovered',
  }) as Uint8Array;

  // Convert to Bitcoin/Verus compact format: header = 27 + recid + (compressed ? 4 : 0)
  const recid = recoveredSig[0];
  const compact = Buffer.alloc(65);
  compact[0] = 27 + recid + 4; // compressed=true
  Buffer.from(recoveredSig.slice(1)).copy(compact, 1);

  return compact.toString('base64');
}

/**
 * Sign a challenge (CIdentitySignature format)
 * 
 * Uses @bitgo/utxo-lib IdentitySignature for proper Verus compatibility.
 * 
 * @param wif - Private key in WIF format
 * @param challenge - The message/challenge to sign
 * @param identityAddress - The i-address or identity name signing
 * @param network - 'verus' or 'verustest'
 * @returns Base64-encoded CIdentitySignature
 */
export function signChallenge(
  wif: string,
  challenge: string,
  identityAddress: string,
  network: 'verus' | 'verustest' = 'verustest'
): string {
  const networkObj = network === 'verustest' ? networks.verustest : networks.verus;
  
  // Determine signing identity for CIdentitySignature
  // For R-address (onboarding): use chainId as identity (server expects this)
  // For i-address (login/registration): use the i-address
  const chainId = network === 'verustest'
    ? 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
    : 'i5w5MuNik5NtLmYmNy2rTXXWiAK3K4Ef3p';
  const signingIdentity = (identityAddress.startsWith('R') || identityAddress.startsWith('V'))
    ? chainId  // Onboarding: use chainId as identity
    : identityAddress;  // Login/registration: use i-address
  
  // Get keyPair from WIF
  let keyPair;
  try {
    keyPair = ECPair.fromWIF(wif, networkObj);
  } catch (err: any) {
    console.error('[signChallenge] ECPair.fromWIF failed:', err.message);
    console.error('[signChallenge] Network:', network);
    throw err;
  }
  
  // Create IdentitySignature
  // version=2, hashType=5 (SHA256), blockHeight=0
  // chainId already defined above
  
  let idSig;
  try {
    idSig = new IdentitySignature(
      networkObj,
      2,    // version
      5,    // hashType (SHA256)
      0,    // blockHeight
      [],   // signatures (will be filled by sign)
      chainId, // chain ID (required!)
      signingIdentity // identity (i-address or null for R-address)
    );
  } catch (err: any) {
    console.error('[signChallenge] new IdentitySignature failed:', err.message);
    console.error('[signChallenge] signingIdentity:', signingIdentity);
    console.error('[signChallenge] chainId:', chainId);
    throw err;
  }
  
  // Sign the message
  try {
    idSig.signMessageOffline(challenge, keyPair);
  } catch (err: any) {
    console.error('[signChallenge] signMessageOffline failed:', err.message);
    throw err;
  }
  
  // Return compact signature (65 bytes) for both R-address and i-address
  // Server verifymessage expects 65-byte compact signature
  return idSig.signatures[0].toString('base64');
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
