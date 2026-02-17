/**
 * Setup ari2.agentplatform@ — auth login + register services
 * 
 * Prerequisites:
 *   - .vap-keys.json exists with { wif, address, pubkey }
 *   - ari2.agentplatform@ is already registered on-chain
 * 
 * Usage: node setup-ari2.cjs
 */
const { signChallenge } = require('./dist/identity/signer.js');
const fs = require('fs');

const keys = JSON.parse(fs.readFileSync('.vap-keys.json', 'utf8'));
const WIF = keys.wif;
const API = 'https://api.autobb.app';
const IDENTITY = 'ari2.agentplatform@';

// You need the i-address of the identity. 
// If you don't have it, check: verus -testnet getidentity "ari2.agentplatform@"
// and look for identity.identityaddress
// For now, try using the R-address from keys (works if identity's primary address matches)
const I_ADDRESS = keys.iAddress || keys.address;

async function setup() {
  // ==========================================
  // Step 1: Get auth challenge
  // ==========================================
  console.log('1. Getting auth challenge...');
  const challengeRes = await fetch(`${API}/auth/challenge`);
  const challengeJson = await challengeRes.json();
  const challengeData = challengeJson.data;
  console.log('   Challenge ID:', challengeData.challengeId);
  console.log('   Expires:', challengeData.expiresAt);

  // ==========================================
  // Step 2: Sign challenge with CIdentitySignature
  // ==========================================
  console.log('2. Signing challenge...');
  console.log('   Identity address:', I_ADDRESS);
  const signature = signChallenge(WIF, challengeData.challenge, I_ADDRESS, 'verustest');
  const sigBuf = Buffer.from(signature, 'base64');
  console.log('   Signature:', signature.substring(0, 40) + '...');
  console.log('   Sig bytes:', sigBuf.length, '| version:', sigBuf[0], '| hashType:', sigBuf[1], '| height:', sigBuf.readUInt32LE(2));
  console.log('   Format: CIdentitySignature (v' + sigBuf[0] + ', hashType=' + sigBuf[1] + ', height=' + sigBuf.readUInt32LE(2) + ')');

  // ==========================================
  // Step 3: Login
  // ==========================================
  console.log('3. Logging in as', IDENTITY, '...');
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: challengeData.challengeId,
      verusId: IDENTITY,
      signature: signature,
    }),
  });

  const loginData = await loginRes.json();
  console.log('   Status:', loginRes.status);
  console.log('   Response:', JSON.stringify(loginData, null, 2));

  if (!loginData.data?.success) {
    console.error('\n❌ Login failed. Check:');
    console.error('   - Is ari2.agentplatform@ registered on VRSCTEST?');
    console.error('   - Does the WIF match the identity\'s primary address?');
    console.error('   - Is the i-address correct?');
    return;
  }

  // Extract session cookie
  const cookies = loginRes.headers.get('set-cookie');
  console.log('   ✅ Logged in!');
  console.log('   Identity:', loginData.data.identityName);

  // ==========================================
  // Step 4: Register as agent (signed payload)
  // ==========================================
  console.log('\n4. Registering as agent...');
  const { randomUUID } = require('crypto');
  const agentData = {
    name: 'Ari2 Research Assistant',
    type: 'assisted',
    description: 'AI research and analysis agent. Can search, summarize, and provide insights on any topic.',
  };

  const regPayload = {
    verusId: IDENTITY,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: randomUUID(),
    action: 'register',
    data: agentData,
  };

  // Sign the canonicalized payload (RFC 8785 JSON Canonicalization)
  const { canonicalize } = require('json-canonicalize');
  const message = canonicalize(regPayload);
  console.log('   Signing payload:', message.substring(0, 60) + '...');
  const regSignature = signChallenge(WIF, message, I_ADDRESS, 'verustest');

  const regRes = await fetch(`${API}/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...regPayload, signature: regSignature }),
  });

  const regData = await regRes.json();
  console.log('   Status:', regRes.status);
  console.log('   Response:', JSON.stringify(regData, null, 2));

  if (regRes.status === 409) {
    console.log('   Agent already registered, continuing...');
  } else if (regRes.status !== 200 && regRes.status !== 201) {
    console.error('\n❌ Agent registration failed.');
    return;
  } else {
    console.log('   ✅ Agent registered!');
  }

  // ==========================================
  // Step 5: Register a service
  // ==========================================
  console.log('\n5. Registering service...');
  
  // Re-login to get fresh cookie (in case it expired)
  const serviceRes = await fetch(`${API}/v1/me/services`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
    body: JSON.stringify({
      name: 'Ari2 Research Assistant',
      description: 'AI research and analysis agent. Can search, summarize, and provide insights on any topic.',
      category: 'research',
      price: 0.5,
      currency: 'VRSC',
      turnaround: '5 minutes',
    }),
  });

  const serviceData = await serviceRes.json();
  console.log('   Status:', serviceRes.status);
  console.log('   Response:', JSON.stringify(serviceData, null, 2));

  if (serviceData.data || serviceRes.status === 200 || serviceRes.status === 201) {
    console.log('\n✅ Done! Agent registered and service listed.');
  } else {
    console.error('\n⚠️  Service registration may have failed. Check response above.');
  }
}

setup().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
