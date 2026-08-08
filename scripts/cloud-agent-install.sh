#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
export MISE_YES=1

if ! command -v mise >/dev/null 2>&1; then
  curl -fsSL https://mise.run | sh
fi

mise trust mise.toml
mise install

# --ignore-scripts: prepare(lefthook install)は Cursor が git hooksPath を
# 管理する環境では失敗するため飛ばす
mise exec -- bun install --frozen-lockfile --ignore-scripts

mise exec -- bun run generate-routes
mise exec -- bun run cf-typegen

# rc を読むシェル(対話・ログイン)に shims の PATH を通す。
# rc を読まないワンショットの非対話シェルには届かないため、そこでは
# `mise exec -- <cmd>` を使う(このスクリプト自身も上でそうしている)
shims_line='export PATH="$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"'
for rc in "$HOME/.bashrc" "$HOME/.profile"; do
  grep -qsF 'mise/shims' "$rc" || printf '%s\n' "$shims_line" >>"$rc"
done
