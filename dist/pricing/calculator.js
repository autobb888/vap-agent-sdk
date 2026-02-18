"use strict";
/**
 * Pricing Calculator — deterministic price estimation for agent jobs.
 *
 * No LLM needed. All calculations are pure math based on the pricing tables.
 * Use `estimateJobCost` for raw cost and `recommendPrice` for pricing guidance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.privacyPremium = privacyPremium;
exports.estimateJobCost = estimateJobCost;
exports.recommendPrice = recommendPrice;
const tables_js_1 = require("./tables.js");
// ────────────────────────────────────────────
// Privacy Premium Multipliers
// ────────────────────────────────────────────
const PRIVACY_MULTIPLIERS = {
    standard: 1.0,
    private: 1.33,
    sovereign: 1.83,
};
/**
 * Apply privacy tier premium to a base price.
 *
 * @param basePrice - Base price in USD
 * @param tier - Privacy tier
 * @returns Adjusted price with privacy premium
 */
function privacyPremium(basePrice, tier) {
    return basePrice * (PRIVACY_MULTIPLIERS[tier] ?? 1.0);
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
function estimateJobCost(model, inputTokens, outputTokens, additionalApis) {
    // Find model in cost table
    const modelCost = tables_js_1.LLM_COSTS.find(m => m.model === model);
    if (!modelCost) {
        throw new Error(`Unknown model: ${model}. Available: ${tables_js_1.LLM_COSTS.map(m => m.model).join(', ')}`);
    }
    // LLM cost
    const llmCost = (inputTokens / 1000) * modelCost.inputPer1k
        + (outputTokens / 1000) * modelCost.outputPer1k;
    // API costs
    let apiCost = 0;
    if (additionalApis) {
        for (const { api, count } of additionalApis) {
            const apiEntry = tables_js_1.API_COSTS.find(a => a.api === api);
            if (apiEntry) {
                apiCost += apiEntry.costPerRequest * count;
            }
        }
    }
    return llmCost + apiCost;
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
function recommendPrice(params) {
    const { model, inputTokens, outputTokens, category, privacyTier = 'standard', vrscUsdRate = 1.0, additionalApis, } = params;
    // Calculate raw cost
    const rawCost = estimateJobCost(model, inputTokens, outputTokens, additionalApis);
    // Apply privacy premium to base cost
    const adjustedCost = privacyPremium(rawCost, privacyTier);
    const multiplier = PRIVACY_MULTIPLIERS[privacyTier] ?? 1.0;
    // Get markup range for category
    const markup = tables_js_1.CATEGORY_MARKUPS[category];
    if (!markup) {
        throw new Error(`Unknown category: ${category}. Available: ${Object.keys(tables_js_1.CATEGORY_MARKUPS).join(', ')}`);
    }
    // Calculate price points
    const feeMultiplier = 1 + tables_js_1.PLATFORM_FEE; // 1.05
    // Minimum: adjusted cost + platform fee (break-even)
    const minUsd = adjustedCost * feeMultiplier;
    // Recommended: midpoint of category markup
    const midMarkup = (markup.min + markup.max) / 2;
    const recUsd = adjustedCost * midMarkup;
    // Premium: high end of category
    const premUsd = adjustedCost * markup.max;
    // Ceiling: 1.5x the premium (absolute max reasonable)
    const ceilUsd = premUsd * 1.5;
    const makePricePoint = (usd) => ({
        usd: round(usd, 6),
        vrsc: round(usd / vrscUsdRate, 6),
        marginPercent: adjustedCost > 0 ? round(((usd - adjustedCost) / adjustedCost) * 100, 1) : 0,
    });
    return {
        rawCost: round(rawCost, 6),
        platformFee: round(rawCost * tables_js_1.PLATFORM_FEE, 6),
        privacyMultiplier: multiplier,
        minimum: makePricePoint(minUsd),
        recommended: makePricePoint(recUsd),
        premium: makePricePoint(premUsd),
        ceiling: makePricePoint(ceilUsd),
    };
}
// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────
function round(n, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(n * factor) / factor;
}
//# sourceMappingURL=calculator.js.map