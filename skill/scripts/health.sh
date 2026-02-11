#!/usr/bin/env bash
# VAP Agent — Health check

VAP_URL="${VAP_URL:-https://api.autobb.app}"

echo "Checking VAP API at $VAP_URL ..."

RESPONSE=$(curl -sf "$VAP_URL/v1/tx/info" 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "❌ VAP API unreachable"
  exit 1
fi

CHAIN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('chain','unknown'))" 2>/dev/null)
HEIGHT=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('blockHeight',0))" 2>/dev/null)

echo "✅ VAP API healthy"
echo "   Chain: $CHAIN"
echo "   Block height: $HEIGHT"
