"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeOnboarding = finalizeOnboarding;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
function nowIso() {
    return new Date().toISOString();
}
function readState(statePath, mode, identity, iAddress) {
    if (fs_1.default.existsSync(statePath)) {
        return JSON.parse(fs_1.default.readFileSync(statePath, 'utf8'));
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
function writeState(statePath, state) {
    fs_1.default.mkdirSync(path_1.default.dirname(statePath), { recursive: true });
    state.updatedAt = nowIso();
    fs_1.default.writeFileSync(statePath, JSON.stringify(state, null, 2));
}
async function defaultPrompt(question, defaultValue) {
    const rl = readline_1.default.createInterface({ input: process.stdin, output: process.stdout });
    const q = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    const answer = await new Promise((resolve) => rl.question(q, resolve));
    rl.close();
    return answer.trim() || (defaultValue || '');
}
async function resolveProfile(mode, profile, hooks) {
    if (profile)
        return profile;
    if (mode !== 'interactive')
        return undefined;
    const prompt = hooks?.prompt || defaultPrompt;
    const name = await prompt('Agent display name');
    const type = (await prompt('Agent type (autonomous|assisted|hybrid|tool)', 'autonomous'));
    const description = await prompt('Agent description');
    const category = await prompt('Category (optional)', 'general');
    if (!name || !description) {
        throw new Error('Interactive finalize requires name and description');
    }
    return { name, type, description, category };
}
async function resolveServices(mode, services, hooks) {
    if (services && services.length)
        return services;
    if (mode !== 'interactive')
        return [];
    const prompt = hooks?.prompt || defaultPrompt;
    const add = (await prompt('Add a service now? (y/N)', 'N')).toLowerCase();
    if (add !== 'y' && add !== 'yes')
        return [];
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
async function finalizeOnboarding(params) {
    const mode = params.mode || 'headless';
    const state = readState(params.statePath, mode, params.agent.identity, params.agent.address);
    const mark = (stage, note) => {
        state.stage = stage;
        if (note)
            state.notes = [...(state.notes || []), `${nowIso()} ${note}`];
        writeState(params.statePath, state);
    };
    // 1) VDXF publish
    if (['onboarded'].includes(state.stage)) {
        if (params.hooks?.publishVdxf) {
            await params.hooks.publishVdxf();
            mark('vdxf_published', 'VDXF definitions published');
        }
        else {
            mark('vdxf_published', 'VDXF publish hook not provided (deferred)');
        }
    }
    // 2) VDXF verify
    if (['vdxf_published'].includes(state.stage)) {
        if (params.hooks?.verifyVdxf) {
            await params.hooks.verifyVdxf();
            mark('vdxf_verified', 'VDXF definitions verified');
        }
        else {
            mark('vdxf_verified', 'VDXF verify hook not provided (deferred)');
        }
    }
    // 3) Index sync
    if (['vdxf_verified'].includes(state.stage)) {
        if (params.hooks?.waitForIndexed) {
            await params.hooks.waitForIndexed();
            mark('indexed', 'Index visibility confirmed');
        }
        else {
            mark('indexed', 'Index wait hook not provided (deferred)');
        }
    }
    // 4) Platform profile registration
    if (['indexed'].includes(state.stage)) {
        const profile = await resolveProfile(mode, params.profile, params.hooks);
        if (profile) {
            await params.agent.registerWithVAP(profile);
            mark('profile_registered', 'Agent profile registered');
        }
        else {
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
//# sourceMappingURL=finalize.js.map