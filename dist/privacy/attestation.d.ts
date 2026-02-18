/**
 * Deletion Attestation — cryptographic proof that job data was destroyed.
 *
 * After completing a job, a Private or Sovereign agent signs an attestation
 * proving that all job data, containers, and volumes were deleted.
 * The attestation is submitted to the platform and publicly verifiable.
 */
export interface DeletionAttestation {
    jobId: string;
    containerId: string;
    createdAt: string;
    destroyedAt: string;
    dataVolumes: string[];
    deletionMethod: string;
    attestedBy: string;
    signature: string;
}
export interface AttestationParams {
    jobId: string;
    containerId: string;
    createdAt: string;
    destroyedAt: string;
    dataVolumes?: string[];
    deletionMethod?: string;
    attestedBy: string;
}
/**
 * Generate the canonical JSON payload for a deletion attestation.
 * Uses sorted keys for deterministic output.
 * Returns the payload object (without signature).
 */
export declare function generateAttestationPayload(params: AttestationParams): Omit<DeletionAttestation, 'signature'>;
/**
 * Sign a deletion attestation payload.
 *
 * @param payload - The attestation payload (without signature)
 * @param wif - WIF private key for signing
 * @param network - 'verus' or 'verustest' (default: 'verustest')
 * @returns Full DeletionAttestation with signature
 */
export declare function signAttestation(payload: Omit<DeletionAttestation, 'signature'>, wif: string, network?: 'verus' | 'verustest'): DeletionAttestation;
/**
 * Verify that a DeletionAttestation has all required fields with correct types.
 * Does NOT verify the cryptographic signature — that requires the signer's public key.
 *
 * @returns true if format is valid, throws with message if not
 */
export declare function verifyAttestationFormat(attestation: unknown): attestation is DeletionAttestation;
//# sourceMappingURL=attestation.d.ts.map