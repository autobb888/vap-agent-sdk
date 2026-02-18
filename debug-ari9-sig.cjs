/**
 * Debug ari9 VAP registration signature issue
 */

const { signChallenge } = require('./dist/index.js');
const fs = require('fs');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';
const VAP_URL = 'https://api.autobb.app';

async function main() {
  console.log('=== Debug Ari9 Signature ===\n');
  
  const keyData = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  console.log('Identity:', keyData.identity);
  console.log('I-Address:', keyData.iAddress);
  
  // Test 1: Login (this worked)
  console.log('\n[1/3] Testing login signature...');
  const challengeRes = await fetch(`${VAP_URL}/auth/challenge`);
  const challengeData = await challengeRes.json();
  console.log('Challenge length:', challengeData.data.challenge.length);
  
  const loginSig = signChallenge(keyData.wif, challengeData.data.challenge, keyData.iAddress, 'verustest');
  console.log('Login sig length:', loginSig.length);
  
  const loginRes = await fetch(`${VAP_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: challengeData.data.challengeId,
      verusId: keyData.identity,
      signature: loginSig,
    }),
  });
  console.log('Login result:', loginRes.status, loginRes.statusText);
  
  // Test 2: Registration payload signing
  console.log('\n[2/3] Testing registration signature...');
  const { randomUUID } = require('crypto');
  const { canonicalize } = require('json-canonicalize');
  
  const payload = {
    verusId: keyData.identity,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: randomUUID(),
    action: 'register',
    data: {
      name: 'Ari9 Verus Wiki Expert',
      type: 'autonomous',
      description: 'Test agent',
      category: 'documentation'
    },
  };
  
  const message = canonicalize(payload);
  console.log('Canonicalized message:', message.substring(0, 100) + '...');
  console.log('Message length:', message.length);
  
  const regSig = signChallenge(keyData.wif, message, keyData.iAddress, 'verustest');
  console.log('Registration sig length:', regSig.length);
  
  // Test 3: Try registration
  console.log('\n[3/3] Attempting registration...');
  const regRes = await fetch(`${VAP_URL}/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, signature: regSig }),
  });
  
  const regData = await regRes.json();
  console.log('Registration result:', regRes.status, regRes.statusText);
  console.log('Response:', JSON.stringify(regData, null, 2));
  
  if (!regRes.ok) {
    console.log('\n❌ Registration failed');
    console.log('Possible causes:');
    console.log('1. VAP expects different canonicalization');
    console.log('2. VAP expects different identity address format');
    console.log('3. VAP backend signature verification bug');
  } else {
    console.log('\n✅ Registration succeeded!');
  }
}

main().catch(console.error);
