"use strict";
/**
 * Message signing for Verus agents.
 * Pure JS implementation matching Verus C++ source.
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
// Configure @noble/secp256k1 sync hash functions
secp256k1.etc.hmacSha256Sync = (key, ...messages) => {
    const h = hmac_1.hmac.create(sha2_1.sha256, key);
    for (const msg of messages)
        h.update(msg);
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
 * Decode a base58check i-address to get the identity hash
 */
function iAddressToHash(iAddress) {
    const decoded = bs58check_1.default.decode(iAddress);
    // First byte is version (0x66 for i-address), remaining 20 bytes are the hash160
    return decoded.slice(1);
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
function signChallenge(wif, challenge, identityAddress, network = 'verustest') {
    const privKey = wifToPrivateKey(wif);
    const pubkey = privateKeyToPublicKey(privKey, true);
    const compressed = true;
    // Decode chain ID
    const chainIdDecoded = bs58check_1.default.decode(VRSCTEST_CHAIN_ID);
    const chainIdHash = chainIdDecoded.slice(1); // skip version byte
    // Get identity hash from the signing identity
    // For i-addresses: decode to get hash
    // For identity names (name@): compute hash160 of lowercase name
    let identityHash;
    if (identityAddress.startsWith('i')) {
        identityHash = iAddressToHash(identityAddress);
    }
    else if (identityAddress.includes('@')) {
        // Identity name - compute hash160 of lowercase name
        const nameLower = identityAddress.toLowerCase();
        identityHash = hash160(Buffer.from(nameLower, 'utf8'));
    }
    else {
        // R-address fallback: use chainIdHash
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
    const msgHash = (0, sha2_1.sha256)(msgSlice);
    // 6. Final hash: SHA256(prefix + chainIdHash + heightBuf + identityHash + msgHash)
    const finalHash = (0, sha2_1.sha256)(Buffer.concat([prefix, chainIdHash, heightBuf, identityHash, msgHash]));
    // Sign with secp256k1
    const signature = secp256k1.sign(finalHash, privKey);
    // Build compact signature (65 bytes)
    const compactSig = Buffer.alloc(65);
    compactSig[0] = signature.recovery + 27 + (compressed ? 4 : 0);
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