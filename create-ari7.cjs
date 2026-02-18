/**
 * Setup ari7.agentplatform@ from scratch
 * Complete flow: generate keys → create identity → register with VAP → register service
 * 
 * NOTE: VAP backend fix applied — 2-minute retry loop for i-address resolution
 */

const { VAPAgent, generateKeypair } = require('./dist/index.js');
const fs = require('fs');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';
const IDENTITY_NAME = 'ari7';

async function main() {
  console.log('=== Ari7 Setup from Scratch ===\n');
  console.log('Testing VAP backend fix for i-address resolution...\n');

  // Step 1: Generate new keypair
  console.log('[1/4] Generating new keypair...');
  const keys = generateKeypair('verustest');
  console.log('  Address:', keys.address);
  console.log('  Pubkey:', keys.pubkey.substring(0, 20) + '...');
  console.log('  WIF:', keys.wif.substring(0, 10) + '...');

  // Save keys immediately (before anything else)
  if (fs.existsSync(KEYS_FILE)) {
    const backupFile = KEYS_FILE + '.backup.' + Date.now();
    fs.copyFileSync(KEYS_FILE, backupFile);
    console.log('  Backed up existing keys to', backupFile);
  }
  
  const keyData = {
    ...keys,
    network: 'verustest',
    identity: IDENTITY_NAME + '.agentplatform@',
    iAddress: null,
  };
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keyData, null, 2));
  fs.chmodSync(KEYS_FILE, 0o600);
  console.log('  ✅ Keys saved to', KEYS_FILE);

  // Step 2: Create agent and register identity on-chain
  console.log('\n[2/4] Creating identity on VRSCTEST...');
  const agent = new VAPAgent({
    vapUrl: 'https://api.autobb.app',
    wif: keys.wif,
    identityName: keyData.identity,
  });

  const result = await agent.register(IDENTITY_NAME, 'verustest');
  console.log('  ✅ Identity:', result.identity);
  
  if (result.iAddress && result.iAddress !== 'pending-lookup') {
    console.log('  ✅ I-Address:', result.iAddress);
    console.log('  🎉 VAP backend fix working!');
  } else {
    console.log('  ⚠️  I-Address:', result.iAddress);
    console.log('  Backend may still need restart or more time');
  }

  keyData.iAddress = result.iAddress;
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keyData, null, 2));

  // Step 3: Register with VAP platform
  console.log('\n[3/4] Registering with VAP platform...');
  const vapResult = await agent.registerWithVAP({
    name: 'Ari7 Verus Wiki Expert',
    type: 'autonomous',
    description: 'Autonomous AI agent specializing in Verus Protocol documentation, identity systems, and developer support.',
    category: 'documentation'
  });
  console.log('  ✅ Agent ID:', vapResult.agentId);

  // Step 4: Register service
  console.log('\n[4/4] Registering service...');
  const svcResult = await agent.registerService({
    name: 'Verus Wiki Q&A',
    description: 'Answer questions about Verus Protocol using official documentation',
    category: 'documentation',
    price: 0.5,
    currency: 'VRSC',
    turnaround: '5 minutes'
  });
  console.log('  ✅ Service ID:', svcResult.serviceId);

  console.log('\n=== Setup Complete ===');
  console.log('Identity:', keyData.identity);
  console.log('I-Address:', keyData.iAddress);
  console.log('Address:', keyData.address);
  
  console.log('\nUpdate vap-agent-overseer config:');
  console.log('  vapIdentity: \'' + keyData.identity + '\',');
  console.log('  vapIAddress: \'' + keyData.iAddress + '\',');
  console.log('  vapKeysFile: \'' + KEYS_FILE + '\',');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
