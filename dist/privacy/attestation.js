"use strict";
/**
 * Deletion Attestation — cryptographic proof that job data was destroyed.
 *
 * After completing a job, a Private or Sovereign agent signs an attestation
 * proving that all job data, containers, and volumes were deleted.
 * The attestation is submitted to the platform and publicly verifiable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAttestationPayload = generateAttestationPayload;
exports.signAttestation = signAttestation;
exports.verifyAttestationFormat = verifyAttestationFormat;
const signer_js_1 = require("../identity/signer.js");
const json_canonicalize_1 = require("json-canonicalize");
/**
 * Generate the canonical JSON payload for a deletion attestation.
 * Uses sorted keys for deterministic output.
 * Returns the payload object (without signature).
 */
function generateAttestationPayload(params) {
    return {
        attestedBy: params.attestedBy,
        containerId: params.containerId,
        createdAt: params.createdAt,
        dataVolumes: params.dataVolumes ?? [],
        deletionMethod: params.deletionMethod ?? 'container-destroy+volume-rm',
        destroyedAt: params.destroyedAt,
        jobId: params.jobId,
    };
}
/**
 * Canonical JSON string for signing.
 * Keys are sorted alphabetically for deterministic output.
 */
function canonicalize(payload) {
    return (0, json_canonicalize_1.canonicalize)(payload);
}
/**
 * Sign a deletion attestation payload.
 *
 * @param payload - The attestation payload (without signature)
 * @param wif - WIF private key for signing
 * @param network - 'verus' or 'verustest' (default: 'verustest')
 * @returns Full DeletionAttestation with signature
 */
function signAttestation(payload, wif, network = 'verustest') {
    const message = canonicalize(payload);
    const signature = (0, signer_js_1.signMessage)(wif, message, network);
    return {
        ...payload,
        signature,
    };
}
/**
 * Verify that a DeletionAttestation has all required fields with correct types.
 * Does NOT verify the cryptographic signature — that requires the signer's public key.
 *
 * @returns true if format is valid, throws with message if not
 */
function verifyAttestationFormat(attestation) {
    if (!attestation || typeof attestation !== 'object') {
        throw new Error('Attestation must be a non-null object');
    }
    const a = attestation;
    const requiredStrings = [
        'jobId', 'containerId', 'createdAt', 'destroyedAt',
        'deletionMethod', 'attestedBy', 'signature',
    ];
    for (const field of requiredStrings) {
        if (typeof a[field] !== 'string' || a[field].length === 0) {
            throw new Error(`Missing or invalid field: ${field} (expected non-empty string)`);
        }
    }
    if (!Array.isArray(a.dataVolumes)) {
        throw new Error('Missing or invalid field: dataVolumes (expected string array)');
    }
    for (let i = 0; i < a.dataVolumes.length; i++) {
        if (typeof a.dataVolumes[i] !== 'string') {
            throw new Error(`dataVolumes[${i}] must be a string`);
        }
    }
    return true;
}
//# sourceMappingURL=attestation.js.map