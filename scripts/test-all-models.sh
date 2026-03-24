#!/bin/bash
# Test entity extraction against every available LLM model via curl.
# Usage: ./scripts/test-all-models.sh [model-limit] [concurrency]
#   model-limit: max models to test (default: all)
#   concurrency: parallel requests (default: 15)

set -eo pipefail

BASE_URL="${OPPER_BASE_URL:-https://api.opper.ai}"
CONCURRENCY="${2:-15}"

if [ -z "${OPPER_API_KEY:-}" ]; then
  echo "Error: OPPER_API_KEY is not set" >&2
  exit 1
fi

# Temp dir for per-model results
RESULTS_DIR=$(mktemp -d)
trap "rm -rf $RESULTS_DIR" EXIT

# The call payload template
PAYLOAD_TEMPLATE='{
  "input": {
    "text": "Marie Curie conducted groundbreaking research on radioactivity in Paris. She was the first woman to win a Nobel Prize. Her husband was Pierre Curie."
  },
  "input_schema": {
    "type": "object",
    "properties": { "text": { "type": "string" } },
    "required": ["text"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "people": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "role": { "type": "string" }
          },
          "required": ["name"]
        }
      },
      "locations": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["people", "locations"]
  },
  "model": "MODEL_PLACEHOLDER"
}'

# Function to test a single model — runs in a subshell
test_model() {
  local MODEL_ID="$1"
  local SAFE_NAME=$(echo "$MODEL_ID" | tr '/' '_')
  local PAYLOAD=$(echo "$PAYLOAD_TEMPLATE" | sed "s|MODEL_PLACEHOLDER|$MODEL_ID|")

  local START=$(python3 -c 'import time; print(int(time.time()*1000))')

  local RESPONSE=$(curl -s -w "\n%{http_code}" \
    "$BASE_URL/v3/functions/sdk-test-extract-entities/call" \
    -H "Authorization: Bearer $OPPER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>&1)

  local END=$(python3 -c 'import time; print(int(time.time()*1000))')
  local DURATION=$(( END - START ))

  local HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  local BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" != "200" ]; then
    local ERROR_DETAIL=$(echo "$BODY" | jq -r '.error.message // .detail // empty' 2>/dev/null | head -1)
    if [ -z "$ERROR_DETAIL" ]; then
      ERROR_DETAIL=$(echo "$BODY" | head -c 200)
    fi
    echo "$MODEL_ID	error	HTTP $HTTP_CODE: $ERROR_DETAIL	${DURATION}ms" > "$RESULTS_DIR/$SAFE_NAME"
    echo "  FAIL  $MODEL_ID ($HTTP_CODE, ${DURATION}ms)"
    return
  fi

  # Validate output fields are non-empty
  local OUTPUT=$(echo "$BODY" | jq -c '.output // empty' 2>/dev/null)
  local PEOPLE_COUNT=$(echo "$BODY" | jq '.output.people | length' 2>/dev/null || echo 0)
  local LOCATIONS_COUNT=$(echo "$BODY" | jq '.output.locations | length' 2>/dev/null || echo 0)
  local EMPTY_NAMES=$(echo "$BODY" | jq '[.output.people[]? | select(.name == "" or .name == null)] | length' 2>/dev/null || echo 0)

  if [ -z "$OUTPUT" ]; then
    echo "$MODEL_ID	error	No output in response	${DURATION}ms" > "$RESULTS_DIR/$SAFE_NAME"
    echo "  FAIL  $MODEL_ID — no output (${DURATION}ms)"
  elif [ "$PEOPLE_COUNT" = "0" ]; then
    local GOT=$(echo "$OUTPUT" | head -c 200)
    echo "$MODEL_ID	error	Empty people array. Got: $GOT	${DURATION}ms" > "$RESULTS_DIR/$SAFE_NAME"
    echo "  FAIL  $MODEL_ID — empty people (${DURATION}ms)"
  elif [ "$LOCATIONS_COUNT" = "0" ]; then
    local GOT=$(echo "$OUTPUT" | head -c 200)
    echo "$MODEL_ID	error	Empty locations array. Got: $GOT	${DURATION}ms" > "$RESULTS_DIR/$SAFE_NAME"
    echo "  FAIL  $MODEL_ID — empty locations (${DURATION}ms)"
  elif [ "$EMPTY_NAMES" != "0" ]; then
    echo "$MODEL_ID	error	Person with empty name	${DURATION}ms" > "$RESULTS_DIR/$SAFE_NAME"
    echo "  FAIL  $MODEL_ID — empty name (${DURATION}ms)"
  else
    echo "$MODEL_ID	success	ok	${DURATION}ms" > "$RESULTS_DIR/$SAFE_NAME"
    echo "  OK    $MODEL_ID (${DURATION}ms)"
  fi
}

# Fetch all models
echo "Fetching models..."
MODELS_JSON=$(curl -s "$BASE_URL/v3/models?limit=300" \
  -H "Authorization: Bearer $OPPER_API_KEY")

LIMIT="${1:-0}"
if [ "$LIMIT" -gt 0 ] 2>/dev/null; then
  MODEL_IDS=$(echo "$MODELS_JSON" | jq -r "[.models[] | select(.type == \"llm\")] | .[:$LIMIT][].id")
else
  MODEL_IDS=$(echo "$MODELS_JSON" | jq -r '.models[] | select(.type == "llm") | .id')
fi
MODEL_COUNT=$(echo "$MODEL_IDS" | wc -l | tr -d ' ')
echo "Testing $MODEL_COUNT LLM models ($CONCURRENCY concurrent)"
echo ""

# Run tests in parallel with concurrency limit
RUNNING=0
for MODEL_ID in $MODEL_IDS; do
  test_model "$MODEL_ID" &
  RUNNING=$(( RUNNING + 1 ))

  if [ "$RUNNING" -ge "$CONCURRENCY" ]; then
    wait -n 2>/dev/null || wait
    RUNNING=$(( RUNNING - 1 ))
  fi
done
wait

# Collect results from temp files
echo ""
echo "============================================================"

PASS=0
FAIL=0
ERROR_ROWS=""
SUCCESS_ROWS=""

for f in "$RESULTS_DIR"/*; do
  [ -f "$f" ] || continue
  IFS=$'\t' read -r MODEL STATUS MSG DUR < "$f"
  if [ "$STATUS" = "success" ]; then
    PASS=$(( PASS + 1 ))
    SUCCESS_ROWS="${SUCCESS_ROWS}| \`$MODEL\` | $DUR |\n"
  else
    FAIL=$(( FAIL + 1 ))
    ERROR_ROWS="${ERROR_ROWS}| \`$MODEL\` | $MSG | $DUR |\n"
  fi
done

echo "RESULTS: $PASS passed, $FAIL failed out of $MODEL_COUNT"
echo "============================================================"

DATE=$(date +%Y-%m-%d)

# Write GitHub issue body
ISSUE_FILE="/tmp/model-test-issue-body.md"
cat > "$ISSUE_FILE" <<EOF
## Model compatibility test — $DATE

Ran entity extraction (01a) against all $MODEL_COUNT LLM models ($CONCURRENCY concurrent).

**$PASS passed, $FAIL failed**

### curl to reproduce any failure

\`\`\`bash
curl -X POST $BASE_URL/v3/functions/sdk-test-extract-entities/call \\
  -H "Authorization: Bearer \$OPPER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": { "text": "Marie Curie conducted groundbreaking research on radioactivity in Paris. She was the first woman to win a Nobel Prize. Her husband was Pierre Curie." },
    "input_schema": { "type": "object", "properties": { "text": { "type": "string" } }, "required": ["text"] },
    "output_schema": { "type": "object", "properties": { "people": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "role": { "type": "string" } }, "required": ["name"] } }, "locations": { "type": "array", "items": { "type": "string" } } }, "required": ["people", "locations"] },
    "model": "REPLACE_WITH_MODEL_ID"
  }'
\`\`\`

### Failures

| Model | Error | Duration |
|-------|-------|----------|
$(echo -e "$ERROR_ROWS" | sed '/^$/d')

### Successes

| Model | Duration |
|-------|----------|
$(echo -e "$SUCCESS_ROWS" | sed '/^$/d')
EOF

echo ""
echo "Issue body written to $ISSUE_FILE"
echo ""
echo "To create the GitHub issue:"
echo "  gh issue create --title \"Model compatibility report — $DATE\" --body-file $ISSUE_FILE"
