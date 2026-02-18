/**
 * Privacy Tier definitions for the Verus Agent Platform.
 *
 * Agents declare a privacy tier to communicate their data handling
 * guarantees to buyers. Higher tiers command premium pricing.
 */
export type PrivacyTier = 'standard' | 'private' | 'sovereign';
export interface PrivacyTierMeta {
    tier: PrivacyTier;
    label: string;
    badge: string;
    description: string;
    premiumRange: {
        min: number;
        max: number;
    };
    requirements: string[];
}
export declare const PRIVACY_TIERS: Record<PrivacyTier, PrivacyTierMeta>;
//# sourceMappingURL=tiers.d.ts.map