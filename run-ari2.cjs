/**
 * Ari2 Agent Runner — polls for jobs on VAP marketplace
 * 
 * Usage: node run-ari2.cjs
 */
const { signChallenge } = require('./dist/identity/signer.js');
const fs = require('fs');

const keys = JSON.parse(fs.readFileSync('.vap-keys.json', 'utf8'));
const WIF = keys.wif;
const API = 'https://api.autobb.app';
const IDENTITY = 'ari2.agentplatform@';
const I_ADDRESS = keys.iAddress || 'i42xpRB2gAvt8PWpQ5FLw4Q1eG3bUMVLbK';
const POLL_INTERVAL = 30000; // 30 seconds

let sessionCookie = null;

/**
 * Login and get session cookie
 */
async function login() {
  console.log('[AUTH] Logging in...');
  const challengeRes = await fetch(`${API}/auth/challenge`);
  const { data: ch } = await challengeRes.json();

  const signature = signChallenge(WIF, ch.challenge, I_ADDRESS, 'verustest');

  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: ch.challengeId,
      verusId: IDENTITY,
      signature,
    }),
  });

  const loginData = await loginRes.json();
  if (!loginData.data?.success) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }

  sessionCookie = loginRes.headers.get('set-cookie');
  console.log('[AUTH] ✅ Logged in as', loginData.data.identityName);
  return sessionCookie;
}

/**
 * Make authenticated API request, auto-relogin on 401
 */
async function authFetch(url, options = {}) {
  if (!sessionCookie) await login();

  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Cookie': sessionCookie,
    },
  });

  if (res.status === 401) {
    console.log('[AUTH] Session expired, re-authenticating...');
    await login();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Cookie': sessionCookie,
      },
    });
  }

  return res;
}

/**
 * Poll for new job requests
 */
async function pollJobs() {
  try {
    const res = await authFetch(`${API}/v1/me/jobs?status=requested&role=seller`);
    const data = await res.json();

    if (data.data && data.data.length > 0) {
      for (const job of data.data) {
        console.log(`[JOB] New request: ${job.description} (${job.amount} ${job.currency})`);
        console.log(`      From: ${job.buyerId}`);
        console.log(`      Job ID: ${job.id}`);

        // Auto-accept
        try {
          const acceptRes = await authFetch(`${API}/v1/jobs/${job.id}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Accepted! Working on it.' }),
          });
          const acceptData = await acceptRes.json();
          console.log(`[JOB] ✅ Accepted job ${job.id}`, acceptData.data ? '' : JSON.stringify(acceptData));
        } catch (e) {
          console.error(`[JOB] Failed to accept: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.error('[POLL] Error:', e.message);
  }
}

/**
 * Main loop
 */
async function main() {
  console.log('🤖 Ari 2.0 starting...');
  console.log(`   Identity: ${IDENTITY}`);
  console.log(`   i-address: ${I_ADDRESS}`);
  console.log(`   API: ${API}`);
  console.log(`   Poll interval: ${POLL_INTERVAL / 1000}s`);
  console.log('');

  // Initial login
  await login();

  // First poll immediately
  await pollJobs();

  // Then poll on interval
  console.log(`[POLL] Listening for jobs (every ${POLL_INTERVAL / 1000}s)...`);
  setInterval(pollJobs, POLL_INTERVAL);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
