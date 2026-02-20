import fs from 'fs';
import path from 'path';
import readline from 'readline';
import type { VAPAgent } from '../agent.js';

export type FinalizeMode = 'headless' | 'interactive';

export type FinalizeStage =
  | 'onboarded'
  | 'vdxf_published'
  | 'vdxf_verified'
  | 'indexed'
  | 'profile_registered'
  | 'services_registered'
  | 'ready';

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

function nowIso(): string {
  return new Date().toISOString();
}

function readState(statePath: string, mode: FinalizeMode, identity?: string | null, iAddress?: string | null): FinalizeState {
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, 'utf8')) as FinalizeState;
  }

  return {
    mode,
    stage: 'onboarded',
    identity: identity || null,
    iAddress: iAddress || null,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    notes: [],
  };
}

function writeState(statePath: string, state: FinalizeState): void {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  state.updatedAt = nowIso();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

async function defaultPrompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  const answer = await new Promise<string>((resolve) => rl.question(q, resolve));
  rl.close();
  return answer.trim() || (defaultValue || '');
}

async function resolveProfile(mode: FinalizeMode, profile: AgentProfileInput | undefined, hooks?: FinalizeHooks): Promise<AgentProfileInput | undefined> {
  if (profile) return profile;
  if (mode !== 'interactive') return undefined;

  const prompt = hooks?.prompt || defaultPrompt;
  const name = await prompt('Agent display name');
  const type = (await prompt('Agent type (autonomous|assisted|hybrid|tool)', 'autonomous')) as AgentProfileInput['type'];
  const description = await prompt('Agent description');
  const category = await prompt('Category (optional)', 'general');

  if (!name || !description) {
    throw new Error('Interactive finalize requires name and description');
  }

  return { name, type, description, category };
}

async function resolveServices(mode: FinalizeMode, services: ServiceInput[] | undefined, hooks?: FinalizeHooks): Promise<ServiceInput[]> {
  if (services && services.length) return services;
  if (mode !== 'interactive') return [];

  const prompt = hooks?.prompt || defaultPrompt;
  const add = (await prompt('Add a service now? (y/N)', 'N')).toLowerCase();
  if (add !== 'y' && add !== 'yes') return [];

  const name = await prompt('Service name');
  const description = await prompt('Service description', '');
  const category = await prompt('Service category', 'general');
  const priceRaw = await prompt('Price', '0');
  const currency = await prompt('Currency', 'VRSCTEST');
  const turnaround = await prompt('Turnaround', 'TBD');

  return [{
    name,
    description,
    category,
    price: Number(priceRaw) || 0,
    currency,
    turnaround,
  }];
}

export async function finalizeOnboarding(params: FinalizeOnboardingParams): Promise<FinalizeState> {
  const mode: FinalizeMode = params.mode || 'headless';
  const state = readState(params.statePath, mode, params.agent.identity, params.agent.address);

  const mark = (stage: FinalizeStage, note?: string) => {
    state.stage = stage;
    if (note) state.notes = [...(state.notes || []), `${nowIso()} ${note}`];
    writeState(params.statePath, state);
  };

  // 1) VDXF publish
  if (['onboarded'].includes(state.stage)) {
    if (params.hooks?.publishVdxf) {
      await params.hooks.publishVdxf();
      mark('vdxf_published', 'VDXF definitions published');
    } else {
      mark('vdxf_published', 'VDXF publish hook not provided (deferred)');
    }
  }

  // 2) VDXF verify
  if (['vdxf_published'].includes(state.stage)) {
    if (params.hooks?.verifyVdxf) {
      await params.hooks.verifyVdxf();
      mark('vdxf_verified', 'VDXF definitions verified');
    } else {
      mark('vdxf_verified', 'VDXF verify hook not provided (deferred)');
    }
  }

  // 3) Index sync
  if (['vdxf_verified'].includes(state.stage)) {
    if (params.hooks?.waitForIndexed) {
      await params.hooks.waitForIndexed();
      mark('indexed', 'Index visibility confirmed');
    } else {
      mark('indexed', 'Index wait hook not provided (deferred)');
    }
  }

  // 4) Platform profile registration
  if (['indexed'].includes(state.stage)) {
    const profile = await resolveProfile(mode, params.profile, params.hooks);
    if (profile) {
      await params.agent.registerWithVAP(profile);
      mark('profile_registered', 'Agent profile registered');
    } else {
      mark('profile_registered', 'Profile registration skipped');
    }
  }

  // 5) Service registration (optional by design)
  if (['profile_registered'].includes(state.stage)) {
    const services = await resolveServices(mode, params.services, params.hooks);
    for (const svc of services) {
      await params.agent.registerService(svc);
    }
    mark('services_registered', services.length ? `Registered ${services.length} service(s)` : 'No services registered');
  }

  if (state.stage === 'services_registered') {
    state.completedAt = nowIso();
    mark('ready', 'Finalize complete');
  }

  return state;
}
