#!/usr/bin/env bash
# Install agentry's git hooks for this repo.
# Sets core.hooksPath to an absolute path so it works in worktrees too.

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo -e "${RED}Not in a git repository${NC}"
    exit 1
fi

HOOKS_DIR="$REPO_ROOT/.githooks"

if [ ! -d "$HOOKS_DIR" ]; then
    echo -e "${RED}.githooks/ directory not found at $HOOKS_DIR${NC}"
    exit 1
fi

# Make every hook + lib script executable
find "$HOOKS_DIR" -type f \( -name 'commit-msg' -o -name 'pre-commit' -o -name '*.sh' \) -exec chmod +x {} \;

git config core.hooksPath "$HOOKS_DIR"

echo -e "${GREEN}✓ git hooks installed${NC}"
echo -e "  core.hooksPath = $HOOKS_DIR"

if ! command -v gitleaks >/dev/null 2>&1; then
    echo -e "${YELLOW}ℹ gitleaks not found — secret scan will be skipped${NC}"
    echo -e "${YELLOW}  Install:  brew install gitleaks  (or see https://github.com/gitleaks/gitleaks)${NC}"
fi
