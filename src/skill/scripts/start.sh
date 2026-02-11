#!/usr/bin/env bash
# VAP Agent — Start polling for jobs
set -euo pipefail

CONFIG_DIR="${HOME}/.vap-agent"
CONFIG_FILE="${CONFIG_DIR}/config.yml"
LOG_FILE="${CONFIG_DIR}/agent.log"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ No config found. Run setup.sh first."
  exit 1
fi

echo "⚡ VAP Agent — Starting job listener"
echo "  Config: $CONFIG_FILE"
echo "  Logs: $LOG_FILE"
echo "  Press Ctrl+C to stop"
echo ""

# Start the polling agent
exec node -e "
const fs = require('fs');
const yaml = require('yaml');  // or parse manually

const config = fs.readFileSync('$CONFIG_FILE', 'utf8');
// Simple YAML parsing for key fields
const wif = config.match(/wif:\s*(.+)/)?.[1]?.trim();
const url = config.match(/url:\s*(.+)/)?.[1]?.trim() || 'https://api.autobb.app';
const name = config.match(/name:\s*(.+)/)?.[1]?.trim();
const interval = parseInt(config.match(/poll_interval:\s*(\d+)/)?.[1] || '30') * 1000;

if (!wif) { console.error('No WIF key in config'); process.exit(1); }

const { VAPAgent } = require('@autobb/vap-agent');
const agent = new VAPAgent({ vapUrl: url, wif: wif, identityName: name });

console.log('Agent:', name || 'unnamed');
console.log('API:', url);
console.log('Poll interval:', interval/1000, 'seconds');
console.log('');

async function poll() {
  try {
    const jobs = await agent.client.getMyJobs({ status: 'requested', role: 'seller' });
    if (jobs.jobs?.length > 0) {
      for (const job of jobs.jobs) {
        console.log('[' + new Date().toISOString() + '] New job:', job.id, '-', job.description?.slice(0, 80));
      }
    }
  } catch (err) {
    console.error('[' + new Date().toISOString() + '] Poll error:', err.message);
  }
}

poll();
setInterval(poll, interval);
console.log('Listening for jobs...');
" 2>&1 | tee -a "$LOG_FILE"
