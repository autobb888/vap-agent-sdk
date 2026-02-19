/**
 * Setup ari9.agentplatform@ with fixed SDK (identity name signing)
 */

const { VAPAgent, keypairFromWIF } = require('./dist/index.js');
const fs = require('fs');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';

async function main() {
  console.log('=== Ari9 Setup (Fixed SDK) ===\n');
  console.log('Using identity NAME for registration signing...\n');

  const keyData = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  console.log('Using existing keys for:', keyData.identity);
  console.log('I-Address:', keyData.iAddress);

  // Create agent with explicit keypair from WIF
  const agent = new VAPAgent({
    vapUrl: 'https://api.autobb.app',
    wif: keyData.wif,
    identityName: keyData.identity,
    iAddress: keyData.iAddress,
  });
  
  // Ensure keypair is loaded
  const kp = keypairFromWIF(keyData.wif, 'verustest');
  console.log('Keypair loaded:', kp.address);

  // Register with VAP platform
  console.log('\n[1/2] Registering with VAP platform...');
  
  // Manual registration with proper signing
  const { randomUUID } = require('crypto');
  const { canonicalize } = require('json-canonicalize');
  const { signChallenge } = require('./dist/index.js');
  
  const payload = {
    verusId: keyData.identity,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: randomUUID(),
    action: 'register',
    data: {
      name: 'Ari9 Verus Wiki Expert',
      type: 'autonomous',
      description: 'Autonomous AI agent specializing in Verus Protocol documentation',
      category: 'documentation'
    },
  };
  
  const message = canonicalize(payload);
  console.log('Signing with i-address:', keyData.iAddress);
  const signature = signChallenge(keyData.wif, message, keyData.iAddress, 'verustest');
  
  const regRes = await fetch('https://api.autobb.app/v1/agents/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, signature }),
  });
  
  const regData = await regRes.json();
  console.log('Registration result:', regRes.status, regRes.statusText);
  
  if (!regRes.ok) {
    throw new Error(regData.error?.message || 'Registration failed');
  }
  
  console.log('  ✅ Agent ID:', regData.data?.agentId);
  console.log('  🎉 Registration working!');

  // Step 2: Login and register service
  console.log('\n[2/2] Registering service...');
  
  // Login to get session
  const challengeRes = await fetch('https://api.autobb.app/auth/challenge');
  const challengeData = await challengeRes.json();
  const loginSig = signChallenge(keyData.wif, challengeData.data.challenge, keyData.iAddress, 'verustest');
  
  const loginRes = await fetch('https://api.autobb.app/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: challengeData.data.challengeId,
      verusId: keyData.identity,
      signature: loginSig,
    }),
  });
  
  const cookies = loginRes.headers.get('set-cookie');
  
  // Register service
  const svcRes = await fetch('https://api.autobb.app/v1/me/services', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || '',
    },
    body: JSON.stringify({
      name: 'Verus Wiki Q&A',
      description: 'Answer questions about Verus Protocol',
      category: 'documentation',
      price: 0.5,
      currency: 'VRSC',
      turnaround: '5 minutes'
    }),
  });
  
  const svcData = await svcRes.json();
  if (svcRes.ok) {
    console.log('  ✅ Service ID:', svcData.data?.serviceId);
    console.log('\n=== 🎉 FULL SUCCESS! ===');
  } else {
    console.log('  ⚠️ Service registration:', svcData.error?.message);
  }
  
  console.log('\nUpdate vap-agent-overseer config:');
  console.log('  vapIdentity: \'' + keyData.identity + '\',');
  console.log('  vapIAddress: \'' + keyData.iAddress + '\',');
  console.log('  vapKeysFile: \'' + KEYS_FILE + '\',');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
