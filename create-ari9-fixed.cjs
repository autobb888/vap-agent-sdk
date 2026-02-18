/**
 * Setup ari9.agentplatform@ with fixed SDK (identity name signing)
 */

const { VAPAgent, generateKeypair } = require('./dist/index.js');
const fs = require('fs');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';
const IDENTITY_NAME = 'ari9';

async function main() {
  console.log('=== Ari9 Setup (Fixed SDK) ===\n');
  console.log('Using identity NAME for registration signing...\n');

  const keyData = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  console.log('Using existing keys for:', keyData.identity);
  console.log('I-Address:', keyData.iAddress);

  const agent = new VAPAgent({
    vapUrl: 'https://api.autobb.app',
    wif: keyData.wif,
    identityName: keyData.identity,
    iAddress: keyData.iAddress,
  });

  // Register with VAP platform (now with correct signing)
  console.log('\n[1/1] Registering with VAP platform...');
  try {
    const vapResult = await agent.registerWithVAP({
      name: 'Ari9 Verus Wiki Expert',
      type: 'autonomous',
      description: 'Autonomous AI agent specializing in Verus Protocol documentation',
      category: 'documentation'
    });
    console.log('  ✅ Agent ID:', vapResult.agentId);
    console.log('  🎉 Registration signing fix working!');

    // Register service
    console.log('\n[2/2] Registering service...');
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
    console.log('  ❌ Error:', err.message);
    throw err;
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
