/**
 * Ari2 SafeChat ↔ OpenClaw Bridge
 * 
 * Runs locally on the OpenClaw host. Connects to SafeChat WebSocket
 * and forwards messages to Ari's OpenClaw session via the gateway API.
 * 
 * Usage: node bridge-ari2.cjs
 */
const { signChallenge } = require('./dist/identity/signer.js');
const { io } = require('socket.io-client');
const fs = require('fs');

const keys = JSON.parse(fs.readFileSync('.vap-keys.json', 'utf8'));
const WIF = keys.wif;
const API = 'https://api.autobb.app';
const IDENTITY = 'ari2.agentplatform@';
const I_ADDRESS = keys.iAddress || 'i42xpRB2gAvt8PWpQ5FLw4Q1eG3bUMVLbK';

// OpenClaw gateway config
const OPENCLAW_URL = 'http://127.0.0.1:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;
const ARI_SESSION = 'agent:ari:main';

if (!OPENCLAW_TOKEN) {
  console.error('Set OPENCLAW_TOKEN env var (gateway auth token)');
  process.exit(1);
}

let sessionCookie = null;
let sessionToken = null;
let chatSocket = null;

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
  if (!loginData.data?.success) throw new Error('Login failed');

  const rawCookie = loginRes.headers.get('set-cookie') || '';
  const match = rawCookie.match(/verus_session=([^;]+)/);
  sessionToken = match ? match[1] : null;
  sessionCookie = sessionToken ? `verus_session=${sessionToken}` : rawCookie;
  console.log('[AUTH] ✅ Logged in as', loginData.data.identityName);
}

async function authFetch(url, options = {}) {
  if (!sessionCookie) await login();
  return fetch(url, {
    ...options,
    headers: { ...options.headers, 'Cookie': sessionCookie },
  });
}

/**
 * Send a message to Ari's OpenClaw session and get the response
 */
async function askAri(userMessage, senderName) {
  const prompt = `[SafeChat Job Message from ${senderName}]\n${userMessage}`;
  
  try {
    const res = await fetch(`${OPENCLAW_URL}/api/sessions/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
      },
      body: JSON.stringify({
        sessionKey: ARI_SESSION,
        message: prompt,
        timeoutSeconds: 120,
      }),
    });

    if (!res.ok) {
      console.error('[OPENCLAW] Error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    // Extract text response
    if (data.reply) return data.reply;
    if (data.content) return typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
    return JSON.stringify(data);
  } catch (err) {
    console.error('[OPENCLAW] Failed to reach gateway:', err.message);
    return null;
  }
}

async function connectChat() {
  const tokenRes = await authFetch(`${API}/v1/chat/token`);
  const tokenData = await tokenRes.json();
  const chatToken = tokenData.data?.token;
  if (!chatToken) throw new Error('Failed to get chat token');

  return new Promise((resolve) => {
    chatSocket = io(API, {
      path: '/ws',
      auth: { token: chatToken },
      extraHeaders: { 'Cookie': `verus_session=${sessionToken}` },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    chatSocket.on('connect', () => {
      console.log('[CHAT] ✅ Connected to SafeChat');
      resolve();
    });

    chatSocket.on('disconnect', (reason) => {
      console.log(`[CHAT] Disconnected: ${reason}`);
    });

    chatSocket.on('connect_error', (err) => {
      console.error(`[CHAT] Error: ${err.message}`);
      resolve();
    });

    chatSocket.on('joined', (data) => {
      console.log(`[CHAT] Joined room for job ${data.jobId}`);
    });

    chatSocket.on('message', async (msg) => {
      if (msg.senderVerusId === I_ADDRESS || msg.senderVerusId === IDENTITY) return;
      if (msg.senderVerusId === 'system' || !msg.jobId) return;

      console.log(`[CHAT] 💬 [${msg.jobId.slice(0, 8)}] ${msg.senderVerusId}: ${msg.content}`);

      // Forward to Ari's OpenClaw session
      console.log(`[CHAT] 🤔 Asking Ari...`);
      const response = await askAri(msg.content, msg.senderVerusId);

      if (response) {
        // Truncate if too long for SafeChat (4000 char limit)
        const reply = response.length > 3900 ? response.slice(0, 3900) + '...' : response;
        chatSocket.emit('message', { jobId: msg.jobId, content: reply });
        console.log(`[CHAT] 📤 Replied (${reply.length} chars)`);
      } else {
        chatSocket.emit('message', { jobId: msg.jobId, content: "I'm having trouble processing your request right now. Please try again in a moment." });
        console.log(`[CHAT] ⚠️ Sent fallback reply`);
      }
    });

    chatSocket.on('error', (data) => {
      console.error(`[CHAT] Error: ${data.message}`);
    });

    setTimeout(() => resolve(), 5000);
  });
}

async function joinActiveJobs() {
  for (const status of ['accepted', 'in_progress']) {
    const res = await authFetch(`${API}/v1/me/jobs?status=${status}&role=seller`);
    const data = await res.json();
    if (data.data) {
      for (const job of data.data) {
        chatSocket.emit('join_job', { jobId: job.id });
      }
    }
  }
}

async function main() {
  console.log('🌉 Ari2 SafeChat ↔ OpenClaw Bridge');
  console.log(`   Identity: ${IDENTITY}`);
  console.log(`   API: ${API}`);
  console.log(`   OpenClaw: ${OPENCLAW_URL}`);
  console.log(`   Ari session: ${ARI_SESSION}\n`);

  await login();
  await connectChat();
  await joinActiveJobs();

  console.log('[BRIDGE] ✅ Ready — forwarding SafeChat messages to Ari');

  // Keep alive
  setInterval(async () => {
    // Rejoin any new jobs
    try { await joinActiveJobs(); } catch {}
  }, 30000);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
