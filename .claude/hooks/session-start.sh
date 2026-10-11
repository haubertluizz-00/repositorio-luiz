#!/bin/bash
# Prepara o HyperFrames (plugin hyperframes@hyperframes) para renderizar em sessões na nuvem.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Garante o plugin declarado em .claude/settings.json (no-op se já instalado).
if ! grep -qs '"hyperframes@hyperframes"' "$HOME/.claude/plugins/installed_plugins.json"; then
  claude plugin marketplace add heygen-com/hyperframes --scope project || true
  claude plugin install hyperframes@hyperframes --scope project || true
fi

# O container já traz o Chrome Headless Shell do Playwright; evita baixar outro.
HEADLESS_SHELL="$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$HEADLESS_SHELL" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export HYPERFRAMES_BROWSER_PATH=\"$HEADLESS_SHELL\"" >> "$CLAUDE_ENV_FILE"
fi

# Pré-aquece no cache do npx a versão do CLI fixada pelo plugin.
PLUGIN_JSON="$(ls -d "$HOME"/.claude/plugins/cache/hyperframes/hyperframes/*/plugin.json 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$PLUGIN_JSON" ]; then
  VERSION="$(node -p "require('$PLUGIN_JSON').version")"
  npx --yes "hyperframes@$VERSION" --version >/dev/null 2>&1 || true
fi
