# エージェントワークフロー

Claude Code（や他の AI コーディングエージェント）でこのリポジトリを開発するための作業マニュアルです。オーケストレーションの入口、自動で動くレイヤー、メンテナンスループ、構成要素の役割を説明します。

判断の「なぜ」は [ADR 一覧](./adr/README.md) を参照。コーディングルールは [`AGENTS.md`](../AGENTS.md) に集約され、毎セッションにロードされます ([ADR-0008](./adr/0008-consolidate-rules-into-agents-md.md))。

---

## TL;DR

> **`/start-workflow` → Aegis がコンテキスト絞り込み → 実装 (parent が直接。委譲はコンテキスト影響で判断) → `/review-diff` (multi-agent レビュー + コミットゲート stamp) → commit → PR**
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
  │     非自明な状態遷移 (ウィザード · 認証フロー · 非同期ガード · 権限分岐)
  │     → specs/<feature>.spec.md を書いて /verify-spec で反例探索 (ADR-0010)。
  │       CONFIRMED の反例を設計に反映してから実装へ。
  │
  ├ 5. Implement (parent が直接実装。委譲はコンテキスト影響で判断)
  │     大量のファイル読み・ログ掘り → Explore subagent (model: haiku)。
  │     独立並列ユニット → 複数 general-purpose (model: sonnet) を
  │     1 メッセージで並列 dispatch。TDD 対象 → superpowers:test-driven-development。
  │
  ├ 6. レビュー (review-diff dynamic workflow)
  │     diff を読む。typecheck / test 実行。
  │     Workflow({ name: "review-diff" }) — バグハント finder レーン + 規約レーン
  │     (code-reviewer) を並列展開 → (file, line) 重複排除 → 独立コンテキストで
  │     反証検証 (CONFIRMED / PLAUSIBLE / REFUTED) → 重大度順 findings →
  │     コミットゲートを stamp。指摘は parent が直接修正。
  │     Workflow が使えない環境では code-reviewer agent を直接 dispatch する
  │     (モデルは agent 定義に従う。同様に stamp される)。
  │
  ├ 7. commit (ユーザー確認後)
  │     目的ごとに分割 (1 コミット = 1 つの revert 可能な意図)。
  │
  └ 8. PR (ユーザー確認後)
        gh pr create。英語サマリー + 末尾に生成クレジット。
```

参照：
- オーケストレーション設計と根拠: [ADR-0006](./adr/0006-orchestration-layering.md)
- レビューワークフローの設計と根拠: [ADR-0009](./adr/0009-unified-review-workflow.md)
- subagent dispatch ルール: [`AGENTS.md`](../AGENTS.md) の Agents セクション, [ADR-0003](./adr/0003-subagent-driven-implementation.md)
- コミット分割規律: [`AGENTS.md`](../AGENTS.md) の Commits セクション

---

## 構成要素

### Rules (`AGENTS.md`)

エージェントが毎セッションでロードするコーディング規約。Design Philosophy / Knowledge Currency / Code Practices / Rules of React / Testing / Commits / Agents の各セクションとして `AGENTS.md` に凝縮されている。パススコープの詳細ルール (`.claude/rules/react.md`、`design.md`) は対象パスのファイル編集時に自動ロードされる — ただし subagent には自動ロードされないため、レビューの規約レーンは明示的に読み込む (ADR-0009)。

参照: [ADR-0008](./adr/0008-consolidate-rules-into-agents-md.md) (旧構成: [ADR-0001](./adr/0001-coding-rules-via-claude-rules-include.md))

### Hooks (`.claude/hooks/`)

Claude Code のイベントに応じて自動実行されるシェルスクリプト。

| Hook | イベント | 役割 |
|------|---------|------|
| `session-start-aegis-hydrate.sh` | SessionStart | aegis-share/source から .aegis/aegis.db を構築 (未構築時のみ) |
| `user-prompt-skill-reminder.sh` | UserPromptSubmit | 毎プロンプトで planning / brainstorming / implementation のリマインダーを注入 |
| `pre-aegis-intent-tags-guard.sh` | PreToolUse (aegis_compile_context) | `intent_tags` が指定されていなければブロック |
| `pre-agent-aegis-guard.sh` | PreToolUse (Agent) | subagent dispatch 前に aegis_compile_context が呼ばれていなければブロック |
| `pre-aegis-clear-review-stamp.sh` | PreToolUse (aegis_compile_context) | 新しい実装サイクル開始時に `.review-stamp` を削除 |
| `pre-workflow-clear-review-stamp.sh` | PreToolUse (Workflow) | review-diff 起動時に `.review-stamp` を削除 — ゲートを当該実行が所有する (ADR-0009) |
| `pre-commit-review-reminder.sh` | PreToolUse (Bash) | `.review-stamp` が無い `git commit` をブロック (レビュー必須ゲート) |
| `post-agent-review-stamp.sh` | PostToolUse (Agent) | code-reviewer 直接 dispatch 完了時に `.review-stamp` を作成 (フォールバック経路) |
| `post-aegis-near-miss-warn.sh` | PostToolUse (aegis_compile_context) | `near_miss_edges` の `glob_no_match` を警告 |
| `post-aegis-share-sync.sh` | PostToolUse (aegis_sync_docs / import_doc) | DB → `aegis-share/` を format → lint → materialize → export で同期 |
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

### Workflows (`.claude/workflows/`)

`Workflow({ name })` またはスラッシュコマンドで起動する保存済み dynamic workflow。複数 subagent の並列オーケストレーション (fan-out / 検証 / 集約) を JS スクリプトで決定論的に制御する。エージェントに委ねるのは「読む・判断する」だけで、フロー制御・重複排除・集計はスクリプト側の純粋ロジックが担う。

#### `/review-diff` — プリコミットレビュー ([ADR-0009](./adr/0009-unified-review-workflow.md))

```
起動: Workflow({ name: "review-diff", args: { effort: "standard" | "high" } })
      ユーザーは /review-diff。起動時に PreToolUse(Workflow) フックが
      .review-stamp を削除 — コミットゲートは常に「今回の実行」が所有する。

Phase 1: Find — 並列 finder レーン (バリア同期: 全レーン完了後に重複排除)
  ├ logic      境界条件 / off-by-one / 条件反転 / null·undefined        [sonnet]
  ├ state      競合状態 / stale closure / effect 依存 / 二重送信        [sonnet]
  ├ integrity  エラー握り潰し / 失敗経路欠落 / 部分書き込み / 境界検証  [sonnet]
  ├ cleanup    重複 / dead code / 過剰な複雑さ / 周辺規約からの逸脱     [sonnet]
  ├ security   injection / authz 欠落 / secrets / XSS      (high のみ)  [sonnet]
  ├ contracts  型エスケープ / API·schema 契約破壊          (high のみ)  [sonnet]
  └ rules      code-reviewer agent を agentType で再利用。AGENTS.md +
               diff に該当するパススコープ rules を明示的に読む         [sonnet]
  · 各レーンは coverage-first — 「確信が持てなくても全部報告しろ、
    フィルタは下流の verify がやる」。finder の自己検閲による recall
    低下を防ぐ (最近のモデルは保守的な報告指示に字義通り従うため)。
  · 出力は StructuredOutput で schema 強制:
    { file, line, title, description, severity(critical|major|minor), rule? }

重複排除 (スクリプト内の純粋ロジック。エージェント不使用)
  · (file, line) をキーに統合。最高 severity の候補が生き残り、他レーンの
    { lane, title, severity } は alsoFoundBy として findings に残る。
  · 同一行に載った「別々のバグ」は 1 件に潰れる — 意図的なトレードオフ
    (title をキーに含めると同一バグの言い換えが全て素通りし検証コストが倍増)。

Phase 2: Verify — 候補 1 件ごとに独立の懐疑的検証 (finder ≠ verifier)
  · プロンプトは「反証せよ (try to REFUTE)」。実コードを読んで failure
    scenario を追跡し、規約指摘は AGENTS.md のスコープ限定子も確認。      [sonnet]
  · standard: reproduction レンズ 1 体 / high: correctness · reproduction ·
    scope の 3 レンズ並列 → 過半数が REFUTED なら棄却。
  · 判定: CONFIRMED (実コードで追跡できた) / PLAUSIBLE (妥当だが未追跡) /
    REFUTED (成立しない → 報告から除外)。severity の再格付けも可能。
  · verifier が 1 体も完走しなかった候補は PLAUSIBLE (unverified) として
    報告に残す — 黙って落とさない (fail-closed)。

ランキング (スクリプト内): CONFIRMED → PLAUSIBLE、同順位内は
  critical → major → minor。REFUTED はここに到達しない。

Phase 3: Stamp — 全レーンが完走したときのみ実行                          [haiku]
  · `touch .claude/.review-stamp && ls .claude/.review-stamp &&
    echo STAMP_CONFIRMED` — マーカーは ls 成功時にしか出力されないため、
    エラー出力への部分一致で誤って gateStamped: true になることはない。
  · レーン失敗時はスキップして gateStamped: false — ゲートは閉じたまま。

返り値: { effort, gateStamped, findings[],
          stats: { candidates, deduped, refuted, unverified, lanesFailed } }
```

補足:

- **ゲートのライフサイクル**: `.claude/.review-stamp` は (a) review-diff 起動時と (b) 新しい aegis サイクル開始時に削除され、(c) review-diff 完走時または (d) code-reviewer 直接 dispatch 完了時 (フォールバック) に作成される。存在しない間、`git commit` は PreToolUse フックがブロックする。
- **モデル**: 全レビューレーン `sonnet` (明確に弱い結果が出たときだけ `FINDER_MODEL` / `VERIFY_MODEL` を `opus` にして再実行)、stamp は `haiku`。規約レーンは code-reviewer agent 定義のモデルを継承する。
- **規模感の実測**: 差分の大きさに応じて 1 実行あたり 9〜17 エージェント。反証検証は毎回 2〜3 件の「もっともらしいだけの誤検出」を落としている。
- **findings の消費者は parent**: ワークフローは報告までが責務で、修正は parent が直接行う (start-workflow ステップ 6)。

#### `/verify-spec` — 設計時の反例探索 ([ADR-0010](./adr/0010-agent-based-spec-verification.md))

FSL の「実装前に状態機械として仕様を書き、反例を探す」規律を、fslc の代わりにエージェントで実行する design-time ツール。`specs/<feature>.spec.md` (states / actions(requires/ensures) / invariants / forbidden flows / requirements — 形式は [`specs/README.md`](../specs/README.md)) を入力に取る。

```
起動: Workflow({ name: "verify-spec", args: { spec: "specs/x.spec.md", depth?: 8 } })

Formalize (1 体)   仕様を構造化状態機械に正規化し、曖昧さ (未定義状態 ·
                   ガード欠落 · 非決定的遷移 · 根拠のない要求) を指摘   [sonnet]
Hunt (並列 4 レーン) invariant 違反 / forbidden flow 到達 / デッドロック ·
                   ライブロック / 要求と設計の不整合 — 戻る · リロード ·
                   二重送信 · 権限変更を武器に深さ depth 以内の反例
                   トレースを構成                                        [sonnet]
Verify             反例を 1 ステップずつ独立コンテキストが再生し、
                   全遷移の合法性と違反の成立を検査 → CONFIRMED /
                   PLAUSIBLE / REFUTED                                   [sonnet]

返り値: { ambiguities, counterexamples[], stats }
```

review-diff と同じ find → adversarial verify 構造だが、**対象はコードではなく設計**で、コミットゲートには関与しない (advisory)。エージェント探索は網羅的証明ではない — 将来 fslc が成熟したら `.spec.md` → `.fsl` への移行パスがある。

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
[コミットゲート] — .review-stamp が無い git commit をブロック
  (stamp は review-diff 完走時 or code-reviewer dispatch 完了時に作成、
   review-diff 起動時と新しい aegis サイクル開始時にクリア)
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
| レビューだけ再実行したい | `/review-diff` を直接起動 (`{effort: "high"}` で深掘り) |
| 設計の状態遷移だけ検証したい | `/verify-spec` を直接起動 (`{spec: "specs/x.spec.md"}`) |
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
| コーディングルール | [`AGENTS.md`](../AGENTS.md) + [`.claude/rules/`](../.claude/rules/) (パススコープ) |
| スキル | [`.claude/skills/`](../.claude/skills/) |
| ワークフロー | [`.claude/workflows/`](../.claude/workflows/) |
| 状態機械の仕様 | [`specs/`](../specs/) |
| Hooks | [`.claude/hooks/`](../.claude/hooks/) + [`.claude/settings.json`](../.claude/settings.json) `hooks` |
| パーミッション | [`.claude/settings.json`](../.claude/settings.json) `permissions` |
| MCP サーバー | [`.mcp.json`](../.mcp.json), [`.claude/settings.json`](../.claude/settings.json) `enabledMcpjsonServers` |
| プラグイン | [`.claude/settings.json`](../.claude/settings.json) `enabledPlugins` |
| ADR | [`docs/adr/`](./adr/) |
| CI | [`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml) + [`scripts/audit-direct.sh`](../scripts/audit-direct.sh) |
| 依存自動更新 | [`.github/dependabot.yml`](../.github/dependabot.yml) |

