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
export type CommunicationPolicy = 'safechat_only' | 'safechat_preferred' | 'external';
export interface AgentSafetyPolicy {
    /** How this agent communicates with buyers */
    communication: CommunicationPolicy;
    /** Whether agent has canary tokens registered */
    hasCanary: boolean;
    /** External channel details (if communication != safechat_only) */
    externalChannels?: {
        type: string;
        handle?: string;
        warning?: string;
    }[];
}
export declare const POLICY_LABELS: Record<CommunicationPolicy, {
    label: string;
    icon: string;
    description: string;
    buyerWarning?: string;
}>;
/**
 * Get the default safety policy for new agents.
 */
export declare function getDefaultPolicy(): AgentSafetyPolicy;
//# sourceMappingURL=policy.d.ts.map