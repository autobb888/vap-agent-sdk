/**
 * Setup ari8.agentplatform@ from scratch
 * Tests FULL flow: identity reg + VAP registration (with SDK fix for long challenges)
 */

const { VAPAgent, generateKeypair } = require('./dist/index.js');
const fs = require('fs');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';
const IDENTITY_NAME = 'ari8';

async function main() {
  console.log('=== Ari8 Setup from Scratch ===\n');
  console.log('Testing FULL flow with SDK fix for "Challenge too long" bug...\n');

  // Step 1: Generate new keypair
  console.log('[1/4] Generating new keypair...');
  const keys = generateKeypair('verustest');
  console.log('  Address:', keys.address);
  console.log('  Pubkey:', keys.pubkey.substring(0, 20) + '...');
  console.log('  WIF:', keys.wif.substring(0, 10) + '...');

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

  // Step 2: Register identity on-chain
  console.log('\n[2/4] Creating identity on VRSCTEST...');
  const agent = new VAPAgent({
    vapUrl: 'https://api.autobb.app',
    wif: keys.wif,
    identityName: keyData.identity,
  });

  const result = await agent.register(IDENTITY_NAME, 'verustest');
  console.log('  ✅ Identity:', result.identity);
  console.log('  ✅ I-Address:', result.iAddress);

  if (result.iAddress && result.iAddress !== 'pending-lookup') {
    console.log('  🎉 VAP backend i-address fix working!');
  }

  keyData.iAddress = result.iAddress;
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keyData, null, 2));

  // Step 3: Register with VAP platform (now with fixed signing!)
  console.log('\n[3/4] Registering with VAP platform...');
  try {
    const vapResult = await agent.registerWithVAP({
      name: 'Ari8 Verus Wiki Expert',
      type: 'autonomous',
      description: 'Autonomous AI agent specializing in Verus Protocol documentation',
      category: 'documentation'
    });
    console.log('  ✅ Agent ID:', vapResult.agentId);
    console.log('  🎉 SDK signing fix working!');

    // Step 4: Register service
    console.log('\n[4/4] Registering service...');
    const svcResult = await agent.registerService({
      name: 'Verus Wiki Q&A',
      description: 'Answer questions about Verus Protocol',
      category: 'documentation',
      price: 0.5,
      currency: 'VRSC',
      turnaround: '5 minutes'
    });
    console.log('  ✅ Service ID:', svcResult.serviceId);
    
    console.log('\n=== 🎉 FULL SUCCESS! ===');
    
  } catch (err) {
    if (err.message.includes('Challenge too long')) {
      console.log('  ❌ Still getting "Challenge too long" — SDK fix not applied correctly');
      console.log('  Try rebuilding SDK: cd ~/vap-agent-sdk && yarn build');
    } else {
      throw err;
    }
    console.log('\n=== Partial Success ===');
    console.log('✅ Identity registered:', keyData.identity);
    console.log('❌ VAP registration failed');
  }

  console.log('\nIdentity:', keyData.identity);
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
