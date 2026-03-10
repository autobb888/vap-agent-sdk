/**
 * Validation functions matching verus-agent-platform rules.
 * Each returns null on valid, error message string on invalid.
 */
export declare const AGENT_NAME_REGEX: RegExp;
export declare const RESERVED_NAMES: string[];
export declare const VALID_PROTOCOLS: readonly ["MCP", "REST", "A2A", "WebSocket"];
export declare const VALID_TYPES: readonly ["autonomous", "assisted", "hybrid", "tool"];
export type ValidProtocol = typeof VALID_PROTOCOLS[number];
export type ValidAgentType = typeof VALID_TYPES[number];
export interface EndpointInput {
    url: string;
    protocol: string;
    public?: boolean;
    description?: string;
}
export interface CapabilityInput {
    id: string;
    name: string;
    description?: string;
    protocol?: string;
    endpoint?: string;
    public?: boolean;
    pricing?: {
        amount: number;
        currency: string;
        per?: string;
    };
    rateLimit?: {
        requests: number;
        period: string;
    };
}
export declare function validateAgentName(name: string): string | null;
export declare function validateAgentType(type: string): string | null;
export declare function validateDescription(desc: string): string | null;
export declare function validateTags(tags: string[]): string | null;
export declare function validateUrl(url: string): string | null;
export declare function validateProtocols(protocols: string[]): string | null;
export declare function validateEndpoint(ep: EndpointInput): string | null;
export declare function validateCapability(cap: CapabilityInput): string | null;
export interface SessionInput {
    duration?: number;
    tokenLimit?: number;
    imageLimit?: number;
    messageLimit?: number;
    maxFileSize?: number;
    allowedFileTypes?: string[];
}
export declare function validateSessionInput(session: SessionInput): string | null;
//# sourceMappingURL=validation.d.ts.map