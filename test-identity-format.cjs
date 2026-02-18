/**
 * Test which identity format works for signing
 */

const { signChallenge } = require('./dist/index.js');
const fs = require('fs');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';
const VAP_URL = 'https://api.autobb.app';

async function main() {
  console.log('=== Test Identity Format for Signing ===\n');
  
  const keyData = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  console.log('Identity:', keyData.identity);
  console.log('I-Address:', keyData.iAddress);
  
  const payload = {
    verusId: keyData.identity,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: 'test-' + Date.now(),
    action: 'register',
    data: {
      name: 'Ari9 Test',
      type: 'autonomous',
      description: 'Test agent',
      category: 'documentation'
    },
  };
  
  const { canonicalize } = require('json-canonicalize');
  const message = canonicalize(payload);
  console.log('Message:', message);
  
  // Test 1: Sign with identity NAME
  console.log('\n[1/2] Testing with identity NAME...');
  const sig1 = signChallenge(keyData.wif, message, keyData.identity, 'verustest');
  console.log('Signature:', sig1.substring(0, 50) + '...');
  
  const res1 = await fetch(`${VAP_URL}/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, signature: sig1 }),
  });
  const data1 = await res1.json();
  console.log('Result:', res1.status, data1.error?.message || data1.message || 'OK');
  
  // Test 2: Sign with I-ADDRESS
  console.log('\n[2/2] Testing with I-ADDRESS...');
  const sig2 = signChallenge(keyData.wif, message, keyData.iAddress, 'verustest');
  console.log('Signature:', sig2.substring(0, 50) + '...');
  
  const res2 = await fetch(`${VAP_URL}/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, nonce: payload.nonce + '-2', signature: sig2 }),
  });
  const data2 = await res2.json();
  console.log('Result:', res2.status, data2.error?.message || data2.message || 'OK');
  
  console.log('\n=== Summary ===');
  console.log('Identity NAME signing:', res1.status === 200 ? '✅ Works' : '❌ Failed');
  console.log('I-ADDRESS signing:', res2.status === 200 ? '✅ Works' : '❌ Failed');
  
  if (res1.status !== 200 && res2.status !== 200) {
    console.log('\nBoth failed. Possible causes:');
    console.log('- VAP expects different message format');
    console.log('- CIdentitySignature format mismatch');
    console.log('- Backend verifymessage parameters wrong');
  }
}

main().catch(console.error);
