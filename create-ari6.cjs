/**
 * Setup ari6.agentplatform@ from scratch
 * Complete flow: generate keys → create identity → register with VAP → register service
 * 
 * NOTE: This uses the SDK's built-in polling for i-address. If VAP returns 'pending-lookup',
 * the SDK will wait up to 5 additional minutes for the i-address to resolve.
 */

const { VAPAgent, generateKeypair } = require('./dist/index.js');
const fs = require('fs');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';
const IDENTITY_NAME = 'ari6';

async function main() {
  console.log('=== Ari6 Setup from Scratch ===\n');

  // Step 1: Generate new keypair
  console.log('[1/4] Generating new keypair...');
  const keys = generateKeypair('verustest');
  console.log('  Address:', keys.address);
  console.log('  Pubkey:', keys.pubkey.substring(0, 20) + '...');
  console.log('  WIF:', keys.wif.substring(0, 10) + '...');

  // Save keys immediately (before anything else)
  // Backup existing keys if present
  if (fs.existsSync(KEYS_FILE)) {
    const backupFile = KEYS_FILE + '.backup.' + Date.now();
    fs.copyFileSync(KEYS_FILE, backupFile);
    console.log('  Backed up existing keys to', backupFile);
  }
  
  const keyData = {
    ...keys,
    network: 'verustest',
    identity: IDENTITY_NAME + '.agentplatform@',
    iAddress: null, // Will be filled after registration
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
  
  if (result.iAddress === 'pending-lookup') {
    console.log('  ⚠️  I-Address: pending-lookup (VAP indexer lag)');
    console.log('  The identity is registered but i-address lookup failed.');
    console.log('  You may need to manually look up the i-address later.');
  } else {
    console.log('  ✅ I-Address:', result.iAddress);
  }

  // Update keys file with i-address (or pending-lookup status)
  keyData.iAddress = result.iAddress;
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keyData, null, 2));

  // Step 3: Register with VAP platform
  console.log('\n[3/4] Registering with VAP platform...');
  const vapResult = await agent.registerWithVAP({
    name: 'Ari6 Verus Wiki Expert',
    type: 'autonomous',
    description: 'Autonomous AI agent specializing in Verus Protocol documentation, identity systems, and developer support. Built on the Verus Agent Platform.',
    category: 'documentation'
  });
  console.log('  ✅ Agent ID:', vapResult.agentId);

  // Step 4: Register service
  console.log('\n[4/4] Registering service...');
  const svcResult = await agent.registerService({
    name: 'Verus Wiki Q&A',
    description: 'Answer questions about Verus Protocol using official documentation. Specializes in identity, blockchain, and developer topics.',
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
  
  if (result.iAddress === 'pending-lookup') {
    console.log('\n⚠️  ACTION REQUIRED:');
    console.log('  The i-address is pending. To get it:');
    console.log('  1. Wait 5-10 minutes for VAP indexer');
    console.log('  2. Query: curl https://api.autobb.app/v1/agents/' + keyData.identity);
    console.log('  3. Or check: verus getidentity "' + keyData.identity + '"');
    console.log('  4. Update KEYS_FILE with the real i-address before running dispatcher');
  }
  
  console.log('\nUpdate vap-agent-overseer config:');
  console.log('  vapIdentity: \'' + keyData.identity + '\',');
  console.log('  vapIAddress: \'' + keyData.iAddress + '\',');
  console.log('  vapKeysFile: \'' + KEYS_FILE + '\',');
  
  // TODO: Populate VDXF schema once Cee provides the 28-29 content map definitions
  console.log('\nTODO: Populate VDXF contentmultimap for ' + IDENTITY_NAME + '.agentplatform@');
  console.log('  (Waiting for Cee to provide the 28-29 agentplatform@ schema definitions)');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
