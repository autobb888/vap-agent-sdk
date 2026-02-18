"use strict";
/**
 * Pricing Tables — cost data for AI agent services on the Verus Agent Platform.
 *
 * Based on Rex 🔬's research into real-world LLM and API costs.
 * All costs in USD. Convert to VRSC using current exchange rate.
 * ⚠️  Keep in sync with: verus-platform/src/api/routes/pricing.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_FEE = exports.CATEGORY_MARKUPS = exports.SELF_HOSTED_COSTS = exports.API_COSTS = exports.IMAGE_COSTS = exports.LLM_COSTS = void 0;
exports.LLM_COSTS = [
    // OpenAI
    { model: 'gpt-4o', inputPer1k: 0.0025, outputPer1k: 0.01, typicalJobCost: 0.015, notes: 'OpenAI flagship multimodal' },
    { model: 'gpt-4o-mini', inputPer1k: 0.00015, outputPer1k: 0.0006, typicalJobCost: 0.0009, notes: 'OpenAI budget model' },
    { model: 'gpt-4-turbo', inputPer1k: 0.01, outputPer1k: 0.03, typicalJobCost: 0.05, notes: 'OpenAI GPT-4 Turbo' },
    { model: 'o1', inputPer1k: 0.015, outputPer1k: 0.06, typicalJobCost: 0.09, notes: 'OpenAI reasoning model' },
    { model: 'o1-mini', inputPer1k: 0.003, outputPer1k: 0.012, typicalJobCost: 0.018, notes: 'OpenAI reasoning (smaller)' },
    // Anthropic
    { model: 'claude-3.5-sonnet', inputPer1k: 0.003, outputPer1k: 0.015, typicalJobCost: 0.021, notes: 'Anthropic Sonnet 3.5' },
    { model: 'claude-3-opus', inputPer1k: 0.015, outputPer1k: 0.075, typicalJobCost: 0.105, notes: 'Anthropic Opus (premium)' },
    { model: 'claude-3-haiku', inputPer1k: 0.00025, outputPer1k: 0.00125, typicalJobCost: 0.00175, notes: 'Anthropic Haiku (budget)' },
    // Google
    { model: 'gemini-1.5-pro', inputPer1k: 0.00125, outputPer1k: 0.005, typicalJobCost: 0.0075, notes: 'Google Gemini Pro' },
    { model: 'gemini-1.5-flash', inputPer1k: 0.000075, outputPer1k: 0.0003, typicalJobCost: 0.00045, notes: 'Google Gemini Flash (very cheap)' },
    // Open-source (API providers like Together, Fireworks)
    { model: 'llama-3.1-70b', inputPer1k: 0.0009, outputPer1k: 0.0009, typicalJobCost: 0.0027, notes: 'Meta Llama 70B via API' },
    { model: 'llama-3.1-8b', inputPer1k: 0.0002, outputPer1k: 0.0002, typicalJobCost: 0.0006, notes: 'Meta Llama 8B via API' },
    { model: 'mixtral-8x7b', inputPer1k: 0.0006, outputPer1k: 0.0006, typicalJobCost: 0.0018, notes: 'Mistral MoE via API' },
    { model: 'deepseek-v2', inputPer1k: 0.00014, outputPer1k: 0.00028, typicalJobCost: 0.00056, notes: 'DeepSeek V2 (very cheap)' },
    // Self-hosted (see SELF_HOSTED_COSTS for GPU costs)
    { model: 'self-hosted-7b', inputPer1k: 0.0001, outputPer1k: 0.0001, typicalJobCost: 0.0003, notes: 'Self-hosted 7B model (GPU amortized)' },
    { model: 'self-hosted-70b', inputPer1k: 0.0005, outputPer1k: 0.0005, typicalJobCost: 0.0015, notes: 'Self-hosted 70B model (GPU amortized)' },
];
exports.IMAGE_COSTS = [
    { model: 'dall-e-3-standard', costPerImage: 0.04, notes: 'DALL-E 3 1024x1024 Standard' },
    { model: 'dall-e-3-hd', costPerImage: 0.08, notes: 'DALL-E 3 1024x1024 HD' },
    { model: 'dall-e-2', costPerImage: 0.02, notes: 'DALL-E 2 1024x1024' },
    { model: 'stable-diffusion-xl', costPerImage: 0.002, notes: 'SDXL via API (Stability)' },
    { model: 'midjourney', costPerImage: 0.05, notes: 'Midjourney (estimated per-image)' },
    { model: 'self-hosted-sd', costPerImage: 0.001, notes: 'Self-hosted Stable Diffusion (GPU amortized)' },
];
exports.API_COSTS = [
    { api: 'web-search', costPerRequest: 0.005, notes: 'Google/Bing search API' },
    { api: 'weather', costPerRequest: 0.001, notes: 'Weather API' },
    { api: 'translation', costPerRequest: 0.01, notes: 'Translation API (per paragraph)' },
    { api: 'code-execution', costPerRequest: 0.005, notes: 'Sandboxed code execution' },
    { api: 'pdf-extraction', costPerRequest: 0.01, notes: 'PDF text extraction' },
    { api: 'ocr', costPerRequest: 0.015, notes: 'OCR per image' },
    { api: 'tts', costPerRequest: 0.02, notes: 'Text-to-speech per page' },
    { api: 'stt', costPerRequest: 0.006, notes: 'Speech-to-text per minute' },
];
exports.SELF_HOSTED_COSTS = [
    { model: '7b-quantized', gpuType: 'RTX 4090', hourlyGpuCost: 0.40, tokensPerSecond: 80, costPer1kTokens: 0.0014, notes: '7B Q4 on consumer GPU' },
    { model: '7b-quantized', gpuType: 'A100-40GB', hourlyGpuCost: 1.50, tokensPerSecond: 120, costPer1kTokens: 0.0035, notes: '7B Q4 on datacenter GPU' },
    { model: '70b-quantized', gpuType: 'A100-80GB', hourlyGpuCost: 2.00, tokensPerSecond: 30, costPer1kTokens: 0.0185, notes: '70B Q4 on A100 80GB' },
    { model: '70b-quantized', gpuType: '2xA100-80GB', hourlyGpuCost: 4.00, tokensPerSecond: 60, costPer1kTokens: 0.0185, notes: '70B Q4 on dual A100' },
];
exports.CATEGORY_MARKUPS = {
    trivial: { min: 2, max: 3 },
    simple: { min: 3, max: 5 },
    medium: { min: 5, max: 10 },
    complex: { min: 10, max: 20 },
    premium: { min: 20, max: 50 },
};
/**
 * Platform fee — 5% of transaction value.
 * Deducted from the seller's payout.
 */
exports.PLATFORM_FEE = 0.05;
//# sourceMappingURL=tables.js.map