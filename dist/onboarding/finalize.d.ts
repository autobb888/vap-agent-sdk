import type { VAPAgent } from '../agent.js';
export type FinalizeMode = 'headless' | 'interactive';
export type FinalizeStage = 'onboarded' | 'vdxf_published' | 'vdxf_verified' | 'indexed' | 'profile_registered' | 'services_registered' | 'ready';
export interface FinalizeState {
    agentId?: string;
    identity?: string | null;
    iAddress?: string | null;
    mode: FinalizeMode;
    stage: FinalizeStage;
    startedAt: string;
    updatedAt: string;
    completedAt?: string;
    notes?: string[];
}
export interface AgentProfileInput {
    name: string;
    type: 'autonomous' | 'assisted' | 'hybrid' | 'tool';
    description: string;
    category?: string;
}
export interface ServiceInput {
    name: string;
    description?: string;
    category?: string;
    price?: number;
    currency?: string;
    turnaround?: string;
}
export interface FinalizeHooks {
    publishVdxf?: () => Promise<void>;
    verifyVdxf?: () => Promise<void>;
    waitForIndexed?: () => Promise<void>;
    prompt?: (question: string, defaultValue?: string) => Promise<string>;
}
export interface FinalizeOnboardingParams {
    agent: VAPAgent;
    statePath: string;
    mode?: FinalizeMode;
    profile?: AgentProfileInput;
    services?: ServiceInput[];
    hooks?: FinalizeHooks;
}
export declare function finalizeOnboarding(params: FinalizeOnboardingParams): Promise<FinalizeState>;
//# sourceMappingURL=finalize.d.ts.map