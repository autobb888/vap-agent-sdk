#!/usr/bin/env node

const readline = require('readline');
const { VAPAgent } = require('../dist/index.js');
const { generateKeypair } = require('../dist/identity/keypair.js');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

const KEYS_FILE = path.join(process.cwd(), '.vap-keys.json');

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Verus Agent Platform — Agent CLI     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // Check for existing keys
  let savedKeys = null;
  if (fs.existsSync(KEYS_FILE)) {
    try {
      savedKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      console.log(`  Found existing keys: ${savedKeys.address}`);
      if (savedKeys.identity) console.log(`  Identity: ${savedKeys.identity}`);
      console.log('');
    } catch { /* ignore */ }
  }

  const apiUrl = process.env.VAP_API_URL || 'https://api.autobb.app';
  console.log(`  API: ${apiUrl}`);
  console.log('');

  // Menu
  console.log('  What would you like to do?');
  console.log('');
  console.log('  1) Generate new keypair');
  console.log('  2) Register an agent identity');
  console.log('  3) Show my keys');
  if (savedKeys) {
    console.log('  4) Check registration status');
  }
  console.log('  q) Quit');
  console.log('');

  const choice = await ask('  > ');

  switch (choice.trim()) {
    case '1':
      await generateKeys();
      break;
    case '2':
      await registerAgent(apiUrl, savedKeys);
      break;
    case '3':
      showKeys(savedKeys);
      break;
    case '4':
      if (savedKeys) await checkStatus(apiUrl, savedKeys);
      else console.log('\n  No keys found. Generate keys first (option 1).\n');
      break;
    case 'q':
    case 'Q':
      break;
    default:
      console.log('\n  Invalid choice.\n');
  }

  rl.close();
}

async function generateKeys() {
  console.log('');
  const network = await ask('  Network (verustest/verus) [verustest]: ');
  const net = network.trim() || 'verustest';

  const keys = generateKeypair(net);
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║   🔑 NEW KEYPAIR GENERATED            ║');
  console.log('  ╠═══════════════════════════════════════╣');
  console.log(`  ║  Address: ${keys.address}`);
  console.log(`  ║  Pubkey:  ${keys.pubkey}`);
  console.log(`  ║  WIF:     ${keys.wif}`);
  console.log('  ╠═══════════════════════════════════════╣');
  console.log('  ║  ⚠️  SAVE YOUR WIF KEY!               ║');
  console.log('  ║  It cannot be recovered if lost.      ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('');

  const save = await ask('  Save keys locally? (y/n) [y]: ');
  if (save.trim().toLowerCase() !== 'n') {
    fs.writeFileSync(KEYS_FILE, JSON.stringify({ ...keys, network: net }, null, 2));
    fs.chmodSync(KEYS_FILE, 0o600);
    console.log(`  ✓ Keys saved to ${KEYS_FILE} (chmod 600)`);
    console.log('');
  }
}

async function registerAgent(apiUrl, savedKeys) {
  console.log('');

  let keys = savedKeys;
  if (!keys || !keys.wif) {
    console.log('  No keys found. Generating new keypair...');
    const network = await ask('  Network (verustest/verus) [verustest]: ');
    const net = network.trim() || 'verustest';
    keys = generateKeypair(net);
    keys.network = net;

    console.log(`  Address: ${keys.address}`);
    console.log(`  WIF:     ${keys.wif}`);
    console.log(`  Pubkey:  ${keys.pubkey}`);
    console.log('');

    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
    fs.chmodSync(KEYS_FILE, 0o600);
    console.log(`  ✓ Keys saved to ${KEYS_FILE}`);
    console.log('');
  }

  const name = await ask('  Agent name (lowercase, no spaces): ');
  const trimmed = name.trim().toLowerCase();

  if (!trimmed) {
    console.log('  ❌ Name is required.\n');
    return;
  }

  if (!/^[a-z0-9_-]{1,64}$/.test(trimmed)) {
    console.log('  ❌ Name must be 1-64 chars: lowercase letters, numbers, hyphens, underscores.\n');
    return;
  }

  console.log('');
  console.log(`  Registering ${trimmed}.agentplatform@...`);
  console.log('  This may take several minutes (waiting for block confirmation).');
  console.log('');

  const agent = new VAPAgent({ vapUrl: apiUrl, wif: keys.wif });
  agent.generateKeys(keys.network || 'verustest');

  try {
    const result = await agent.register(trimmed, keys.network || 'verustest');
    console.log('');
    console.log('  ╔═══════════════════════════════════════╗');
    console.log('  ║   ✅ AGENT REGISTERED!                ║');
    console.log('  ╠═══════════════════════════════════════╣');
    console.log(`  ║  Identity: ${trimmed}.agentplatform@`);
    if (result.iAddress) console.log(`  ║  i-Address: ${result.iAddress}`);
    console.log('  ╚═══════════════════════════════════════╝');
    console.log('');

    // Update saved keys with identity
    keys.identity = `${trimmed}.agentplatform@`;
    if (result.iAddress) keys.iAddress = result.iAddress;
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
  } catch (e) {
    console.error(`  ❌ ${e.message}`);
    console.log('');
  }
}

function showKeys(savedKeys) {
  console.log('');
  if (!savedKeys) {
    console.log('  No keys found. Generate keys first (option 1).\n');
    return;
  }
  console.log(`  Address:  ${savedKeys.address}`);
  console.log(`  Pubkey:   ${savedKeys.pubkey}`);
  console.log(`  WIF:      ${savedKeys.wif}`);
  console.log(`  Network:  ${savedKeys.network || 'verustest'}`);
  if (savedKeys.identity) console.log(`  Identity: ${savedKeys.identity}`);
  if (savedKeys.iAddress) console.log(`  i-Address: ${savedKeys.iAddress}`);
  console.log('');
}

async function checkStatus(apiUrl, savedKeys) {
  console.log('');
  if (!savedKeys || !savedKeys.identity) {
    console.log('  No registered identity found.\n');
    return;
  }
  console.log(`  Identity: ${savedKeys.identity}`);
  console.log(`  Address:  ${savedKeys.address}`);
  console.log(`  Network:  ${savedKeys.network || 'verustest'}`);
  console.log('');
}

main().catch(e => {
  console.error('Error:', e.message);
  rl.close();
  process.exit(1);
});
