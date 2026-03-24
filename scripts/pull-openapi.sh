#!/usr/bin/env bash
#
# Download the OpenAPI spec from the opper-ai/opper CI artifacts.
#
# Usage:
#   ./scripts/pull-openapi.sh              # Latest from main
#   ./scripts/pull-openapi.sh --run-id 123 # Specific CI run
#
set -euo pipefail

REPO="opper-ai/opper"
ARTIFACT="openapi-spec"
OUTPUT="openapi.yaml"
OLD_BACKUP=""
RUN_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id)
      RUN_ID="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--run-id <id>]" >&2
      exit 1
      ;;
  esac
done

# Check for gh CLI
if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI is required. Install from https://cli.github.com" >&2
  exit 1
fi

# Back up existing spec for diffing
if [[ -f "$OUTPUT" ]]; then
  OLD_BACKUP=$(mktemp)
  cp "$OUTPUT" "$OLD_BACKUP"
  rm "$OUTPUT"
fi

# Download artifact
echo "Downloading OpenAPI spec from $REPO..."
if [[ -n "$RUN_ID" ]]; then
  gh run download "$RUN_ID" -n "$ARTIFACT" -R "$REPO"
else
  gh run download -n "$ARTIFACT" -R "$REPO"
fi

# Validate the file exists
if [[ ! -f "$OUTPUT" ]]; then
  echo "Error: $OUTPUT not found after download" >&2
  exit 1
fi

# Validate it's parseable YAML (use python since it's widely available)
if command -v python3 &>/dev/null; then
  python3 -c "import yaml, sys; yaml.safe_load(open('$OUTPUT'))" 2>/dev/null || {
    echo "Warning: Could not validate YAML (pyyaml not installed), checking basic structure..." >&2
    head -1 "$OUTPUT" | grep -q "openapi" || {
      echo "Error: $OUTPUT does not look like a valid OpenAPI spec" >&2
      exit 1
    }
  }
fi

# Print summary
echo ""
echo "--- OpenAPI Spec Summary ---"
if command -v python3 &>/dev/null; then
  python3 -c "
import yaml, sys
try:
    spec = yaml.safe_load(open('$OUTPUT'))
    info = spec.get('info', {})
    paths = spec.get('paths', {})
    print(f\"Title:     {info.get('title', 'N/A')}\")
    print(f\"Version:   {info.get('version', 'N/A')}\")
    print(f\"Endpoints: {len(paths)}\")
except Exception:
    print('(install pyyaml for detailed summary)')
" 2>/dev/null || echo "(install pyyaml for detailed summary)"
else
  echo "(install python3 + pyyaml for detailed summary)"
fi
echo "Output:    $OUTPUT"
echo "----------------------------"

# Smart diff against previous spec
if [[ -n "$OLD_BACKUP" ]] && [[ -f "$OLD_BACKUP" ]] && command -v python3 &>/dev/null; then
  python3 -c "
import yaml, sys

try:
    old = yaml.safe_load(open('$OLD_BACKUP'))
    new = yaml.safe_load(open('$OUTPUT'))
except Exception:
    sys.exit(0)

changes = []

# Schema changes
old_schemas = set(old.get('components',{}).get('schemas',{}).keys())
new_schemas = set(new.get('components',{}).get('schemas',{}).keys())
for s in sorted(new_schemas - old_schemas):
    changes.append(f'  + schema: {s}')
for s in sorted(old_schemas - new_schemas):
    changes.append(f'  - schema: {s}')

# Endpoint changes
old_paths = set(old.get('paths',{}).keys())
new_paths = set(new.get('paths',{}).keys())
for p in sorted(new_paths - old_paths):
    methods = ' '.join(m.upper() for m in new['paths'][p])
    changes.append(f'  + endpoint: {p} [{methods}]')
for p in sorted(old_paths - new_paths):
    methods = ' '.join(m.upper() for m in old['paths'][p])
    changes.append(f'  - endpoint: {p} [{methods}]')

# Required field changes on shared schemas
for name in sorted(old_schemas & new_schemas):
    old_req = set(old['components']['schemas'][name].get('required', []))
    new_req = set(new['components']['schemas'][name].get('required', []))
    added = new_req - old_req
    removed = old_req - new_req
    if added or removed:
        for f in sorted(added):
            changes.append(f'  + {name}.required: {f}')
        for f in sorted(removed):
            changes.append(f'  - {name}.required: {f}')

# New fields on shared schemas
for name in sorted(old_schemas & new_schemas):
    old_props = set(old['components']['schemas'][name].get('properties', {}).keys())
    new_props = set(new['components']['schemas'][name].get('properties', {}).keys())
    for f in sorted(new_props - old_props):
        changes.append(f'  + {name}.{f}')
    for f in sorted(old_props - new_props):
        changes.append(f'  - {name}.{f}')

if changes:
    print()
    print('--- Changes from previous spec ---')
    for c in changes:
        print(c)
    print('----------------------------------')
else:
    print()
    print('(no changes from previous spec)')
" 2>/dev/null || true
  rm -f "$OLD_BACKUP"
fi
