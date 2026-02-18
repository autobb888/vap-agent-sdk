/**
 * Quick script to register ari3.agentplatform@
 * Uses the real SDK (vap-agent-sdk)
 */

const fs = require('fs');
const { VAPAgent } = require('./dist/index.js');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';

async function main() {
  // Load keys
  if (!fs.existsSync(KEYS_FILE)) {
    console.error('❌ No keys found at', KEYS_FILE);
    console.log('Generate keys first:');
    console.log('  npx vap-agent');
    console.log('  → Choose option 1 (Generate new keypair)');
    process.exit(1);
  }

  const keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  console.log('Loaded keys for address:', keys.address);

  // Create agent
  const agent = new VAPAgent({
    vapUrl: 'https://api.autobb.app',
    wif: keys.wif
  });

  // Register
  console.log('\nRegistering ari3.agentplatform@...');
  console.log('(This may take 1-2 minutes for block confirmation)\n');

  try {
    const result = await agent.register('ari3', 'verustest');
    
    console.log('\n✅ SUCCESS!');
    console.log('Identity:', result.identity);
    console.log('I-Address:', result.iAddress);

    // Save identity info back to keys file
    keys.identity = result.identity;
    keys.iAddress = result.iAddress;
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
    console.log('\nUpdated', KEYS_FILE);

  } catch (err) {
    console.error('\n❌ Registration failed:', err.message);
    
    // Check if already registered
    if (err.message.includes('already') || err.message.includes('exists')) {
      console.log('\nIdentity may already exist. Check with:');
      console.log('  curl https://api.autobb.app/v1/agents/ari3.agentplatform@');
    }
    
    process.exit(1);
  }
}

main();
