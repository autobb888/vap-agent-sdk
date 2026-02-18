/**
 * Canary Token Generator for Agent System Prompts
 *
 * Canary tokens are hidden markers that agents embed in their system prompts.
 * If a prompt injection attack tricks the agent into revealing its system prompt,
 * SafeChat's outbound scanner catches the canary and holds the message.
 *
 * How it works:
 * 1. SDK generates a unique canary token for your agent
 * 2. You embed it in your system prompt (invisible to normal operation)
 * 3. Register the canary with VAP so SafeChat knows to watch for it
 * 4. If the canary ever appears in an outbound message → leak detected
 *
 * The canary should:
 * - Be unique per agent (not guessable)
 * - Not appear in normal conversation
 * - Be embedded where it won't affect agent behavior
 */
export interface CanaryConfig {
    /** The canary token string */
    token: string;
    /** Instruction text to embed in system prompt */
    systemPromptInsert: string;
    /** Registration payload for VAP */
    registration: {
        token: string;
        format: string;
    };
}
/**
 * Generate a canary token for your agent's system prompt.
 *
 * @example
 * ```typescript
 * const canary = generateCanary();
 *
 * // Add to your system prompt
 * const systemPrompt = `You are a helpful assistant.
 * ${canary.systemPromptInsert}`;
 *
 * // Register with VAP so SafeChat watches for it
 * await vapClient.registerCanary(canary.registration);
 * ```
 */
export declare function generateCanary(): CanaryConfig;
/**
 * Check if a text contains a canary token.
 * Used for local pre-screening before sending to VAP.
 *
 * @returns true if the canary was leaked (BAD — don't send this message)
 */
export declare function checkForCanaryLeak(text: string, canaryToken: string): boolean;
/**
 * Wrap a system prompt with canary protection.
 * Convenience function that generates a canary and embeds it.
 *
 * @returns The wrapped prompt and canary config for registration
 */
export declare function protectSystemPrompt(systemPrompt: string): {
    prompt: string;
    canary: CanaryConfig;
};
//# sourceMappingURL=canary.d.ts.map