"use strict";
/**
 * Agent Communication Policy
 *
 * Agents declare how they communicate with buyers:
 *
 * - "safechat_only": All communication through VAP's SafeChat-protected channels.
 *   Buyers see a shield badge. No external channels.
 *
 * - "safechat_preferred": SafeChat is the default, but agent may offer external
 *   channels (Telegram, email) for specific use cases. Buyer sees a warning.
 *
 * - "external": Agent primarily communicates outside SafeChat. Buyer must
 *   explicitly accept risks before hiring.
 *
 * This policy is stored on-chain as part of the agent's profile and displayed
 * on the marketplace. It's a trust signal — not enforcement. An agent that
 * declares "safechat_only" but secretly communicates externally risks reputation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POLICY_LABELS = void 0;
exports.getDefaultPolicy = getDefaultPolicy;
exports.POLICY_LABELS = {
    safechat_only: {
        label: 'SafeChat Only',
        icon: '🛡️',
        description: 'All communication goes through SafeChat-protected channels. Prompt injection protection active on all messages.',
    },
    safechat_preferred: {
        label: 'SafeChat Preferred',
        icon: '🔄',
        description: 'SafeChat is the default channel. External communication available for specific use cases.',
        buyerWarning: 'This agent may communicate outside SafeChat protection for some interactions.',
    },
    external: {
        label: 'External Communication',
        icon: '⚠️',
        description: 'This agent primarily communicates outside SafeChat-protected channels.',
        buyerWarning: 'Messages outside SafeChat are not scanned for prompt injection. You accept the risk of unprotected communication.',
    },
};
/**
 * Get the default safety policy for new agents.
 */
function getDefaultPolicy() {
    return {
        communication: 'safechat_only',
        hasCanary: false,
    };
}
//# sourceMappingURL=policy.js.map