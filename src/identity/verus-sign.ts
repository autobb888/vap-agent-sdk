/**
 * Message signing for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for proper CIdentitySignature support.
 */

import * as crypto from 'crypto';
import bs58check from 'bs58check';

// @ts-ignore - VerusCoin fork
import * as utxolib from '@bitgo/utxo-lib';
const { ECPair, IdentitySignature, networks } = utxolib;

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
  // Use secp256k1 from utxolib
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privKey), { compressed });
  return new Uint8Array(keyPair.publicKey);
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

  const prefix = Buffer.from(networkConfig.messagePrefix, 'utf8');
  const msgBuf = Buffer.from(message, 'utf8');
  const lenBuf = encodeVarInt(msgBuf.length);
  const fullMessage = Buffer.concat([prefix, lenBuf, msgBuf]);

  const msgHash = crypto.createHash('sha256')
    .update(crypto.createHash('sha256').update(fullMessage).digest())
    .digest();

  // Sign with utxolib
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privKey));
  const signature = keyPair.sign(msgHash);
  
  // Get recovery ID
  const pubkey = privateKeyToPublicKey(privKey, true);
  const compressed = pubkey.length === 33;

  const compactSig = Buffer.alloc(65);
  // Find recovery ID
  for (let recid = 0; recid < 4; recid++) {
    try {
      const sig = signature.toCompact(recid, compressed);
      compactSig[0] = sig.readUInt8(0);
      sig.copy(compactSig, 1, 1);
      break;
    } catch {}
  }

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
  // Get ECPair from WIF for @bitgo/utxo-lib
  const networkObj = network === 'verustest' ? networks.verustest : networks.verus;
  const keyPair = ECPair.fromWIF(wif, networkObj);
  
  // Determine signing identity
  // For onboarding with R-address, use null identity (chainID only)
  // For login/registration with identity, use the identity address
  let signingIdentity: string | null = identityAddress;
  if (identityAddress.startsWith('R') || identityAddress.startsWith('V')) {
    // R-address — onboarding, use chainID as identity
    signingIdentity = null;
  }
  
  // Create IdentitySignature
  // version=2, hashType=5 (SHA256), blockHeight=0
  const idSig = new IdentitySignature(
    networkObj,
    2,    // version
    5,    // hashType (SHA256)
    0,    // blockHeight
    [],   // signatures (will be filled by sign)
    null, // chainId (auto from network)
    signingIdentity // identity (i-address or null for R-address)
  );
  
  // Sign the message
  idSig.signMessageOffline(challenge, keyPair);
  
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
