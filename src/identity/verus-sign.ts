/**
 * Message signing for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for proper CIdentitySignature support.
 */

import * as crypto from 'crypto';
import bs58check from 'bs58check';

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
  const fullNetwork = { ...networkConfig, bip32: { public: 0x0488b21e, private: 0x0488ade4 } };

  const prefix = Buffer.from(networkConfig.messagePrefix, 'utf8');
  const msgBuf = Buffer.from(message, 'utf8');
  const lenBuf = encodeVarInt(msgBuf.length);
  const fullMessage = Buffer.concat([prefix, lenBuf, msgBuf]);

  const msgHash = crypto.createHash('sha256')
    .update(crypto.createHash('sha256').update(fullMessage).digest())
    .digest();

  // Sign with utxolib
  const keyPair = ECPair.fromWIF(wif, fullNetwork);
  const signature = keyPair.sign(msgHash);
  
  // Get compact signature with recovery ID
  const compactSig = signature.toCompact(0, true);

  return compactSig.toString('base64');
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
  
  // Determine signing identity
  // For onboarding with R-address, use null identity (chainID only)
  // For login/registration with identity, use the identity address
  let signingIdentity: string | null = identityAddress;
  if (identityAddress.startsWith('R') || identityAddress.startsWith('V')) {
    // R-address — onboarding, use chainID as identity
    signingIdentity = null;
  }
  
  // Get keyPair from WIF
  let keyPair;
  try {
    keyPair = ECPair.fromWIF(wif, networkObj);
  } catch (err: any) {
    console.error('[signChallenge] ECPair.fromWIF failed:', err.message);
    console.error('[signChallenge] WIF:', wif.slice(0, 10) + '...');
    console.error('[signChallenge] Network:', network);
    throw err;
  }
  
  // Create IdentitySignature
  // version=2, hashType=5 (SHA256), blockHeight=0
  // VRSCTEST chain ID: iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq
  const chainId = network === 'verustest' 
    ? 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq' 
    : 'i5w5MuNik5NtLmYmNy2rTXXWiAK3K4Ef3p'; // VRSC mainnet
  
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
  
  // Return serialized CIdentitySignature (base64)
  return idSig.toBuffer().toString('base64');
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
