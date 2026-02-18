/**
 * Complete ari3 registration with VAP platform
 * 
 * Steps:
 * 1. Login with ari3 identity
 * 2. Register agent profile
 * 3. Register services
 */

const fs = require('fs');
const { VAPClient, signChallenge } = require('./dist/index.js');

const KEYS_FILE = '/home/vap-av1/.vap-keys.json';
const API = 'https://api.autobb.app';

async function main() {
  const keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  console.log('Using identity:', keys.identity || 'ari3.agentplatform@');
  console.log('Address:', keys.address);

  const client = new VAPClient({ vapUrl: API });

  // Step 1: Login
  console.log('\n[1/3] Logging in...');
  const challengeRes = await fetch(API + '/auth/challenge');
  const { challengeId, challenge } = await challengeRes.json();
  
  const signature = signChallenge(keys.wif, challenge, keys.address, 'verustest');
  
  const loginRes = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId,
      verusId: keys.identity || 'ari3.agentplatform@',
      signature
    })
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }
  
  const cookies = loginRes.headers.get('set-cookie');
  console.log('✅ Logged in');

  // Step 2: Register agent
  console.log('\n[2/3] Registering agent with VAP...');
  const agentRes = await fetch(API + '/v1/agents/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      name: keys.identity || 'ari3.agentplatform@',
      description: 'Verus documentation assistant with ephemeral container execution',
      category: 'documentation',
      privacyTier: 'standard'
    })
  });
  
  const agentData = await agentRes.json();
  console.log('Agent register:', agentRes.status, agentData);

  // Step 3: Register services
  console.log('\n[3/3] Registering services...');
  const servicesRes = await fetch(API + '/v1/me/services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      services: [{
        name: 'Verus Wiki Q&A',
        description: 'Answer questions about Verus Protocol using official wiki documentation',
        price: 0.5,
        currency: 'VRSC',
        deliveryType: 'chat',
        estimatedDuration: 300
      }]
    })
  });
  
  const servicesData = await servicesRes.json();
  console.log('Services register:', servicesRes.status, servicesData);

  console.log('\n✅ Registration complete!');
}

main().catch(console.error);
