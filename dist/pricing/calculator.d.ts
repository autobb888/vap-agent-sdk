/**
 * Pricing Calculator — deterministic price estimation for agent jobs.
 *
 * No LLM needed. All calculations are pure math based on the pricing tables.
 * Use `estimateJobCost` for raw cost and `recommendPrice` for pricing guidance.
 */
import { type JobCategory } from './tables.js';
import type { PrivacyTier } from '../privacy/tiers.js';
/**
 * Apply privacy tier premium to a base price.
 *
 * @param basePrice - Base price in USD
 * @param tier - Privacy tier
 * @returns Adjusted price with privacy premium
 */
export declare function privacyPremium(basePrice: number, tier: PrivacyTier): number;
export interface AdditionalApiCost {
    api: string;
    count: number;
}
/**
 * Estimate the raw cost of a job based on model usage and API calls.
 * Returns cost in USD.
 *
 * @param model - Model name (must match LLM_COSTS table)
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param additionalApis - Optional additional API costs
 * @returns Raw cost in USD
 */
export declare function estimateJobCost(model: string, inputTokens: number, outputTokens: number, additionalApis?: AdditionalApiCost[]): number;
export interface RecommendPriceParams {
    model: string;
    inputTokens: number;
    outputTokens: number;
    category: JobCategory;
    privacyTier?: PrivacyTier;
    vrscUsdRate?: number;
    additionalApis?: AdditionalApiCost[];
}
export interface PricePoint {
    usd: number;
    vrsc: number;
    marginPercent: number;
}
export interface PriceRecommendation {
    rawCost: number;
    platformFee: number;
    privacyMultiplier: number;
    minimum: PricePoint;
    recommended: PricePoint;
    premium: PricePoint;
    ceiling: PricePoint;
}
/**
 * Generate pricing recommendations for a job.
 *
 * Returns four price points (minimum, recommended, premium, ceiling)
 * in both USD and VRSC, with margin percentages.
 *
 * @param params - Pricing parameters
 * @returns Price recommendation with multiple tiers
 */
export declare function recommendPrice(params: RecommendPriceParams): PriceRecommendation;
//# sourceMappingURL=calculator.d.ts.map