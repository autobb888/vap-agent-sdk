/**
 * Ari2 Agent Runner — VAP SafeChat ↔ OpenClaw Bridge (HTTP mode)
 * 
 * Polls for VAP jobs, accepts them, connects to SafeChat,
 * forwards messages to Verus Wizard via OpenClaw HTTP chat completions.
 * 
 * Usage: OPENCLAW_TOKEN=xxx node run-ari2-openclaw.cjs
 * 
 * Env vars:
 *   OPENCLAW_TOKEN  - Gateway auth token (from openclaw.json gateway.auth.token)
 *   OPENCLAW_PORT   - Gateway port (default: 18789)
 */
var signChallenge = require('./dist/identity/signer.js').signChallenge;
var sio = require('socket.io-client');
var fs = require('fs');

var keys = JSON.parse(fs.readFileSync('.vap-keys.json', 'utf8'));
var WIF = keys.wif;
var API = 'https://api.autobb.app';
var IDENTITY = 'ari2.agentplatform@';
var I_ADDRESS = keys.iAddress || 'i42xpRB2gAvt8PWpQ5FLw4Q1eG3bUMVLbK';
var POLL_INTERVAL = 30000;
var OC_PORT = process.env.OPENCLAW_PORT || '18789';
var OC_TOKEN = process.env.OPENCLAW_TOKEN || '';
var OC_URL = 'http://127.0.0.1:' + OC_PORT;
var OC_MODEL = process.env.OPENCLAW_MODEL || 'nvidia/moonshotai/kimi-k2.5';

if (!OC_TOKEN) {
  console.error('ERROR: Set OPENCLAW_TOKEN env var (from openclaw.json gateway.auth.token)');
  process.exit(1);
}

var sessionCookie = null;
var sessionToken = null;
var chatSocket = null;
var acceptedJobs = new Set();
var joinedRooms = new Set();

// ── OpenClaw HTTP Chat Completions ─────────────────────────────────

/**
 * Send a message to OpenClaw via HTTP /v1/chat/completions and get response.
 */
async function askOpenClaw(question, timeoutMs) {
  timeoutMs = timeoutMs || 300000; // 5 min — Kimi free tier can be slow
  
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  
  try {
    var res = await fetch(OC_URL + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + OC_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OC_MODEL,
        messages: [{ role: 'user', content: question }]
      }),
      signal: controller.signal
    });
    
    clearTimeout(timer);
    
    if (!res.ok) {
      var errText = await res.text();
      throw new Error('HTTP ' + res.status + ': ' + errText.slice(0, 200));
    }
    
    var data = await res.json();
    var choice = data.choices && data.choices[0];
    if (choice && choice.message && choice.message.content) {
      return choice.message.content;
    }
    throw new Error('No content in response');
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── VAP Auth ───────────────────────────────────────────────────────
async function login() {
  console.log('[AUTH] Logging in...');
  var challengeRes = await fetch(API + '/auth/challenge');
  var chData = await challengeRes.json();
  var ch = chData.data;
  var signature = signChallenge(WIF, ch.challenge, I_ADDRESS, 'verustest');

  var loginRes = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId: ch.challengeId, verusId: IDENTITY, signature: signature }),
  });

  var loginData = await loginRes.json();
  if (!loginData.data || !loginData.data.success) throw new Error('Login failed: ' + JSON.stringify(loginData));

  var rawCookie = loginRes.headers.get('set-cookie') || '';
  var match = rawCookie.match(/verus_session=([^;]+)/);
  sessionToken = match ? match[1] : null;
  sessionCookie = sessionToken ? 'verus_session=' + sessionToken : rawCookie;
  console.log('[AUTH] ✅ Logged in as', loginData.data.identityName);
}

async function authFetch(url, options) {
  options = options || {};
  if (!sessionCookie) await login();

  var headers = Object.assign({}, options.headers || {}, { 'Cookie': sessionCookie });
  var res = await fetch(url, Object.assign({}, options, { headers: headers }));

  if (res.status === 401) {
    console.log('[AUTH] Session expired, re-authenticating...');
    await login();
    headers = Object.assign({}, options.headers || {}, { 'Cookie': sessionCookie });
    res = await fetch(url, Object.assign({}, options, { headers: headers }));
  }
  return res;
}

// ── Job Handling ───────────────────────────────────────────────────
async function acceptJob(job) {
  var detailRes = await authFetch(API + '/v1/jobs/' + job.id);
  var detailData = await detailRes.json();
  var jobDetail = detailData.data;

  if (!jobDetail || !jobDetail.jobHash) {
    console.error('[JOB] Could not get details for job ' + job.id);
    return false;
  }

  var timestamp = Math.floor(Date.now() / 1000);
  var message = 'VAP-ACCEPT|Job:' + jobDetail.jobHash + '|Buyer:' + jobDetail.buyerVerusId + '|Amt:' + jobDetail.amount + ' ' + jobDetail.currency + '|Ts:' + timestamp + '|I accept this job and commit to delivering the work.';
  var signature = signChallenge(WIF, message, I_ADDRESS, 'verustest');

  var acceptRes = await authFetch(API + '/v1/jobs/' + job.id + '/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp: timestamp, signature: signature }),
  });

  var acceptData = await acceptRes.json();
  if (acceptRes.status === 200 || acceptRes.status === 201) {
    console.log('[JOB] ✅ Accepted job ' + job.id);
    joinJobChat(job.id);
    return true;
  } else {
    console.error('[JOB] ❌ Accept failed:', JSON.stringify(acceptData));
    return false;
  }
}

async function pollJobs() {
  try {
    var res = await authFetch(API + '/v1/me/jobs?status=requested&role=seller');
    var data = await res.json();

    if (data.data && data.data.length > 0) {
      for (var i = 0; i < data.data.length; i++) {
        var job = data.data[i];
        if (acceptedJobs.has(job.id)) continue;
        acceptedJobs.add(job.id);

        console.log('[JOB] New request: ' + (job.description || '').slice(0, 80) + '...');
        console.log('      Amount: ' + job.amount + ' ' + job.currency);
        console.log('      Job ID: ' + job.id);

        await acceptJob(job);
      }
    }
  } catch (e) {
    console.error('[POLL] Error:', e.message);
  }
}

// ── SafeChat WebSocket ─────────────────────────────────────────────
async function connectChat() {
  if (!sessionToken) {
    console.error('[CHAT] No session token, skipping chat connection');
    return;
  }

  var tokenRes = await authFetch(API + '/v1/chat/token');
  var tokenData = await tokenRes.json();
  var chatToken = tokenData.data && tokenData.data.token;
  if (!chatToken) {
    console.error('[CHAT] Failed to get chat token');
    return;
  }

  return new Promise(function(resolve) {
    chatSocket = sio.io(API, {
      path: '/ws',
      auth: { token: chatToken },
      extraHeaders: { 'Cookie': 'verus_session=' + sessionToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    chatSocket.on('connect', function() {
      console.log('[CHAT] ✅ Connected to SafeChat');
      joinedRooms.forEach(function(jobId) {
        chatSocket.emit('join_job', { jobId: jobId });
      });
      resolve();
    });

    chatSocket.on('disconnect', function(reason) {
      console.log('[CHAT] Disconnected: ' + reason);
    });

    chatSocket.on('connect_error', function(err) {
      console.error('[CHAT] Connection error: ' + err.message);
      resolve();
    });

    chatSocket.on('joined', function(data) {
      console.log('[CHAT] Joined room for job ' + data.jobId);
    });

    chatSocket.on('message', async function(msg) {
      // Ignore our own messages
      if (msg.senderVerusId === I_ADDRESS || msg.senderVerusId === IDENTITY) return;
      if (msg.senderVerusId === 'system') {
        console.log('[CHAT] System: ' + msg.content);
        return;
      }

      console.log('[CHAT] 💬 [' + (msg.jobId || '?').slice(0, 8) + '] ' + msg.senderVerusId + ': ' + msg.content);

      if (msg.jobId && msg.content) {
        try {
          console.log('[OC] Asking Verus Wizard...');
          var response = await askOpenClaw(msg.content);
          
          // Truncate if too long for chat (4000 char limit is common)
          if (response.length > 3900) {
            response = response.slice(0, 3900) + '\n\n[Response truncated]';
          }
          
          chatSocket.emit('message', { jobId: msg.jobId, content: response });
          console.log('[CHAT] 📤 Replied (' + response.length + ' chars) in job ' + msg.jobId.slice(0, 8));
        } catch (err) {
          console.error('[OC] Error:', err.message);
          chatSocket.emit('message', {
            jobId: msg.jobId,
            content: 'Sorry, I encountered an error processing your request. Please try again.'
          });
        }
      }
    });

    chatSocket.on('error', function(data) {
      console.error('[CHAT] Error: ' + data.message);
    });

    setTimeout(function() { resolve(); }, 5000);
  });
}

function joinJobChat(jobId) {
  joinedRooms.add(jobId);
  if (chatSocket && chatSocket.connected) {
    chatSocket.emit('join_job', { jobId: jobId });
  }
}

async function joinActiveJobChats() {
  try {
    var statuses = ['accepted', 'in_progress'];
    for (var s = 0; s < statuses.length; s++) {
      var res = await authFetch(API + '/v1/me/jobs?status=' + statuses[s] + '&role=seller');
      var data = await res.json();
      if (data.data) {
        for (var j = 0; j < data.data.length; j++) {
          joinJobChat(data.data[j].id);
        }
      }
    }
  } catch (e) {
    console.error('[CHAT] Error joining active job rooms:', e.message);
  }
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 Ari 2.0 starting (HTTP bridge)...');
  console.log('   Identity: ' + IDENTITY);
  console.log('   i-address: ' + I_ADDRESS);
  console.log('   API: ' + API);
  console.log('   OpenClaw: ' + OC_URL + '/v1/chat/completions');
  console.log('   Model: ' + OC_MODEL);
  console.log('   Poll interval: ' + (POLL_INTERVAL / 1000) + 's\n');

  // Quick OpenClaw connectivity check
  try {
    var testRes = await fetch(OC_URL + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + OC_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OC_MODEL,
        messages: [{ role: 'user', content: 'ping' }]
      })
    });
    if (testRes.ok) {
      console.log('[OC] ✅ OpenClaw HTTP endpoint working');
    } else {
      console.error('[OC] ⚠️  OpenClaw returned ' + testRes.status + ' — check config');
    }
  } catch (e) {
    console.error('[OC] ❌ Cannot reach OpenClaw at ' + OC_URL + ': ' + e.message);
  }

  await login();
  await connectChat();
  await joinActiveJobChats();
  await pollJobs();

  console.log('[POLL] Listening for jobs (every ' + (POLL_INTERVAL / 1000) + 's)...');
  setInterval(pollJobs, POLL_INTERVAL);
}

main().catch(function(e) {
  console.error('Fatal:', e.message);
  process.exit(1);
});
