#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
cd "$HOME/parity" && exec ./node_modules/.bin/tsx src/mcp.ts
