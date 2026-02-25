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
const bitcoinMessage = __importStar(require("bitcoinjs-message"));
// @ts-ignore - VerusCoin fork
const utxolib = __importStar(require("@bitgo/utxo-lib"));
// Extract what we need from utxolib
const ECPair = utxolib.ECPair;
const IdentitySignature = utxolib.IdentitySignature;
const networks = utxolib.networks;
// Derive network constants from utxolib to avoid hardcoded drift
const VERUS_NETWORK = {
    messagePrefix: networks.verustest.messagePrefix || '\x15Verus signed data:\n',
    pubKeyHash: networks.verustest.pubKeyHash,
    scriptHash: networks.verustest.scriptHash,
    wif: networks.verustest.wif,
};
const VERUS_MAINNET = {
    messagePrefix: networks.verus.messagePrefix || '\x15Verus signed data:\n',
    pubKeyHash: networks.verus.pubKeyHash,
    scriptHash: networks.verus.scriptHash,
    wif: networks.verus.wif,
};
/**
 * Decode WIF to private key
 */
function decodeWif(wif) {
    const decoded = bs58check_1.default.decode(wif);
    // bs58check.decode() returns payload without checksum.
    // Valid WIF payload lengths are:
    // - 33 bytes: 1-byte version + 32-byte key (uncompressed)
    // - 34 bytes: 1-byte version + 32-byte key + 0x01 (compressed)
    if (decoded.length === 33 || decoded.length === 34) {
        return {
            privateKey: new Uint8Array(decoded.slice(1, 33)),
            compressed: decoded.length === 34,
        };
    }
    throw new Error(`Invalid WIF length: ${decoded.length}`);
}
function wifToPrivateKey(wif) {
    return decodeWif(wif).privateKey;
}
/**
 * Get public key from private key
 */
function privateKeyToPublicKey(privKey, compressed = true, networkName = 'verustest') {
    const networkConfig = networkName === 'verustest' ? VERUS_NETWORK : VERUS_MAINNET;
    const network = { ...networkConfig, bip32: { public: 0x0488b21e, private: 0x0488ade4 } };
    const privBuf = Buffer.from(privKey);
    const parts = [Buffer.from([network.wif]), privBuf];
    if (compressed)
        parts.push(Buffer.from([0x01]));
    const wifBuf = Buffer.concat(parts);
    try {
        const keyPair = ECPair.fromWIF(bs58check_1.default.encode(wifBuf), network);
        return new Uint8Array(keyPair.getPublicKeyBuffer());
    }
    finally {
        // Zero intermediate buffers that contain private key material
        privBuf.fill(0);
        wifBuf.fill(0);
    }
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
    const pubkey = privateKeyToPublicKey(privKey, true, network);
    const hash = hash160(pubkey);
    const version = network === 'verustest' ? VERUS_NETWORK.pubKeyHash : VERUS_MAINNET.pubKeyHash;
    const payload = Buffer.concat([Buffer.from([version]), hash]);
    return bs58check_1.default.encode(payload);
}
/**
 * Sign a message (legacy format compatible with verus verifymessage)
 */
function signMessage(wif, message, network = 'verustest') {
    const networkConfig = network === 'verustest' ? VERUS_NETWORK : VERUS_MAINNET;
    const { privateKey, compressed } = decodeWif(wif);
    const privKeyBuf = Buffer.from(privateKey);
    try {
        // Use bitcoinjs-message implementation (same magic-hash/signature format used by BitGoJS/verifymessage)
        const sig = bitcoinMessage.sign(message, privKeyBuf, compressed, networkConfig.messagePrefix);
        return Buffer.from(sig).toString('base64');
    }
    finally {
        // Zero private key material
        privateKey.fill(0);
        privKeyBuf.fill(0);
    }
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
    const keyPair = ECPair.fromWIF(wif, networkObj);
    try {
        // Create IdentitySignature (version=2, hashType=5 SHA256, blockHeight=0)
        const idSig = new IdentitySignature(networkObj, 2, // version
        5, // hashType (SHA256)
        0, // blockHeight
        [], // signatures (will be filled by sign)
        chainId, // chain ID (required!)
        signingIdentity // identity (i-address or null for R-address)
        );
        // Sign the message
        idSig.signMessageOffline(challenge, keyPair);
        if (!idSig.signatures?.length) {
            throw new Error('signMessageOffline produced no signatures');
        }
        // Return serialized CIdentitySignature
        return idSig.signatures[0].toString('base64');
    }
    finally {
        // Zero internal key material (best-effort: BN.js internal words array + buffer copy)
        const d = keyPair.d;
        if (d) {
            // Zero the BN.js internal limbs array
            if (d.words && Array.isArray(d.words)) {
                d.words.fill(0);
            }
            // Also zero a buffer copy for completeness
            if (typeof d.toBuffer === 'function') {
                const buf = d.toBuffer(32);
                buf.fill(0);
            }
        }
    }
}
/**
 * Generate keypair from WIF
 */
function keypairFromWIF(wif, network = 'verustest') {
    const { privateKey, compressed } = decodeWif(wif);
    if (!compressed) {
        throw new Error('Uncompressed WIF keys are not supported; Verus requires compressed keys');
    }
    const privKey = privateKey;
    const pubkey = privateKeyToPublicKey(privKey, true, network);
    const address = privateKeyToAddress(privKey, network);
    // Zero the private key material after deriving public key + address
    privKey.fill(0);
    return {
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
    // Zero raw key material after WIF encoding
    privKey.fill(0);
    wifPayload.fill(0);
    return keypairFromWIF(wif, network);
}
//# sourceMappingURL=verus-sign.js.map