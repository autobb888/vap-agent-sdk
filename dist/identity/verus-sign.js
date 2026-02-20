"use strict";
/**
 * Message signing for Verus agents.
 * Uses @bitgo/utxo-lib (VerusCoin fork) for proper CIdentitySignature support.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signMessage = signMessage;
exports.signChallenge = signChallenge;
exports.keypairFromWIF = keypairFromWIF;
exports.generateKeypair = generateKeypair;
const crypto = __importStar(require("crypto"));
const bs58check_1 = __importDefault(require("bs58check"));
const secp256k1 = __importStar(require("@noble/secp256k1"));
const sha2_js_1 = require("@noble/hashes/sha2.js");
const hmac_js_1 = require("@noble/hashes/hmac.js");
// @ts-ignore - VerusCoin fork
const utxolib = __importStar(require("@bitgo/utxo-lib"));
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
secp256k1.hashes.sha256 = (...msgs) => {
    const hasher = sha2_js_1.sha256.create();
    for (const msg of msgs)
        hasher.update(msg);
    return hasher.digest();
};
secp256k1.hashes.hmacSha256 = (key, ...msgs) => {
    const hasher = hmac_js_1.hmac.create(sha2_js_1.sha256, key);
    for (const msg of msgs)
        hasher.update(msg);
    return hasher.digest();
};
/**
 * Decode WIF to private key
 */
function wifToPrivateKey(wif) {
    const decoded = bs58check_1.default.decode(wif);
    // Standard WIF lengths:
    // - 37 bytes: 1-byte version + 32-byte key + 4-byte checksum (uncompressed)
    // - 38 bytes: 1-byte version + 32-byte key + 1-byte compression flag + 4-byte checksum
    if (decoded.length === 38 || decoded.length === 37) {
        return new Uint8Array(decoded.slice(1, 33));
    }
    throw new Error(`Invalid WIF length: ${decoded.length}`);
}
/**
 * Get public key from private key
 */
function privateKeyToPublicKey(privKey, compressed = true) {
    const network = { ...VERUS_NETWORK, bip32: { public: 0x0488b21e, private: 0x0488ade4 } };
    const keyPair = ECPair.fromWIF(bs58check_1.default.encode(Buffer.concat([Buffer.from([network.wif]), privKey, Buffer.from([0x01])])), network);
    return new Uint8Array(keyPair.getPublicKeyBuffer());
}
/**
 * Hash160 (RIPEMD160(SHA256(data)))
 */
function hash160(data) {
    const sha = crypto.createHash('sha256').update(data).digest();
    const ripe = crypto.createHash('ripemd160').update(sha).digest();
    return new Uint8Array(ripe);
}
/**
 * Private key to R-address
 */
function privateKeyToAddress(privKey, network = 'verustest') {
    const pubkey = privateKeyToPublicKey(privKey, true);
    const hash = hash160(pubkey);
    const version = network === 'verustest' ? VERUS_NETWORK.pubKeyHash : VERUS_MAINNET.pubKeyHash;
    const payload = Buffer.concat([Buffer.from([version]), hash]);
    return bs58check_1.default.encode(payload);
}
/**
 * Encode varint
 */
function encodeVarInt(n) {
    if (n < 0xfd)
        return Buffer.from([n]);
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
function signMessage(wif, message, network = 'verustest') {
    const privKey = wifToPrivateKey(wif);
    const networkConfig = network === 'verustest' ? VERUS_NETWORK : VERUS_MAINNET;
    // Verus/Bitcoin message hash:
    // SHA256(SHA256(varint(prefixLen)+prefix+varint(msgLen)+msg))
    const prefix = Buffer.from(networkConfig.messagePrefix, 'utf8');
    const msgBuf = Buffer.from(message, 'utf8');
    const fullMessage = Buffer.concat([
        encodeVarInt(prefix.length),
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
    });
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
function signChallenge(wif, challenge, identityAddress, network = 'verustest') {
    const networkObj = network === 'verustest' ? networks.verustest : networks.verus;
    // Determine signing identity for CIdentitySignature
    // For R-address (onboarding): use chainId as identity (server expects this)
    // For i-address (login/registration): use the i-address
    const chainId = network === 'verustest'
        ? 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'
        : 'i5w5MuNik5NtLmYmNy2rTXXWiAK3K4Ef3p';
    const signingIdentity = (identityAddress.startsWith('R') || identityAddress.startsWith('V'))
        ? chainId // Onboarding: use chainId as identity
        : identityAddress; // Login/registration: use i-address
    // Get keyPair from WIF
    let keyPair;
    try {
        keyPair = ECPair.fromWIF(wif, networkObj);
    }
    catch (err) {
        console.error('[signChallenge] ECPair.fromWIF failed:', err.message);
        console.error('[signChallenge] Network:', network);
        throw err;
    }
    // Create IdentitySignature
    // version=2, hashType=5 (SHA256), blockHeight=0
    // chainId already defined above
    let idSig;
    try {
        idSig = new IdentitySignature(networkObj, 2, // version
        5, // hashType (SHA256)
        0, // blockHeight
        [], // signatures (will be filled by sign)
        chainId, // chain ID (required!)
        signingIdentity // identity (i-address or null for R-address)
        );
    }
    catch (err) {
        console.error('[signChallenge] new IdentitySignature failed:', err.message);
        console.error('[signChallenge] signingIdentity:', signingIdentity);
        console.error('[signChallenge] chainId:', chainId);
        throw err;
    }
    // Sign the message
    try {
        idSig.signMessageOffline(challenge, keyPair);
    }
    catch (err) {
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
function keypairFromWIF(wif, network = 'verustest') {
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
function generateKeypair(network = 'verustest') {
    const privKey = crypto.randomBytes(32);
    const wifVersion = network === 'verustest' ? VERUS_NETWORK.wif : VERUS_MAINNET.wif;
    const wifPayload = Buffer.concat([Buffer.from([wifVersion]), privKey, Buffer.from([0x01])]);
    const wif = bs58check_1.default.encode(wifPayload);
    return keypairFromWIF(wif, network);
}
//# sourceMappingURL=verus-sign.js.map