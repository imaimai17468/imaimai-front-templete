# エージェントワークフロー

Claude Code でこのリポジトリを開発するための作業マニュアル。判断の「なぜ」は [ADR 一覧](./adr/README.md)、コーディングルールは [`AGENTS.md`](../AGENTS.md) を参照。

---

## TL;DR

> **`/start-workflow` → Aegis → 設計 → 実装 → `/review-diff` → commit → PR**
>
> 3 つの基盤がエージェントの判断を支える:
>
> - **Aegis** = 「何に従うか」 — ファイルパスとコマンドからエッジを辿り、関連する ADR / ルールだけを決定論的に返すコンテキストコンパイラ
> - **コードグラフ** = 「何に影響するか」 — `src/` の import 依存を静的解析した `.claude/code-graph.json` をワークフローのエージェントに注入し、重複探索を排除
> - **Superpowers** = 「どう進めるか」 — brainstorming → writing-plans → TDD → finishing の方法論スキル群
>
> 2 つのワークフローが品質を検証する:
>
> - `/verify-spec` = **作る前に壊す** — 仕様を状態機械として書き、エージェントが穴を突く
> - `/review-diff` = **作った後に壊す** — バグハント + 規約チェックを並列で走らせ、反証検証する。通らないとコミットできない
>
> パーミッション・hooks が安全性を自動で担保。

`/start-workflow` はエージェントが ticket 粒度の作業を検知して自律的に invoke する（手動でも呼べる）。commit / PR はエージェントが提案し、ユーザー確認後に実行する。

---

## 1. タスクフロー

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
  ├ 2. コンテキスト収集                          ← Aegis
  │     aegis_compile_context({ target_files, plan, intent_tags })
  │     → 関連するルール / ADR を relevance スコア付きで返す。
  │
  ├ 3. ADR チェック
  │     非自明な設計判断？ → docs/adr/NNNN-*.md を先に起票。
  │     純粋な機械作業？ → スキップ。
  │
  ├ 4. Plan                                     ← Superpowers
  │     短いブリーフィング: 目的 · 対象ファイル · 受入基準 · 検証手順。
  │     複雑な作業 → superpowers:writing-plans に委譲。
  │     要件があいまい → superpowers:brainstorming を先に実行。
  │     非自明な状態遷移 (ウィザード · 認証フロー · 非同期ガード · 権限分岐)
  │     → specs/<feature>.spec.md を書いて /verify-spec で反例探索 (ADR-0010)。
  │       CONFIRMED の反例を設計に反映してから実装へ。
  │
  ├ 5. Implement                                ← Superpowers + Aegis
  │     parent が直接実装。委譲はコンテキスト影響で判断。
  │     大量のファイル読み・ログ掘り → Explore subagent (model: haiku)。
  │     独立並列ユニット → 複数 general-purpose (model: sonnet) を
  │     1 メッセージで並列 dispatch。TDD 対象 → superpowers:test-driven-development。
  │
  ├ 6. レビュー                                  ← コードグラフ + Workflow
  │     diff を読む。typecheck / test 実行。
  │     Workflow({ name: "review-diff" }) — コードグラフで影響範囲を注入 →
  │     バグハント finder レーン + 規約レーン (code-reviewer) を並列展開 →
  │     (file, line) 重複排除 → 独立コンテキストで反証検証 →
  │     重大度順 findings → コミットゲートを stamp。
  │     指摘は parent が直接修正。
  │
  ├ 7. commit (ユーザー確認後)
  │     目的ごとに分割 (1 コミット = 1 つの revert 可能な意図)。
  │
  └ 8. PR (ユーザー確認後)
        gh pr create。英語サマリー + 末尾に生成クレジット。
```

参照: [ADR-0006](./adr/0006-orchestration-layering.md) (オーケストレーション), [ADR-0009](./adr/0009-unified-review-workflow.md) (レビュー), [ADR-0003](./adr/0003-subagent-driven-implementation.md) (subagent dispatch)

---

## 2. 三つの基盤

タスクフローの各ステップを支える 3 つの仕組み。それぞれ異なる問いに答える。

| 基盤 | 問い | 仕組み | 消費者 |
|------|------|--------|--------|
| **Aegis** | このファイルにどのルールが適用されるか？ | エッジで ADR / ルールを決定論的に絞り込み | 親セッション（実装前） |
| **コードグラフ** | この変更がどのファイルに影響するか？ | import 静的解析の依存グラフを注入 | ワークフローのサブエージェント（レビュー・検証時） |
| **Superpowers** | この作業をどの順でどう進めるか？ | 方法論スキル群が手順を強制 | 親セッション（計画・実装・完了時） |

### 2.1 Aegis — 「何に従うか」

ADR とルールをナレッジベースとして管理する **コンテキストコンパイラ**（MCP サーバー: `aegis` + `aegis-admin`）。LLM に全ドキュメントを読ませる代わりに、ファイルパスとコマンドからエッジを辿って必要なドキュメントだけを返す。

#### なぜ必要か

エージェントに全 ADR / 全ルールを毎回読ませると:
- 関係のないドキュメントがコンテキストを汚染し、判断精度が低下する
- トークンコストが膨らむ（10 件の ADR × 平均 3KB = 30KB が毎回ロード）
- 関連するドキュメントをエージェントが「推測で選ぶ」ため、取りこぼしが発生する

#### データモデル

```
aegis-share/                  ← git 管理のバンドル（チーム共有）
  source/
    documents/                ← ADR / ルールの Markdown（frontmatter 付き）
      adr-0001.md               doc_id: adr-0001, kind: reference
      design-system-rules.md    doc_id: design-system-rules, kind: guideline
    edges/
      path-requires.json      ← ファイルパス glob → doc_id
      command-requires.json   ← コマンド種別 → doc_id
  canonical.json              ← 全ドキュメントのバンドル
  manifest.json               ← knowledge_version / snapshot_id

.aegis/                       ← ローカル DB（gitignore 済み、SessionStart で自動構築）
  aegis.db                    ← SQLite — compile / observe / proposal の全データ
```

#### エッジの仕組み

| エッジ種別 | ソース | ターゲット | 例 |
|-----------|--------|-----------|-----|
| `path-requires` | ファイルパス glob | doc_id | `src/**/*` → `adr-0007` (TanStack Start Migration) |
| `command-requires` | コマンド名 | doc_id | `review` → `adr-0009` (Unified Review Workflow) |

`aegis_compile_context({ target_files, command, intent_tags })` を呼ぶと:
1. `target_files` の各パスに対して `path-requires` エッジをマッチ
2. `command` に対して `command-requires` エッジをマッチ
3. `intent_tags` があれば tag-mapping による expanded context を追加
4. 結果をバジェット内で `delivery: "inline"` / `"deferred"` / `"omitted"` に振り分けて返す

#### タスクフローでの使用箇所

```
/start-workflow
  ├ 2. コンテキスト収集
  │     aegis_compile_context({ target_files, plan, command, intent_tags })
  │     → 関連 ADR / ルールを relevance スコア付きで取得
  │
  ├ 5. Implement (subagent dispatch 時)
  │     pre-agent-aegis-guard.sh が compile_context 未呼び出しをブロック
  │     → dispatch 前に必ず Aegis を参照させる
  │
  └ 6. Review 後
        compile miss → aegis_observe() で報告 → /aegis-triage → proposal → 承認

コミット時 (docs/adr/ に変更がある場合):
  stop-aegis-sync-check.sh が同期漏れを警告
```

#### Aegis を支える 6 個のフック

| フック | 役割 |
|--------|------|
| `session-start-aegis-hydrate.sh` | `aegis-share/source` から `.aegis/aegis.db` を構築（未構築時のみ） |
| `pre-aegis-intent-tags-guard.sh` | `intent_tags` なしの `compile_context` をブロック |
| `pre-agent-aegis-guard.sh` | subagent dispatch 前に `compile_context` 未呼び出しをブロック |
| `pre-aegis-clear-review-stamp.sh` | 新しい Aegis サイクル開始時にレビューゲートをリセット |
| `post-aegis-near-miss-warn.sh` | エッジの glob がファイルにマッチしなかった場合に警告 |
| `post-aegis-share-sync.sh` | `sync_docs` / `import_doc` 後に DB → `aegis-share/` を同期 |

### 2.2 コードグラフ — 「何に影響するか」

`src/` 配下の全 TypeScript ファイルの import を静的解析し、ファイル間の依存関係を構造化した JSON ファイル (`.claude/code-graph.json`)。review-diff / verify-spec ワークフローが各サブエージェントにこのグラフを注入することで、エージェントごとの重複したコードベース探索を省略する。

#### なぜ必要か

review-diff は観点別に 5〜7 の finder エージェントを並列起動する。各エージェントは独立したコンテキストを持つため、diff の影響範囲を理解するために **全員が同じコードベースを個別に探索** していた。探索だけで全体のトークン消費の 30〜50% を占めていた。

コードグラフはこの「推測 → 探索」を「グラフ参照」に置き換える。

#### データモデル

```json
{
  "version": 1,
  "generated_at": "2026-07-03T12:00:00Z",
  "nodes": {
    "src/server/fn/user.ts": {
      "layer": "server",
      "imports": ["src/gateways/user/index.ts", "src/lib/auth.ts"],
      "imported_by": ["src/routes/__root.tsx", "src/routes/profile.tsx"]
    }
  }
}
```

| フィールド | 説明 |
|-----------|------|
| `layer` | パスから自動分類: `route` / `component` / `server` / `gateway` / `entity` / `lib` / `test` / `config` |
| `imports` | このファイルが依存するプロジェクト内ファイル（外部パッケージは除外） |
| `imported_by` | このファイルに依存するプロジェクト内ファイル |

#### 生成と鮮度維持

```
[生成] bun run graph (scripts/build-graph.ts)
  · TypeScript Compiler API で src/ の全 .ts/.tsx をパース
  · tsconfig.json の paths エイリアス (@/* → ./src/*) を正しく解決
  · .d.ts / routeTree.gen.ts は除外
  · 追加依存なし (typescript は既存の devDependencies)

[自動更新] pre-commit-graph-refresh.sh (PreToolUse hook)
  · git commit 時に src/ に変更があれば bun run graph を実行
  · 生成された code-graph.json を自動ステージ

[差分抑制] .gitattributes: .claude/code-graph.json -diff
```

#### ワークフローでの消費方法

**review-diff (Phase 0: Graph)**:
1. haiku エージェントが変更ファイル一覧を取得
2. `code-graph.json` を読み込み（存在しなければ `bun run graph` を実行）
3. 変更ファイル + depth-1 隣接ノードのサブグラフを抽出
4. 全 finder / verifier のプロンプトに注入 + 「このグラフ外を探索するな」制約を付与

**verify-spec (Phase 1: Formalize に統合)**:
1. 仕様の状態・アクションに対応するソースファイルを特定
2. depth-1 サブグラフを `file_graph` として返す
3. hunter がファイル依存をグラフから把握

#### トークン削減効果

```
Before:  finder × 5 = [diff] + [コード探索 ×5] + [分析 ×5]
                                ~~~~~~~~~~~~
                                全体の 30-50% が重複探索

After:   graph scout ×1 (haiku) + finder × 5 = [diff] + [グラフ参照 ×5] + [分析 ×5]
         ~~~~~~~~~~~~~~~~~~~~                           ~~~~~~~~~~~~~~
         追加 ~15k tokens                               探索 → 参照で大幅削減

推定: finder フェーズ全体で 30-40% のトークン削減
```

#### Aegis との住み分け

| 観点 | Aegis | コードグラフ |
|------|-------|-------------|
| **対象** | ADR / ルールドキュメント | ソースファイル間の import 依存 |
| **関係の種類** | `path → document`, `command → document` | `file → file` (imports / imported_by) |
| **消費者** | 親セッション（実装前） | ワークフローのサブエージェント（レビュー・検証時） |
| **更新** | ADR 編集時に手動（フックが漏れを警告） | `src/` コミット時に自動再生成 |
| **目的** | 「何に従うか」 | 「何に影響するか」 |

両者は補完関係にあり、統合はしない。

### 2.3 Superpowers — 「どう進めるか」

タスクの進め方をガイドする方法論スキル群（プラグイン: `superpowers@claude-plugins-official`）。`/start-workflow` の各ステップから呼び出されるか、フックのリマインダー経由でエージェントが自律的に invoke する。superpowers 自身はコードを書かない — **「何をどの順でやるか」を決める指揮レイヤー**。

#### タスクフローでの使用箇所

```
/start-workflow
  ├ 1. Clarify       ← (superpowers なし — start-workflow 内で完結)
  ├ 2. Aegis         ← (superpowers なし — MCP 直接呼び出し)
  ├ 3. ADR           ← (superpowers なし)
  ├ 4. Plan          ← superpowers:writing-plans
  │     · 要件が曖昧 → superpowers:brainstorming を先に実行
  │     · 状態遷移複雑 → specs/ を書いて /verify-spec
  ├ 5. Implement     ← superpowers:test-driven-development (純関数)
  │                     superpowers:subagent-driven-development (並列 dispatch)
  ├ 6. Review        ← /review-diff (ワークフロー直接。superpowers 経由ではない)
  └ 7. Commit / PR   ← superpowers:finishing-a-development-branch
```

#### 主要スキル

| スキル | いつ | 何をする |
|--------|------|---------|
| `brainstorming` | 要件が曖昧 / 複数アプローチ / UI 設計 | 1 問ずつ対話し、2-3 アプローチを比較して設計を確定 |
| `writing-plans` | 設計確定後、実装前 | ファイル単位の実装計画（テスト → 実装 → 検証 → コミット） |
| `test-driven-development` | 純関数・well-specified なロジック | Red → Green → Refactor の TDD サイクルを強制 |
| `subagent-driven-development` | 並列タスクの dispatch | タスクを独立 subagent に振り分け、2 段階レビュー |
| `executing-plans` | インライン実行 | 計画のステップを順番に実行、チェックポイントでレビュー |
| `finishing-a-development-branch` | 全タスク完了後 | テスト通過確認、merge / PR / cleanup の選択肢提示 |
| `systematic-debugging` | 原因不明のバグ | 仮説 → 検証 → 絞り込み。推測で直すことを禁止 |
| `verification-before-completion` | 完了報告前 | typecheck / lint / テストを実行し、証拠なき完了を防ぐ |

#### 使わないとき

- 1 行修正 / typo / config 変更 → 直接対応
- docs-only な変更 → 直接対応
- コードベースの質問 → Aegis + 直接回答
- ワークフロー実行 → Workflow ツールで直接起動

---

## 3. ワークフロー詳細

`.claude/workflows/` に保存された dynamic workflow。複数エージェントを観点別に並列展開し、各指摘・各反例を独立したエージェントが反証する **find → adversarial verify** パイプラインが共通の骨格。

どちらも「見つけた人 ≠ 検証する人」を徹底する。

### 3.1 `/review-diff` — 作った後に壊す

コードを書いた後に、**「本当にバグっていないか？ 規約に違反していないか？」** を複数のエージェントが並列で探し、各指摘を別のエージェントが反証する。通らないとコミットできない。

参照: [ADR-0009](./adr/0009-unified-review-workflow.md)

```
起動: Workflow({ name: "review-diff", args: { effort: "standard" | "high" } })
      ユーザーは /review-diff。起動時に .review-stamp を削除。

Phase 0: Graph                                                           [haiku]
  · .claude/code-graph.json から変更ファイル + depth-1 隣接のサブグラフを抽出。
  · 以降の全エージェントにグラフを注入し、コードベースの独立探索を省略。

Phase 1: Find — 並列 finder レーン (バリア同期: 全完了後に重複排除)
  ├ logic      境界条件 / off-by-one / 条件反転 / null·undefined        [sonnet]
  ├ state      競合状態 / stale closure / effect 依存 / 二重送信        [sonnet]
  ├ integrity  エラー握り潰し / 失敗経路欠落 / 部分書き込み / 境界検証  [sonnet]
  ├ cleanup    重複 / dead code / 過剰な複雑さ / 周辺規約からの逸脱     [sonnet]
  ├ security   injection / authz 欠落 / secrets / XSS      (high のみ)  [sonnet]
  ├ contracts  型エスケープ / API·schema 契約破壊          (high のみ)  [sonnet]
  └ rules      code-reviewer agent。AGENTS.md + パススコープ rules       [sonnet]
  · coverage-first: 確信が持てなくても全部報告。フィルタは verify がやる。
  · StructuredOutput: { file, line, title, description, severity, rule? }

重複排除 (スクリプト内ロジック。エージェント不使用)
  · (file, line) をキーに統合。最高 severity が生き残る。

Phase 2: Verify — 候補 1 件ごとに独立の懐疑的検証 (finder ≠ verifier)
  · プロンプトは「反証せよ (try to REFUTE)」。                           [sonnet]
  · standard: reproduction 1 体 / high: correctness · reproduction ·
    scope の 3 レンズ → 過半数 REFUTED なら棄却。
  · CONFIRMED (追跡できた) / PLAUSIBLE (妥当だが未追跡) / REFUTED (除外)。
  · verifier が全滅した候補は PLAUSIBLE (unverified) で残す (fail-closed)。

Phase 3: Stamp — 全レーンが完走したときのみ                              [haiku]
  · .claude/.review-stamp を作成。レーン失敗時はスキップ (ゲートは閉)。

返り値: { effort, gateStamped, findings[], stats }
```

**補足**:
- **ゲートのライフサイクル**: `.review-stamp` は review-diff 起動時と aegis サイクル開始時に削除、review-diff 完走時と code-reviewer dispatch 完了時に作成。不在時は `git commit` がフックでブロック。
- **規模感**: 1 実行あたり 9〜17 エージェント。反証検証は毎回 2〜3 件の誤検出を落としている。
- **findings の消費者**: ワークフローは報告まで。修正は parent が直接行う。

### 3.2 `/verify-spec` — 作る前に壊す

仕様を状態機械として書き下し、**「戻る・リロード・二重送信・権限変更の合わせ技で壊せるか？」** をエージェントに試させる design-time ツール。

参照: [ADR-0010](./adr/0010-agent-based-spec-verification.md)

```
起動: Workflow({ name: "verify-spec", args: { spec: "specs/x.spec.md", depth?: 8 } })

Phase 1: Formalize (1 体)                                                [sonnet]
  仕様を構造化状態機械に変換し、曖昧な箇所を洗い出す。
  · .claude/code-graph.json から関連ファイルの depth-1 サブグラフを file_graph として返す。

Phase 2: Hunt (並列 4 レーン)
  ├ invariant   不変条件を破る操作列はあるか？                           [sonnet]
  ├ forbidden   禁止フローに到達できるか？
  ├ liveness    完了できなくなる / 抜け出せなくなるパスはあるか？
  └ refinement  この要求は設計で本当に保証されるか？
  武器: 戻る · リロード · 二重クリック · 並行タブ · 権限変更 · 通信エラー

Phase 3: Verify                                                          [sonnet]
  別のエージェントが反例を 1 ステップずつ再生。嘘の反例はここで落ちる。

返り値: { ambiguities, counterexamples[], incomplete, stats }
```

**正直な限界**: 「見つけたものは本物」だが「見つからなかった = 安全」ではない。全レーン失敗時は明示エラーを返す (fail-closed)。

---

## 4. 安全ネット（自動で動くレイヤー）

手動操作なしで安全性と品質を担保する仕組み。

### パーミッション

| レベル | 対象 | 例 |
|--------|------|-----|
| `deny` | 破壊的操作 | `rm -rf`, `git push --force`, `git reset --hard`, `.env` アクセス |
| `ask` | 確認が必要な操作 | `git commit`, `git push`, `gh pr create`, `deploy` |
| `allow` | 自由に実行可能 | read-only git/gh, `bun run`, `bun add -E`, `tree`/`find`/`grep` |

参照: [ADR-0004](./adr/0004-permission-deny-as-security-boundary.md)

### Hooks

Claude Code のイベントに応じて自動実行されるシェルスクリプト (`.claude/hooks/`)。

**セッション開始時**:

| Hook | 役割 |
|------|------|
| `session-start-aegis-hydrate.sh` | `aegis-share/source` から `.aegis/aegis.db` を構築 |

**毎プロンプト**:

| Hook | 役割 |
|------|------|
| `user-prompt-skill-reminder.sh` | planning / brainstorming / implementation のリマインダーを注入 |

**ツール実行前 (PreToolUse)** — ガードレール:

| Hook | トリガー | 役割 |
|------|---------|------|
| `pre-aegis-intent-tags-guard.sh` | aegis_compile_context | `intent_tags` 未指定をブロック |
| `pre-agent-aegis-guard.sh` | Agent dispatch | compile_context 未呼び出しをブロック |
| `pre-aegis-clear-review-stamp.sh` | aegis_compile_context | 新しい実装サイクル開始時にレビューゲートをリセット |
| `pre-workflow-clear-review-stamp.sh` | Workflow | review-diff 起動時にレビューゲートをリセット |
| `pre-commit-review-reminder.sh` | git commit | `.review-stamp` が無ければブロック (レビュー必須ゲート) |
| `pre-commit-graph-refresh.sh` | git commit | `src/` 変更時にコードグラフを再生成 |

**ツール実行後 (PostToolUse)** — 同期と通知:

| Hook | トリガー | 役割 |
|------|---------|------|
| `post-agent-review-stamp.sh` | Agent 完了 | code-reviewer dispatch 完了時に `.review-stamp` を作成 |
| `post-aegis-near-miss-warn.sh` | aegis_compile_context | エッジの glob がマッチしなかった場合に警告 |
| `post-aegis-share-sync.sh` | aegis_sync_docs / import_doc | DB → `aegis-share/` を同期 |

**編集後 (PostToolUse)** — 即時チェック:

| Hook | トリガー | 役割 |
|------|---------|------|
| (インライン) | Edit / Write | 編集ごとに `bun run lint` + `bun run typecheck` |

**セッション終了時 (Stop)** — 最終ゲート:

| Hook | 役割 |
|------|------|
| `stop-quality-gate.sh` | typecheck + lint + format + knip + similarity を実行、失敗でブロック |
| `stop-aegis-sync-check.sh` | `docs/adr/` 変更時の aegis 同期漏れを警告 |

### コミットゲート

```
.claude/.review-stamp のライフサイクル:

  作成: review-diff 完走時 / code-reviewer dispatch 完了時
  削除: review-diff 起動時 / aegis_compile_context 呼び出し時

  不在時 → git commit は pre-commit-review-reminder.sh がブロック
```

### ルール (`AGENTS.md`)

毎セッションにロードされるコーディング規約。Design Philosophy / Knowledge Currency / Code Practices / Rules of React / Testing / Commits / Agents の各セクションとして凝縮。パススコープの詳細ルール (`.claude/rules/react.md`、`design.md`) は対象パス編集時に自動ロード。

参照: [ADR-0008](./adr/0008-consolidate-rules-into-agents-md.md)

---

## 5. メンテナンス

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

参照: [ADR-0002](./adr/0002-direct-deps-only-audit.md)

### Aegis ナレッジベース

```
[新しい ADR の追加]
  aegis_import_doc({ file_path, doc_id, kind, edge_hints, tags })
  → proposal 生成 → aegis_approve_proposal で承認

[既存 ADR の編集]
  aegis_sync_docs() → content_hash 差分検出 → proposals → 承認

[compile miss フィードバック]
  aegis_observe({ event_type: "compile_miss", ... })
  → /aegis-triage で分析 → proposals → 承認
```

### ADR

非自明な設計判断がされたら新しい ADR を追加。MADR-lite テンプレートを使用（[`docs/adr/README.md`](./adr/README.md) 参照）。番号は厳密に連番。

### スキル / プロンプトのチューニング

新規作成・大幅編集時は [`/empirical-prompt-tuning`](../.claude/skills/empirical-prompt-tuning/SKILL.md) を使用。2 回連続で新たな曖昧さが出なくなるまで改善。

---

## 6. 特殊フロー

| 状況 | 対応 |
|------|------|
| 原因不明のバグ | `superpowers:systematic-debugging` を挿入 |
| レビューだけ再実行 | `/review-diff` を直接起動 (`{effort: "high"}` で深掘り) |
| 設計の状態遷移だけ検証 | `/verify-spec` を直接起動 |
| 並列マルチエージェント | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` を使用 |
| start-workflow 自体の編集 | `/empirical-prompt-tuning` で検証してからマージ |
| DB/認証/ストレージ除去 | `/remove-db` スキルで一括除去 |
| 推移的依存の脆弱性 | upstream を追跡。`overrides` は追加しない (ADR-0002) |

---

## 7. ユーザーの操作レベル

**エージェントが自律判断**:
- `/start-workflow` — ticket 粒度の作業を検知したら自動 invoke

**確認のみ**（エージェントが聞く）:
- commit / PR の実行
- ADR 起票の提案
- compile-miss の triage
- Dependabot PR 承認

**完全自動**（失敗しない限り意識不要）:
- 全 hooks (pre/post/stop)
- CI ゲート
- パーミッション拒否

---

## 8. リファレンス

### スキル一覧

| スキル | 説明 |
|--------|------|
| `/start-workflow` | チケット粒度の作業の全フロー |
| `/remove-db` | DB / 認証 / ストレージの外科的除去 |
| `/empirical-prompt-tuning` | スキル / プロンプトの反復改善 |
| `/launch-checklist` | リリース前の総合監査 |
| `/lighthouse-audit` | 全ページの Lighthouse 監査 |
| `/performance-audit` | Core Web Vitals の計測と改善 |
| `/react-doctor` | React 診断 |
| `/aegis-setup` | Aegis ナレッジベースの初期構築 |
| `/aegis-bulk-import` | ルール / ADR の一括インポート |
| `/aegis-triage` | pending observations の分析・proposal 生成 |

### その他のプラグインと MCP

| 種別 | 名前 | 役割 |
|------|------|------|
| プラグイン | `chrome-devtools-mcp` | ブラウザ操作（スクリーンショット・クリック・Lighthouse） |
| プラグイン | `typescript-lsp` | LSP 連携（型情報・シンボル検索） |
| MCP | `context7` | ライブラリドキュメント取得（React, TanStack, Tailwind 等） |

### ファイル配置

| 関心事 | 場所 |
|--------|------|
| コーディングルール | [`AGENTS.md`](../AGENTS.md) + [`.claude/rules/`](../.claude/rules/) |
| スキル | [`.claude/skills/`](../.claude/skills/) |
| ワークフロー | [`.claude/workflows/`](../.claude/workflows/) |
| コードグラフ | [`.claude/code-graph.json`](../.claude/code-graph.json) (生成: [`scripts/build-graph.ts`](../scripts/build-graph.ts)) |
| 状態機械の仕様 | [`specs/`](../specs/) |
| Hooks | [`.claude/hooks/`](../.claude/hooks/) + [`.claude/settings.json`](../.claude/settings.json) |
| パーミッション | [`.claude/settings.json`](../.claude/settings.json) |
| MCP サーバー | [`.mcp.json`](../.mcp.json) |
| ADR | [`docs/adr/`](./adr/) |
| CI | [`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml) + [`scripts/audit-direct.sh`](../scripts/audit-direct.sh) |
| 依存自動更新 | [`.github/dependabot.yml`](../.github/dependabot.yml) |
