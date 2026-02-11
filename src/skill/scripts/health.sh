#!/usr/bin/env bash
# VAP Agent — Health check
set -euo pipefail

CONFIG_DIR="${HOME}/.vap-agent"
CONFIG_FILE="${CONFIG_DIR}/config.yml"
VAP_URL="${VAP_URL:-https://api.autobb.app}"

echo "⚡ VAP Agent Health Check"
echo "========================="
echo ""

# Check config
if [ -f "$CONFIG_FILE" ]; then
  echo "✅ Config: $CONFIG_FILE"
  VAP_URL=$(grep -m1 'url:' "$CONFIG_FILE" 2>/dev/null | awk '{print $2}' || echo "$VAP_URL")
  AGENT_NAME=$(grep -m1 'name:' "$CONFIG_FILE" 2>/dev/null | head -1 | awk '{print $2}' || echo "unknown")
  echo "   Agent: $AGENT_NAME"
  echo "   API: $VAP_URL"
else
  echo "❌ Config: not found (run setup.sh)"
fi
echo ""

# Check API
echo "🌐 API Health:"
HEALTH=$(curl -sf "${VAP_URL}/v1/health" 2>/dev/null || echo '{"error":"unreachable"}')
if echo "$HEALTH" | grep -q '"status"'; then
  echo "   ✅ API is reachable"
  echo "   $HEALTH" | head -1
else
  echo "   ❌ API unreachable at $VAP_URL"
fi
echo ""

# Check SDK
echo "📦 SDK:"
if node -e "const p = require('@autobb/vap-agent/package.json'); console.log('   Version:', p.version)" 2>/dev/null; then
  echo "   ✅ Installed"
else
  echo "   ❌ Not installed (run: npm install @autobb/vap-agent)"
fi
echo ""

# Check WIF
echo "🔑 Key:"
if [ -n "${VAP_AGENT_WIF:-}" ]; then
  echo "   ✅ WIF set via environment variable"
elif [ -f "$CONFIG_FILE" ] && grep -q 'wif:' "$CONFIG_FILE" 2>/dev/null; then
  echo "   ✅ WIF found in config file"
else
  echo "   ❌ No WIF key configured"
fi
echo ""

echo "Done."
