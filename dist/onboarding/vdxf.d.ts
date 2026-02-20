import type { AgentProfileInput, ServiceInput } from './finalize.js';
export declare const VDXF_KEYS: {
    readonly agent: {
        readonly version: "iBShCc1dESnTq25WkxzrKGjHvHwZFSoq6b";
        readonly type: "i9YN6ovGcotCnFdNyUtNh72Nw11WcBuD8y";
        readonly name: "i3oa8uNjgZjmC1RS8rg1od8czBP8bsh5A8";
        readonly description: "i9Ww2jR4sFt7nzdc5vRy5MHUCjTWULXCqH";
        readonly status: "iNCvffXEYWNBt1K5izxKFSFKBR5LPAAfxW";
        readonly capabilities: "i7Aumh6Akeq7SC8VJBzpmJrqKNCvREAWMA";
        readonly endpoints: "i9n5Vu8fjXLP5CxzcdpwHbSzaW22dJxvHc";
        readonly protocols: "iFQzXU4V6am1M9q6LGBfR4uyNAtjhJiW2d";
        readonly owner: "i5uUotnF2LzPci3mkz9QaozBtFjeFtAw45";
        readonly services: "iGVUNBQSNeGzdwjA4km5z6R9h7T2jao9Lz";
    };
    readonly service: {
        readonly name: "iNTrSV1bqDAoaGRcpR51BeoS5wQvQ4P9Qj";
        readonly description: "i7ZUWAqwLu9b4E8oXZq4uX6X5W6BJnkuHz";
        readonly price: "iLjLxTk1bkEd7SAAWT27VQ7ECFuLtTnuKv";
        readonly currency: "iANfkUFM797eunQt4nFV3j7SvK8pUkfsJe";
        readonly category: "iGiUqVQcdLC3UAj8mHtSyWNsAKdEVXUFVC";
        readonly turnaround: "iNGq3xh28oV2U3VmMtQ3gjMX8jrH1ohKfp";
        readonly status: "iNbPugdyVSCv54zsZs68vAfvifcf14btX2";
    };
    readonly review: {
        readonly buyer: "iPbx6NP7ZVLySKJU5Rfbt3saxNLaxHHV85";
        readonly jobHash: "iFgEMF3Fbj1EFU7bAPjmrvMKUU9QfZumNP";
        readonly message: "iKokqh2YmULa4HkSWRRJaywNMvGzRv7JTt";
        readonly rating: "iDznRwvMsTaMmQ6zkfQTJKWb5YCh8RHyp5";
        readonly signature: "iJZHVjWN22cLXx3MPWjpq7VeSBndjFtZB5";
        readonly timestamp: "iL13pKpKAQZ4hm2vECGQ5EmFBqRzEneJrq";
    };
    readonly platform: {
        readonly datapolicy: "i6y4XPg5m9YeeP1Rk2iqJGiZwtWWK8pBoC";
        readonly trustlevel: "iDDiY2y6Juo9vUprbB69utX55pzcpkNKoW";
        readonly disputeresolution: "iJjCHbDoE6r4PqWe2i7SXGuPCn4Fw48Krw";
    };
};
export declare function getCanonicalVdxfDefinitionCount(): number;
export declare function encodeVdxfValue(value: unknown): string;
export declare function decodeVdxfValue(hex: string): unknown;
export declare function buildAgentContentMultimap(profile?: AgentProfileInput, services?: ServiceInput[]): Record<string, string[]>;
export interface CanonicalAgentUpdateParams {
    fullName?: string;
    parent?: string;
    primaryaddresses: string[];
    minimumsignatures?: number;
    vdxfKeys: Record<string, string>;
    fields?: Record<string, unknown>;
}
export interface CanonicalIdentitySnapshot {
    name?: string;
    parent?: string;
    contentmultimap?: Record<string, string[]>;
}
export declare function buildCanonicalAgentUpdate(params: CanonicalAgentUpdateParams): Record<string, unknown>;
export declare function verifyPublishedIdentity(params: {
    identity: CanonicalIdentitySnapshot;
    expectedPayload: Record<string, unknown>;
}): {
    ok: boolean;
    errors: string[];
};
export declare function buildUpdateIdentityPayload(identityName: string, contentmultimap: Record<string, string[]>): Record<string, unknown>;
export declare function buildUpdateIdentityCommand(payload: Record<string, unknown>, chain?: 'verustest' | 'verus'): string;
//# sourceMappingURL=vdxf.d.ts.map