/**
 * Complete ari3 setup — register identity + VAP + services in one flow
 */

const { VAPAgent } = require('./dist/index.js');
const fs = require('fs');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';

async function main() {
  const keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  
  const agent = new VAPAgent({
    vapUrl: 'https://api.autobb.app',
    wif: keys.wif,
    identityName: 'ari3.agentplatform@',
    iAddress: keys.iAddress !== 'pending-lookup' ? keys.iAddress : undefined
  });

  console.log('=== Ari3 Setup ===\n');

  // Step 1: Ensure identity exists on-chain
  if (!keys.identity || keys.iAddress === 'pending-lookup') {
    console.log('[1/3] Creating identity on-chain...');
    const result = await agent.register('ari3', 'verustest');
    console.log('✅ Identity:', result.identity);
    console.log('✅ I-Address:', result.iAddress);
    
    // Save to keys file
    keys.identity = result.identity;
    keys.iAddress = result.iAddress;
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
  } else {
    console.log('[1/3] Identity exists:', keys.identity);
  }

  // Step 2: Register with VAP platform
  console.log('\n[2/3] Registering with VAP platform...');
  try {
    const vapResult = await agent.registerWithVAP({
      name: 'Ari3 Documentation Assistant',
      type: 'assisted',
      description: 'AI assistant for Verus documentation and support',
      category: 'documentation'
    });
    console.log('✅ VAP Registration:', vapResult.agentId);
  } catch (err) {
    if (err.message.includes('already registered') || err.message.includes('409')) {
      console.log('✅ Already registered with VAP');
    } else {
      throw err;
    }
  }

  // Step 3: Register service
  console.log('\n[3/3] Registering service...');
  try {
    const svcResult = await agent.registerService({
      name: 'Verus Wiki Q&A',
      description: 'Answer questions about Verus Protocol using official documentation',
      category: 'documentation',
      price: 0.5,
      currency: 'VRSC',
      turnaround: '5 minutes'
    });
    console.log('✅ Service:', svcResult.serviceId);
  } catch (err) {
    if (err.message.includes('already') || err.message.includes('409')) {
      console.log('✅ Service already registered');
    } else {
      throw err;
    }
  }

  console.log('\n=== Setup Complete ===');
  console.log('Identity:', keys.identity);
  console.log('I-Address:', keys.iAddress);
  console.log('\nYou can now update the dispatcher config:');
  console.log('  vapIdentity: \'' + keys.identity + '\',');
  console.log('  vapIAddress: \'' + keys.iAddress + '\',');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
