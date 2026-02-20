import type { AgentProfileInput, ServiceInput } from './finalize.js';

export const VDXF_KEYS = {
  agent: {
    version: 'iBShCc1dESnTq25WkxzrKGjHvHwZFSoq6b',
    type: 'i9YN6ovGcotCnFdNyUtNh72Nw11WcBuD8y',
    name: 'i3oa8uNjgZjmC1RS8rg1od8czBP8bsh5A8',
    description: 'i9Ww2jR4sFt7nzdc5vRy5MHUCjTWULXCqH',
    status: 'iNCvffXEYWNBt1K5izxKFSFKBR5LPAAfxW',
    capabilities: 'i7Aumh6Akeq7SC8VJBzpmJrqKNCvREAWMA',
    endpoints: 'i9n5Vu8fjXLP5CxzcdpwHbSzaW22dJxvHc',
    protocols: 'iFQzXU4V6am1M9q6LGBfR4uyNAtjhJiW2d',
    owner: 'i5uUotnF2LzPci3mkz9QaozBtFjeFtAw45',
    services: 'iGVUNBQSNeGzdwjA4km5z6R9h7T2jao9Lz',
  },
  service: {
    name: 'iNTrSV1bqDAoaGRcpR51BeoS5wQvQ4P9Qj',
    description: 'i7ZUWAqwLu9b4E8oXZq4uX6X5W6BJnkuHz',
    price: 'iLjLxTk1bkEd7SAAWT27VQ7ECFuLtTnuKv',
    currency: 'iANfkUFM797eunQt4nFV3j7SvK8pUkfsJe',
    category: 'iGiUqVQcdLC3UAj8mHtSyWNsAKdEVXUFVC',
    turnaround: 'iNGq3xh28oV2U3VmMtQ3gjMX8jrH1ohKfp',
    status: 'iNbPugdyVSCv54zsZs68vAfvifcf14btX2',
  },
  review: {
    buyer: 'iPbx6NP7ZVLySKJU5Rfbt3saxNLaxHHV85',
    jobHash: 'iFgEMF3Fbj1EFU7bAPjmrvMKUU9QfZumNP',
    message: 'iKokqh2YmULa4HkSWRRJaywNMvGzRv7JTt',
    rating: 'iDznRwvMsTaMmQ6zkfQTJKWb5YCh8RHyp5',
    signature: 'iJZHVjWN22cLXx3MPWjpq7VeSBndjFtZB5',
    timestamp: 'iL13pKpKAQZ4hm2vECGQ5EmFBqRzEneJrq',
  },
  platform: {
    datapolicy: 'i6y4XPg5m9YeeP1Rk2iqJGiZwtWWK8pBoC',
    trustlevel: 'iDDiY2y6Juo9vUprbB69utX55pzcpkNKoW',
    disputeresolution: 'iJjCHbDoE6r4PqWe2i7SXGuPCn4Fw48Krw',
  },
} as const;

export function getCanonicalVdxfDefinitionCount(): number {
  return Object.values(VDXF_KEYS).reduce((n, group) => n + Object.keys(group).length, 0);
}

function encodeVdxfValue(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('hex');
}

export function buildAgentContentMultimap(profile?: AgentProfileInput, services: ServiceInput[] = []): Record<string, string[]> {
  const contentmultimap: Record<string, string[]> = {};

  if (profile) {
    contentmultimap[VDXF_KEYS.agent.version] = [encodeVdxfValue('1')];
    contentmultimap[VDXF_KEYS.agent.type] = [encodeVdxfValue(profile.type)];
    contentmultimap[VDXF_KEYS.agent.name] = [encodeVdxfValue(profile.name)];
    contentmultimap[VDXF_KEYS.agent.description] = [encodeVdxfValue(profile.description)];
    contentmultimap[VDXF_KEYS.agent.status] = [encodeVdxfValue('active')];
  }

  if (services.length > 0) {
    contentmultimap[VDXF_KEYS.agent.services] = services.map((svc) =>
      encodeVdxfValue({
        name: svc.name,
        description: svc.description,
        category: svc.category,
        price: svc.price,
        currency: svc.currency,
        turnaround: svc.turnaround,
        status: 'active',
      })
    );
  }

  return contentmultimap;
}

export function buildUpdateIdentityPayload(identityName: string, contentmultimap: Record<string, string[]>): Record<string, unknown> {
  const clean = identityName.replace(/@$/, '');
  const parts = clean.split('.');
  const name = parts[0] || clean;
  const parent = parts.length > 1 ? parts.slice(1).join('.') : 'agentplatform';

  return {
    name,
    parent,
    contentmultimap,
  };
}

export function buildUpdateIdentityCommand(payload: Record<string, unknown>, chain: 'verustest' | 'verus' = 'verustest'): string {
  const chainArg = chain === 'verustest' ? '-chain=vrsctest' : '-chain=vrsc';
  return `verus ${chainArg} updateidentity '${JSON.stringify(payload)}'`;
}
