/**
 * Ari2 Agent Runner — polls for jobs on VAP marketplace
 * 
 * Usage: node run-ari2.cjs
 */
const { signChallenge } = require('./dist/identity/signer.js');
const { io } = require('socket.io-client');
const fs = require('fs');

const keys = JSON.parse(fs.readFileSync('.vap-keys.json', 'utf8'));
const WIF = keys.wif;
const API = 'https://api.autobb.app';
const IDENTITY = 'ari2.agentplatform@';
const I_ADDRESS = keys.iAddress || 'i42xpRB2gAvt8PWpQ5FLw4Q1eG3bUMVLbK';
const POLL_INTERVAL = 30000;

let sessionCookie = null;
let sessionToken = null; // Just the token value for WebSocket auth
let chatSocket = null;
const acceptedJobs = new Set(); // Track jobs we've already tried to accept
const joinedRooms = new Set();

async function login() {
  console.log('[AUTH] Logging in...');
  const challengeRes = await fetch(`${API}/auth/challenge`);
  const { data: ch } = await challengeRes.json();
  const signature = signChallenge(WIF, ch.challenge, I_ADDRESS, 'verustest');

  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId: ch.challengeId, verusId: IDENTITY, signature }),
  });

  const loginData = await loginRes.json();
  if (!loginData.data?.success) throw new Error('Login failed: ' + JSON.stringify(loginData));

  sessionCookie = loginRes.headers.get('set-cookie');
  // Extract token value for WebSocket auth
  const match = sessionCookie?.match(/verus_session=([^;]+)/);
  sessionToken = match ? match[1] : null;
  console.log('[AUTH] ✅ Logged in as', loginData.data.identityName);
}

async function authFetch(url, options = {}) {
  if (!sessionCookie) await login();

  let res = await fetch(url, {
    ...options,
    headers: { ...options.headers, 'Cookie': sessionCookie },
  });

  if (res.status === 401) {
    console.log('[AUTH] Session expired, re-authenticating...');
    await login();
    res = await fetch(url, {
      ...options,
      headers: { ...options.headers, 'Cookie': sessionCookie },
    });
  }

  return res;
}

/**
 * Accept a job with signed message
 */
async function acceptJob(job) {
  // First get full job details (need job_hash, buyer_verus_id)
  const detailRes = await authFetch(`${API}/v1/jobs/${job.id}`);
  const detailData = await detailRes.json();
  const jobDetail = detailData.data;

  if (!jobDetail || !jobDetail.jobHash) {
    console.error(`[JOB] Could not get details for job ${job.id}`);
    return false;
  }

  // Construct the acceptance message (must match server's generateJobAcceptanceMessage)
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `VAP-ACCEPT|Job:${jobDetail.jobHash}|Buyer:${jobDetail.buyerVerusId}|Amt:${jobDetail.amount} ${jobDetail.currency}|Ts:${timestamp}|I accept this job and commit to delivering the work.`;

  const signature = signChallenge(WIF, message, I_ADDRESS, 'verustest');

  const acceptRes = await authFetch(`${API}/v1/jobs/${job.id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, signature }),
  });

  const acceptData = await acceptRes.json();
  if (acceptRes.status === 200 || acceptRes.status === 201) {
    console.log(`[JOB] ✅ Accepted job ${job.id}`);
    joinJobChat(job.id);
    return true;
  } else {
    console.error(`[JOB] ❌ Accept failed:`, JSON.stringify(acceptData));
    return false;
  }
}

async function pollJobs() {
  try {
    const res = await authFetch(`${API}/v1/me/jobs?status=requested&role=seller`);
    const data = await res.json();

    if (data.data && data.data.length > 0) {
      for (const job of data.data) {
        if (acceptedJobs.has(job.id)) continue; // Skip already processed
        acceptedJobs.add(job.id);

        console.log(`[JOB] New request: ${job.description?.slice(0, 80)}...`);
        console.log(`      Amount: ${job.amount} ${job.currency}`);
        console.log(`      Job ID: ${job.id}`);

        await acceptJob(job);
      }
    }
  } catch (e) {
    console.error('[POLL] Error:', e.message);
  }
}

/**
 * Connect to SafeChat WebSocket
 */
async function connectChat() {
  if (!sessionToken) {
    console.error('[CHAT] No session token, skipping chat connection');
    return;
  }

  // Get one-time chat token
  const tokenRes = await authFetch(`${API}/v1/chat/token`);
  const tokenData = await tokenRes.json();
  const chatToken = tokenData.data?.token;
  if (!chatToken) {
    console.error('[CHAT] Failed to get chat token');
    return;
  }

  return new Promise((resolve) => {
    chatSocket = io(API, {
      path: '/ws',
      auth: { token: chatToken },
      extraHeaders: {
        'Cookie': `verus_session=${sessionToken}`,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    chatSocket.on('connect', () => {
      console.log('[CHAT] ✅ Connected to SafeChat');
      // Re-join any rooms
      for (const jobId of joinedRooms) {
        chatSocket.emit('join_job', { jobId });
      }
      resolve();
    });

    chatSocket.on('disconnect', (reason) => {
      console.log(`[CHAT] Disconnected: ${reason}`);
    });

    chatSocket.on('connect_error', (err) => {
      console.error(`[CHAT] Connection error: ${err.message}`);
      resolve(); // Don't block startup
    });

    chatSocket.on('joined', (data) => {
      console.log(`[CHAT] Joined room for job ${data.jobId}`);
    });

    chatSocket.on('message', (msg) => {
      // Ignore our own messages
      if (msg.senderVerusId === I_ADDRESS || msg.senderVerusId === IDENTITY) return;
      if (msg.senderVerusId === 'system') {
        console.log(`[CHAT] System: ${msg.content}`);
        return;
      }

      console.log(`[CHAT] 💬 ${msg.senderVerusId}: ${msg.content}`);

      // Auto-reply (placeholder — replace with AI logic)
      const reply = `Hello! I'm Ari2, your AI research agent. I've received your message: "${msg.content.slice(0, 100)}". I'm ready to help with research and analysis. What would you like me to look into?`;
      chatSocket.emit('message', { jobId: msg.jobId, content: reply });
      console.log(`[CHAT] 📤 Replied in job ${msg.jobId}`);
    });

    chatSocket.on('error', (data) => {
      console.error(`[CHAT] Error: ${data.message}`);
    });

    // Timeout fallback
    setTimeout(() => resolve(), 5000);
  });
}

/**
 * Join a job's chat room
 */
function joinJobChat(jobId) {
  joinedRooms.add(jobId);
  if (chatSocket?.connected) {
    chatSocket.emit('join_job', { jobId });
  }
}

/**
 * Join chat rooms for all active jobs (accepted/in_progress)
 */
async function joinActiveJobChats() {
  try {
    for (const status of ['accepted', 'in_progress']) {
      const res = await authFetch(`${API}/v1/me/jobs?status=${status}&role=seller`);
      const data = await res.json();
      if (data.data) {
        for (const job of data.data) {
          joinJobChat(job.id);
        }
      }
    }
  } catch (e) {
    console.error('[CHAT] Error joining active job rooms:', e.message);
  }
}

async function main() {
  console.log('🤖 Ari 2.0 starting...');
  console.log(`   Identity: ${IDENTITY}`);
  console.log(`   i-address: ${I_ADDRESS}`);
  console.log(`   API: ${API}`);
  console.log(`   Poll interval: ${POLL_INTERVAL / 1000}s\n`);

  await login();
  await connectChat();
  await joinActiveJobChats();
  await pollJobs();

  console.log(`[POLL] Listening for jobs (every ${POLL_INTERVAL / 1000}s)...`);
  setInterval(pollJobs, POLL_INTERVAL);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
