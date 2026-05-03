#!/usr/bin/env bash
# Secret scanning — runs gitleaks against staged changes.
# AI-assisted commits leak secrets at higher rates than human ones.
# Mechanical prevention beats instructions every time.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if ! command -v gitleaks >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ gitleaks not installed — skipping secret scan${NC}"
    echo -e "${YELLOW}  Install: https://github.com/gitleaks/gitleaks${NC}"
    echo -e "${YELLOW}  macOS:   brew install gitleaks${NC}"
    exit 0
fi

echo -e "${YELLOW}🔍 scanning staged changes for secrets...${NC}"

if gitleaks protect --staged --redact --no-banner --verbose; then
    echo -e "${GREEN}✓ no secrets detected${NC}"
    exit 0
else
    echo -e "${RED}✗ secrets detected — commit blocked${NC}"
    echo -e "${YELLOW}Remove the secret, then re-stage and commit.${NC}"
    echo -e "${YELLOW}If this is a false positive, add an inline allowlist comment${NC}"
    echo -e "${YELLOW}or update .gitleaks.toml — never bypass with --no-verify.${NC}"
    exit 1
fi
