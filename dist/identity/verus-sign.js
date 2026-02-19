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
const secp256k1 = __importStar(require("@noble/secp256k1"));
const sha2_1 = require("@noble/hashes/sha2");
const hmac_1 = require("@noble/hashes/hmac");
const bs58check_1 = __importDefault(require("bs58check"));
// @ts-ignore - no types available
const ripemd160 = __importStar(require("ripemd160"));
// @bitgo/utxo-lib (VerusCoin fork)
// @ts-ignore
const utxolib = require('@bitgo/utxo-lib/dist/src');
const { ECPair, IdentitySignature, networks } = utxolib;
// Configure @noble/secp256k1 sync hash functions
secp256k1.etc.hmacSha256Sync = (key, ...messages) => {
    const h = hmac_1.hmac.create(sha2_1.sha256, key);
    for (const msg of messages)
        h.update(msg);
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
function wifToPrivateKey(wif) {
    const decoded = bs58check_1.default.decode(wif);
    if (decoded.length === 38) {
        return new Uint8Array(decoded.slice(1, 33));
    }
    else if (decoded.length === 37) {
        return new Uint8Array(decoded.slice(1, 33));
    }
    else if (decoded.length === 34) {
        return new Uint8Array(decoded.slice(1, 33));
    }
    throw new Error(`Invalid WIF length: ${decoded.length}`);
}
/**
 * Get public key from private key
 */
function privateKeyToPublicKey(privKey, compressed = true) {
    return secp256k1.getPublicKey(privKey, compressed);
}
/**
 * Hash160 (RIPEMD160(SHA256(data)))
 */
function hash160(data) {
    const sha = (0, sha2_1.sha256)(data);
    const ripe = new ripemd160.default();
    ripe.update(Buffer.from(sha));
    return new Uint8Array(ripe.digest());
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
    compactSig[0] = signature.recovery + 27 + (compressed ? 4 : 0);
    Buffer.from(signature.toCompactRawBytes()).copy(compactSig, 1);
    return compactSig.toString('base64');
}
/**
 * Sign a challenge (CIdentitySignature format)
 *
 * Uses @bitgo/utxo-lib IdentitySignature for proper Verus compatibility.
 *
 * @param wif - Private key in WIF format
 * @param challenge - The message/challenge to sign
 * @param identityAddress - The VerusID (name@) or i-address signing
 * @param network - 'verus' or 'verustest'
 * @returns Base64-encoded CIdentitySignature
 */
function signChallenge(wif, challenge, identityAddress, network = 'verustest') {
    const privKey = wifToPrivateKey(wif);
    // Get ECPair from WIF for @bitgo/utxo-lib
    const networkObj = network === 'verustest' ? networks.verustest : networks.verus;
    const keyPair = ECPair.fromWIF(wif, networkObj);
    // Determine signing identity
    // For onboarding with R-address, use null identity (chainID only)
    // For login/registration with identity, use the identity address
    let signingIdentity = identityAddress;
    if (identityAddress.startsWith('R') || identityAddress.startsWith('V')) {
        // R-address — onboarding, use chainID as identity
        signingIdentity = null;
    }
    // Create IdentitySignature
    // version=2, hashType=5 (SHA256), blockHeight=0
    const idSig = new IdentitySignature(networkObj, 2, // version
    5, // hashType (SHA256)
    0, // blockHeight
    [], // signatures (will be filled by sign)
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