/**
 * Test different signature formats for ari9 registration
 */

const { signChallenge } = require('./dist/index.js');
const fs = require('fs');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';
const VAP_URL = 'https://api.autobb.app';

async function main() {
  console.log('=== Test Registration Signature Formats ===\n');
  
  const keyData = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  
  const payload = {
    verusId: keyData.identity,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: 'test-nonce-123',
    action: 'register',
    data: {
      name: 'Ari9 Test',
      type: 'autonomous',
      description: 'Test',
      category: 'documentation'
    },
  };
  
  // Format 1: RFC 8785 canonicalization (current SDK approach)
  console.log('[1/3] Testing RFC 8785 canonicalization...');
  const { canonicalize } = require('json-canonicalize');
  const msg1 = canonicalize(payload);
  console.log('Message:', msg1);
  const sig1 = signChallenge(keyData.wif, msg1, keyData.iAddress, 'verustest');
  
  const res1 = await fetch(`${VAP_URL}/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, nonce: 'test-nonce-123', signature: sig1 }),
  });
  console.log('Result:', res1.status, res1.statusText);
  
  // Format 2: Standard JSON.stringify (no canonicalization)
  console.log('\n[2/3] Testing standard JSON.stringify...');
  const msg2 = JSON.stringify(payload);
  console.log('Message:', msg2);
  const sig2 = signChallenge(keyData.wif, msg2, keyData.iAddress, 'verustest');
  
  const res2 = await fetch(`${VAP_URL}/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, nonce: 'test-nonce-124', signature: sig2 }),
  });
  console.log('Result:', res2.status, res2.statusText);
  
  // Format 3: Sorted keys (deterministic but not RFC 8785)
  console.log('\n[3/3] Testing sorted keys...');
  const msg3 = JSON.stringify(payload, Object.keys(payload).sort());
  console.log('Message:', msg3);
  const sig3 = signChallenge(keyData.wif, msg3, keyData.iAddress, 'verustest');
  
  const res3 = await fetch(`${VAP_URL}/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, nonce: 'test-nonce-125', signature: sig3 }),
  });
  console.log('Result:', res3.status, res3.statusText);
  
  console.log('\n=== Summary ===');
  console.log('Format 1 (RFC 8785):', res1.status === 200 ? '✅ Works' : '❌ Failed');
  console.log('Format 2 (JSON.stringify):', res2.status === 200 ? '✅ Works' : '❌ Failed');
  console.log('Format 3 (sorted keys):', res3.status === 200 ? '✅ Works' : '❌ Failed');
}

main().catch(console.error);
