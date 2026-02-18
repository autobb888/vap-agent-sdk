/**
 * Standalone ari3 registration script
 * Uses built SDK files directly, no npm install needed
 */

const fs = require('fs');
const path = require('path');

// Load the built SDK
const sdkPath = path.join(__dirname, 'dist', 'index.js');
if (!fs.existsSync(sdkPath)) {
  console.error('❌ SDK not built. Run: npm run build');
  process.exit(1);
}

const { VAPAgent } = require(sdkPath);

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';

async function main() {
  // Load keys
  if (!fs.existsSync(KEYS_FILE)) {
    console.error('❌ No keys found at', KEYS_FILE);
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
    process.exit(1);
  }
}

main();
