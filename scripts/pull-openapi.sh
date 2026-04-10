#!/usr/bin/env bash
#
# Download the OpenAPI spec from the Opper API server.
#
# Usage:
#   ./scripts/pull-openapi.sh                        # From production API
#   ./scripts/pull-openapi.sh --url https://custom    # From custom URL
#
set -euo pipefail

BASE_URL="${OPPER_BASE_URL:-https://api.opper.ai}"
OUTPUT="openapi.yaml"
OLD_BACKUP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      BASE_URL="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--url <base-url>]" >&2
      exit 1
      ;;
  esac
done

SPEC_URL="${BASE_URL}/v3/openapi.yaml"

# Back up existing spec for diffing
if [[ -f "$OUTPUT" ]]; then
  OLD_BACKUP=$(mktemp)
  cp "$OUTPUT" "$OLD_BACKUP"
fi

# Download spec
echo "Downloading OpenAPI spec from ${SPEC_URL}..."
if ! curl -fsSL "$SPEC_URL" -o "$OUTPUT"; then
  echo "Error: Failed to download spec from $SPEC_URL" >&2
  # Restore backup if download failed
  if [[ -n "$OLD_BACKUP" ]] && [[ -f "$OLD_BACKUP" ]]; then
    mv "$OLD_BACKUP" "$OUTPUT"
  fi
  exit 1
fi

# Validate the file exists and is non-empty
if [[ ! -s "$OUTPUT" ]]; then
  echo "Error: Downloaded file is empty" >&2
  exit 1
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
IGNORE_FILE="$(dirname "$0")/openapi-ignore.yaml"

if [[ -n "$OLD_BACKUP" ]] && [[ -f "$OLD_BACKUP" ]] && command -v python3 &>/dev/null; then
  python3 -c "
import yaml, sys, os

try:
    old = yaml.safe_load(open('$OLD_BACKUP'))
    new = yaml.safe_load(open('$OUTPUT'))
except Exception:
    sys.exit(0)

# Load ignore list
ignore_schemas = set()
ignore_endpoint_prefixes = []
ignore_path = '$IGNORE_FILE'
if os.path.isfile(ignore_path):
    try:
        ignore = yaml.safe_load(open(ignore_path)) or {}
        ignore_schemas = set(ignore.get('schemas', []) or [])
        ignore_endpoint_prefixes = list(ignore.get('endpoints', []) or [])
    except Exception:
        pass

def endpoint_ignored(path):
    return any(path.startswith(prefix) for prefix in ignore_endpoint_prefixes)

changes = []

# Schema changes
old_schemas = set(old.get('components',{}).get('schemas',{}).keys())
new_schemas = set(new.get('components',{}).get('schemas',{}).keys())
for s in sorted(new_schemas - old_schemas):
    if s not in ignore_schemas:
        changes.append(f'  + schema: {s}')
for s in sorted(old_schemas - new_schemas):
    if s not in ignore_schemas:
        changes.append(f'  - schema: {s}')

# Endpoint changes
old_paths = set(old.get('paths',{}).keys())
new_paths = set(new.get('paths',{}).keys())
for p in sorted(new_paths - old_paths):
    if not endpoint_ignored(p):
        methods = ' '.join(m.upper() for m in new['paths'][p])
        changes.append(f'  + endpoint: {p} [{methods}]')
for p in sorted(old_paths - new_paths):
    if not endpoint_ignored(p):
        methods = ' '.join(m.upper() for m in old['paths'][p])
        changes.append(f'  - endpoint: {p} [{methods}]')

# Required field changes on shared schemas
for name in sorted((old_schemas & new_schemas) - ignore_schemas):
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
for name in sorted((old_schemas & new_schemas) - ignore_schemas):
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
