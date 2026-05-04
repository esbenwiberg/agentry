#!/usr/bin/env bash
# Create a changelog fragment in .changes/
# Usage: ./create-fragment.sh -t feat -s cli -n add-doctor -d "Add doctor verb."

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  cat <<EOF
Usage: $0 -t TYPE -s SCOPE -n NAME -d DESCRIPTION

Required:
  -t TYPE          One of: feat, fix, breaking, perf, security, refactor, build
  -s SCOPE         Kebab-case scope (e.g., cli, catalog, hooks)
  -n NAME          Kebab-case descriptive name (e.g., add-doctor-verb)
  -d DESCRIPTION   One-paragraph description

Example:
  $0 -t feat -s cli -n add-doctor -d "Add doctor verb for read-only audit."
EOF
  exit 1
}

TYPE=""
SCOPE=""
NAME=""
DESCRIPTION=""

while getopts "t:s:n:d:h" opt; do
  case $opt in
    t) TYPE="$OPTARG" ;;
    s) SCOPE="$OPTARG" ;;
    n) NAME="$OPTARG" ;;
    d) DESCRIPTION="$OPTARG" ;;
    h|*) usage ;;
  esac
done

if [ -z "$TYPE" ] || [ -z "$SCOPE" ] || [ -z "$NAME" ] || [ -z "$DESCRIPTION" ]; then
  echo -e "${RED}ERROR: All of -t, -s, -n, -d are required${NC}" >&2
  usage
fi

VALID_TYPES="feat fix breaking perf security refactor build"
if ! echo " $VALID_TYPES " | grep -q " $TYPE "; then
  echo -e "${RED}ERROR: Invalid type '$TYPE'${NC}" >&2
  echo "Valid types: $VALID_TYPES" >&2
  exit 1
fi

if ! echo "$NAME" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*$'; then
  echo -e "${RED}ERROR: NAME must be kebab-case (lowercase, digits, hyphens): '$NAME'${NC}" >&2
  exit 1
fi

if ! echo "$SCOPE" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*$'; then
  echo -e "${RED}ERROR: SCOPE must be kebab-case: '$SCOPE'${NC}" >&2
  exit 1
fi

# Resolve repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
CHANGES_DIR="$REPO_ROOT/.changes"
mkdir -p "$CHANGES_DIR"

FILE="$CHANGES_DIR/$NAME.$TYPE.md"

if [ -e "$FILE" ]; then
  echo -e "${YELLOW}WARNING: $FILE already exists — refusing to overwrite${NC}" >&2
  exit 1
fi

TYPE_UPPER=$(echo "$TYPE" | tr '[:lower:]' '[:upper:]')

cat > "$FILE" <<EOF
---
type: $TYPE_UPPER
scope: $SCOPE
---

$DESCRIPTION
EOF

echo -e "${GREEN}Created fragment: $FILE${NC}"
