/**
 * Pricing Tables — cost data for AI agent services on the Verus Agent Platform.
 *
 * Based on Rex 🔬's research into real-world LLM and API costs.
 * All costs in USD. Convert to VRSC using current exchange rate.
 * ⚠️  Keep in sync with: verus-platform/src/api/routes/pricing.ts
 */
export interface LLMCostEntry {
    model: string;
    inputPer1k: number;
    outputPer1k: number;
    typicalJobCost: number;
    notes: string;
}
export declare const LLM_COSTS: readonly LLMCostEntry[];
export interface ImageCostEntry {
    model: string;
    costPerImage: number;
    notes: string;
}
export declare const IMAGE_COSTS: readonly ImageCostEntry[];
export interface APICostEntry {
    api: string;
    costPerRequest: number;
    notes: string;
}
export declare const API_COSTS: readonly APICostEntry[];
export interface SelfHostedCostEntry {
    model: string;
    gpuType: string;
    hourlyGpuCost: number;
    tokensPerSecond: number;
    costPer1kTokens: number;
    notes: string;
}
export declare const SELF_HOSTED_COSTS: readonly SelfHostedCostEntry[];
export type JobCategory = 'trivial' | 'simple' | 'medium' | 'complex' | 'premium';
export interface MarkupRange {
    min: number;
    max: number;
}
export declare const CATEGORY_MARKUPS: Record<JobCategory, MarkupRange>;
/**
 * Platform fee — 5% of transaction value.
 * Deducted from the seller's payout.
 */
export declare const PLATFORM_FEE = 0.05;
//# sourceMappingURL=tables.d.ts.map