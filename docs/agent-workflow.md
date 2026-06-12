# エージェントワークフロー

Claude Code（や他の AI コーディングエージェント）でこのリポジトリを開発するための作業マニュアルです。オーケストレーションの入口、自動で動くレイヤー、メンテナンスループ、構成要素の役割を説明します。

判断の「なぜ」は [ADR 一覧](./adr/README.md) を参照。コーディングルールは [`AGENTS.md`](../AGENTS.md) に集約され、毎セッションにロードされます ([ADR-0008](./adr/0008-consolidate-rules-into-agents-md.md))。

---

## TL;DR

> **`/start-workflow` → Aegis がコンテキスト絞り込み → 実装 (原則 subagent に委譲、trivial は parent 直接) → レビュー → commit → PR**
> パーミッション・hooks・AGENTS.md が安全性と品質を自動で担保。

`/start-workflow` はエージェントが ticket 粒度の作業を検知して自律的に invoke する（手動でも呼べる）。commit / PR はエージェントが提案し、ユーザー確認後に実行する。

---

## タスクフロー

```
リクエスト受信
  │
  ├─ trivial? (1 行修正 · typo · config 1 値 · docs のみ)
  │   └─ YES → 直接対応 → commit (ユーザー確認後)
  │
  ↓ NO (= チケット粒度の作業)

/start-workflow
  ├ 1. Clarify
  │     受入基準が曖昧なら 1 つだけ質問する。
  │
  ├ 2. コンテキスト収集 (Aegis)
  │     aegis_compile_context({ target_files, plan, intent_tags })
  │     → 関連するルール / ADR を relevance スコア付きで返す。
  │
  ├ 3. ADR チェック
  │     非自明な設計判断？ → docs/adr/NNNN-*.md を先に起票。
  │     純粋な機械作業？ → スキップ。
  │
  ├ 4. Plan
  │     短いブリーフィング: 目的 · 対象ファイル · 受入基準 · 検証手順。
  │     複雑な作業 → superpowers:writing-plans に委譲。
  │     要件があいまい → superpowers:brainstorming を先に実行。
  │
  ├ 5. Dispatch (原則。trivial 寄りの作業は parent が直接編集してもよい)
  │     Agent({ subagent_type: "general-purpose", model: "sonnet", prompt: <briefing> })
  │     独立サブタスク → 複数 Agent を 1 メッセージで並列 dispatch。
  │     TDD 対象 → superpowers:test-driven-development。
  │
  ├ 6. レビュー
  │     diff を読む。typecheck / test 実行。ブランチ網羅漏れ、
  │     dead code、null/off-by-one バグパターンをチェック。
  │     code-reviewer agent (model: opus) を未コミット diff に dispatch。
  │
  ├ 7. commit (ユーザー確認後)
  │     目的ごとに分割 (1 コミット = 1 つの revert 可能な意図)。
  │
  └ 8. PR (ユーザー確認後)
        gh pr create。英語サマリー + 末尾に生成クレジット。
```

参照：
- オーケストレーション設計と根拠: [ADR-0006](./adr/0006-orchestration-layering.md)
- subagent dispatch ルール: [`AGENTS.md`](../AGENTS.md) の Agents セクション, [ADR-0003](./adr/0003-subagent-driven-implementation.md)
- コミット分割規律: [`AGENTS.md`](../AGENTS.md) の Commits セクション

---

## 構成要素

### Rules (`AGENTS.md`)

エージェントが毎セッションでロードするコーディング規約。Design Philosophy / Knowledge Currency / Code Practices / Rules of React / Testing / Commits / Agents の各セクションとして `AGENTS.md` に凝縮されている。詳細版の rules ファイル群 (`.claude/rules/`) は廃止済み。

参照: [ADR-0008](./adr/0008-consolidate-rules-into-agents-md.md) (旧構成: [ADR-0001](./adr/0001-coding-rules-via-claude-rules-include.md))

### Hooks (`.claude/hooks/`)

Claude Code のイベントに応じて自動実行されるシェルスクリプト。

| Hook | イベント | 役割 |
|------|---------|------|
| `session-start-aegis-hydrate.sh` | SessionStart | aegis-share/source から .aegis/aegis.db を構築 (未構築時のみ) |
| `user-prompt-skill-reminder.sh` | UserPromptSubmit | 毎プロンプトで planning / brainstorming / implementation のリマインダーを注入 |
| `pre-aegis-intent-tags-guard.sh` | PreToolUse (aegis_compile_context) | `intent_tags` が指定されていなければブロック |
| `pre-agent-aegis-guard.sh` | PreToolUse (Agent) | subagent dispatch 前に aegis_compile_context が呼ばれていなければブロック |
| `post-aegis-near-miss-warn.sh` | PostToolUse (aegis_compile_context) | `near_miss_edges` の `glob_no_match` を警告 |
| `stop-quality-gate.sh` | Stop | typecheck + lint + format + knip + similarity を実行、失敗でブロック |
| `stop-aegis-sync-check.sh` | Stop | `docs/adr/` に差分があるのに `aegis_sync_docs` / `aegis_import_doc` が未実行なら警告 |

### Skills (`.claude/skills/`)

`/skill-name` で明示呼び出しするタスクテンプレート。

| スキル | 説明 |
|--------|------|
| `/start-workflow` | チケット粒度の作業開始。clarify → Aegis → plan → dispatch → review → commit の全フロー |
| `/remove-db` | DB / 認証 / ストレージの外科的除去 |
| `/empirical-prompt-tuning` | スキル / プロンプトの反復改善 |
| `/launch-checklist` | リリース前の総合監査 (セキュリティ / SEO / OGP / a11y 等) |
| `/lighthouse-audit` | 全ページの Lighthouse 監査 (a11y / SEO / best practices) |
| `/performance-audit` | Core Web Vitals の計測と改善 |
| `/react-doctor` | React 診断 (lint / a11y / バンドル / アーキテクチャ) |
| `/aegis-setup` | Aegis ナレッジベースの初期構築 |
| `/aegis-bulk-import` | ルール / ADR の一括インポート |
| `/aegis-triage` | pending observations の分析・proposal 生成 |

### Plugins

Claude Code のプラグインとして有効化されている拡張。

| プラグイン | 役割 |
|-----------|------|
| `superpowers` | brainstorming / writing-plans / test-driven-development / code-review 等のスキル群 |
| `chrome-devtools-mcp` | ブラウザ操作（スクリーンショット・クリック・Lighthouse）— MCP はプラグイン経由で提供 |
| `typescript-lsp` | LSP 連携（型情報・シンボル検索） |

### MCP サーバー (`.mcp.json`)

外部ツールとの接続。

| サーバー | 役割 |
|----------|------|
| `aegis` | コンテキストコンパイラ（ADR の決定論的絞り込み） |
| `aegis-admin` | Aegis 管理操作（import / triage / proposal 承認） |
| `context7` | ライブラリドキュメント取得（React, TanStack, Tailwind 等） |

chrome-devtools は `.mcp.json` ではなく `chrome-devtools-mcp` プラグイン経由で提供される。

### パーミッション (`.claude/settings.json`)

| レベル | 対象 | 例 |
|--------|------|-----|
| `deny` | 破壊的操作 | `rm -rf`, `git push --force`, `git reset --hard`, `.env` アクセス |
| `ask` | 確認が必要な操作 | `git commit`, `git push`, `gh pr create`, `deploy`, `rm`, `mv` |
| `allow` | 自由に実行可能 | read-only git/gh, `bun run`, `bun add -E`, `tree`/`find`/`grep` |

参照: [ADR-0004](./adr/0004-permission-deny-as-security-boundary.md)

---

## 自動レイヤー（手動操作不要）

```
[パーミッション] — 破壊的操作を物理的に拒否
[Pre-edit hooks] — Aegis / subagent dispatch の前提条件を強制
[Post-edit hook] — 編集ごとに lint + typecheck
[Stop hook チェーン]
  1. stop-quality-gate.sh:    typecheck + lint + format + knip + similarity
  2. stop-aegis-sync-check.sh: docs/adr/ 変更時の aegis 同期漏れを警告
[常時ロードされるプロンプト]
  · AGENTS.md — 全規約を集約 (Design Philosophy / Knowledge Currency / Code Practices /
    Rules of React / Testing / Commits / Agents / Aegis セクション)
  · CLAUDE.md → @AGENTS.md (メンションのみ)
```

---

## メンテナンスループ

### 依存関係

```
[Dependabot]  weekly
  · npm:           versioning-strategy: increase (exact pinning 維持)
  · github-actions: SHA pin 更新も含む
[CI (PR/push to main)]
  · bun install --frozen-lockfile
  · scripts/audit-direct.sh:  直接依存はブロック、推移的依存は情報のみ
  · check + test + typecheck + build
```

参照: [ADR-0002](./adr/0002-direct-deps-only-audit.md), [`scripts/audit-direct.sh`](../scripts/audit-direct.sh)

### Aegis ナレッジベース

```
[新しいルール / ADR の追加]
  aegis_import_doc({ file_path, doc_id, kind, edge_hints, tags })
  → proposal 生成 → aegis_approve_proposal で承認

[既存ルールの編集]
  aegis_sync_docs()
  → content_hash の差分検出 → update_doc proposals → 承認

[compile miss フィードバック]
  aegis_observe({ event_type: "compile_miss", ... })
  → /aegis-triage で分析 → proposals → 承認
```

### ADR

非自明な設計判断がされたら新しい ADR を追加。MADR-lite テンプレートを使用（[`docs/adr/README.md`](./adr/README.md) 参照）。番号は厳密に連番、絶対に振り直さない。

### スキル / プロンプトのチューニング

スキルを新規作成または大幅編集する場合は [`/empirical-prompt-tuning`](../.claude/skills/empirical-prompt-tuning/SKILL.md) を使う。新しい subagent で反復テストし、2 回連続で新たな曖昧さが出なくなるまで改善。

---

## 特殊フロー

| 状況 | 対応 |
|------|------|
| 原因不明のバグ | `/start-workflow` ステップ 4 の前に `superpowers:systematic-debugging` を挿入 |
| 真の並列マルチエージェント作業 | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` を使用。単一タスクは単一 subagent で |
| `start-workflow` 自体の編集 | `/empirical-prompt-tuning` で検証してからマージ |
| テンプレートから DB/認証/ストレージを除去 | `/remove-db` スキルで一括除去 |
| 推移的依存の脆弱性 | upstream を追跡。`package.json` overrides は追加しない (ADR-0002) |

---

## ユーザーの操作レベル

**エージェントが自律判断**:
- `/start-workflow` — ticket 粒度の作業を検知したら自動 invoke（ユーザーが明示的に呼ばなくてもよい）

**確認のみ**（エージェントが聞く）:
- commit / PR の実行（エージェントが分割案を提案し、ユーザーが承認）
- 「この判断に ADR を書きますか？」
- compile-miss の triage
- GitHub の Dependabot PR 承認

**完全自動**（失敗しない限り意識不要）:
- 全 hooks (pre/post/stop)
- CI ゲート
- パーミッション拒否

---

## ファイル配置一覧

| 関心事 | 場所 |
|--------|------|
| コーディングルール | [`AGENTS.md`](../AGENTS.md) |
| スキル | [`.claude/skills/`](../.claude/skills/) |
| Hooks | [`.claude/hooks/`](../.claude/hooks/) + [`.claude/settings.json`](../.claude/settings.json) `hooks` |
| パーミッション | [`.claude/settings.json`](../.claude/settings.json) `permissions` |
| MCP サーバー | [`.mcp.json`](../.mcp.json), [`.claude/settings.json`](../.claude/settings.json) `enabledMcpjsonServers` |
| プラグイン | [`.claude/settings.json`](../.claude/settings.json) `enabledPlugins` |
| ADR | [`docs/adr/`](./adr/) |
| CI | [`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml) + [`scripts/audit-direct.sh`](../scripts/audit-direct.sh) |
| 依存自動更新 | [`.github/dependabot.yml`](../.github/dependabot.yml) |

