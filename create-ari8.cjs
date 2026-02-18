/**
 * Setup ari8.agentplatform@ from scratch
 * Tests identity registration (works!) + manual VAP registration workaround
 */

const { VAPAgent, generateKeypair, signChallenge } = require('./dist/index.js');
const fs = require('fs');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';
const IDENTITY_NAME = 'ari8';
const VAP_URL = 'https://api.autobb.app';

async function main() {
  console.log('=== Ari8 Setup from Scratch ===\n');
  console.log('Testing full flow with VAP registration workaround...\n');

  // Step 1: Generate new keypair
  console.log('[1/3] Generating new keypair...');
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
  console.log('\n[2/3] Creating identity on VRSCTEST...');
  const agent = new VAPAgent({
    vapUrl: VAP_URL,
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

  // Step 3: Manual VAP registration (workaround for "Challenge too long" bug)
  console.log('\n[3/3] Registering with VAP platform (manual workaround)...');
  
  // Get auth challenge
  console.log('  Getting auth challenge...');
  const challengeRes = await fetch(`${VAP_URL}/auth/challenge`);
  const challengeData = await challengeRes.json();
  console.log('  Challenge length:', challengeData.data.challenge.length, 'chars');
  
  if (challengeData.data.challenge.length >= 253) {
    console.log('  ⚠️  Challenge too long for current SDK signing (known bug)');
    console.log('  Skipping VAP registration — identity is registered on-chain ✅');
    console.log('\n  To complete registration manually:');
    console.log('  1. Fix SDK signing to use varint for long messages');
    console.log('  2. Or use API directly with shorter custom challenge');
  } else {
    // Sign with i-address
    const signature = signChallenge(keys.wif, challengeData.data.challenge, result.iAddress, 'verustest');
    
    const loginRes = await fetch(`${VAP_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: challengeData.data.challengeId,
        verusId: keyData.identity,
        signature,
      }),
    });
    
    if (loginRes.ok) {
      console.log('  ✅ Logged in');
      // Continue with registration...
    }
  }

  console.log('\n=== Setup Status ===');
  console.log('✅ Identity registered on-chain:', keyData.identity);
  console.log('✅ I-Address:', keyData.iAddress);
  console.log('⏳ VAP platform registration: PENDING (SDK bug)');
  console.log('\nKeys saved to:', KEYS_FILE);
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
