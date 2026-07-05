# エージェントワークフロー

Claude Code でこのリポジトリを開発するための作業マニュアル。判断の「なぜ」は [ADR 一覧](./adr/README.md)、コーディングルールは [`AGENTS.md`](../AGENTS.md) を参照。

---

## TL;DR

> **`/start-workflow` → Aegis → 設計 → 実装 → `/review-diff` → commit → PR**
>
> 品質検証は 2 体の **専用サブエージェント** が担う。どちらも `.claude/agents/` で挙動を固定し、手順スキルを `skills:` frontmatter で preload し、実行時に「見つける役」とは別の **verifier 子エージェント** を dispatch して反証する（find ≠ verify）:
>
> - **`code-reviewer`**（`review-diff` skill を preload）= **作った後に壊す** — diff のバグ + 規約違反を網羅探索 → verifier child が反証 → 完走でコミットゲートを stamp
> - **`spec-verifier`**（`verify-spec` skill を preload）= **作る前に壊す** — 仕様を状態機械にして反例を探索 → verifier child が trace を再生
>
> 2 つの基盤がその判断を支える: **Aegis**（何に従うか＝ADR/ルールを決定論的に返す MCP）と **Superpowers**（どう進めるか＝方法論スキル群）。パーミッション・hooks が安全性を自動で担保。

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
  ├ 4. Plan                                     ← Superpowers / spec-verifier agent
  │     短いブリーフィング: 目的 · 対象ファイル · 受入基準 · 検証手順。
  │     複雑な作業 → superpowers:writing-plans。要件があいまい → brainstorming。
  │     非自明な状態遷移 (ウィザード · 認証フロー · 非同期ガード · 権限分岐)
  │     → specs/<feature>.spec.md を書いて spec-verifier agent で反例探索 (ADR-0010/0011)。
  │       CONFIRMED の反例を設計に反映してから実装へ。
  │
  ├ 5. Implement                                ← Superpowers + Aegis
  │     parent が直接実装。委譲はコンテキスト影響で判断。
  │     大量のファイル読み・ログ掘り → Explore subagent (model: haiku)。
  │     独立並列ユニット → 複数 general-purpose (model: sonnet) を
  │     1 メッセージで並列 dispatch。TDD 対象 → superpowers:test-driven-development。
  │
  ├ 6. レビュー                                  ← code-reviewer agent
  │     diff を読む。typecheck / test 実行。
  │     code-reviewer agent を dispatch (= /review-diff) →
  │     finder が diff を 1 回で全観点探索 → verifier child が反証 →
  │     重大度順 findings → 完走でコミットゲートを stamp。
  │     指摘は parent が直接修正。
  │
  ├ 7. commit (ユーザー確認後)
  │     目的ごとに分割 (1 コミット = 1 つの revert 可能な意図)。
  │
  └ 8. PR (ユーザー確認後)
        gh pr create。英語サマリー + 末尾に生成クレジット。
```

参照: [ADR-0006](./adr/0006-orchestration-layering.md) (オーケストレーション), [ADR-0011](./adr/0011-nested-subagent-review-and-verification.md) (レビュー・検証), [ADR-0003](./adr/0003-subagent-driven-implementation.md) (subagent dispatch)

---

## 2. サブエージェント

品質検証（レビュー・仕様検証）は、親セッションではなく **専用の名前付きサブエージェント** が実行する。親が実装した文脈を見ていない fresh context こそがバイアスチェックになるからだ。

### 2.0 共通パターン — 固定された agent + preload skill + verifier child

3 つの仕掛けで「手順が無視されず、かつ独立に検証される」ことを保証する:

| 仕掛け | 実現するもの | 具体 |
|--------|-------------|------|
| **agent 定義** (`.claude/agents/*.md`) | 挙動の固定 | system prompt がエージェントの正体。インラインプロンプトのように変質しない |
| **`skills:` frontmatter で preload** | 手順が確実にコンテキストに入る | skill 全文が起動時に注入される。手順の single source は skill 側に一元化 |
| **verifier child の dispatch** | find ≠ verify の独立性 | 見つけた本人ではなく、探索結果を知らない別コンテキストが反証する |

```
親セッション
  └─ dispatch: 名前付き agent (sonnet, skill preload 済み)   depth 1
       ├─ find / formalize + hunt を自分で実行
       └─ dispatch: verifier child (general-purpose)          depth 2
            └─ 各 finding / 反例を「反証せよ」で検証
```

nested subagent は Claude Code v2.1.172+ で対応（深さ上限 5、この構成は depth 2）。

> **なぜこの形か（旧 dynamic workflow からの移行、ADR-0011）**
> 旧構成は観点別に 5〜7 の finder を **並列 workflow** で起動していたが、ベンチマーク (2026-07-04) で判明した:
> - 並列 finder は同じバグを重複発見し、各自が同じファイルを個別探索していた
> - review-diff 1 実行で ~1.1M tokens、verify-spec で ~800K tokens を消費
> - コードグラフ注入によるトークン削減効果は現規模 (51 ファイル) では測定できず、オーバーヘッドが上回った
>
> 1 体の網羅 finder が diff を 1 回読めば同等カバレッジが 1/5 のコストで得られる。並列レーンとコードグラフを廃し、pinned agent が finder → verifier child を順に呼ぶ構成へ統合した。

### 2.1 `code-reviewer` — 作った後に壊す

**agent**: [`.claude/agents/code-reviewer.md`](../.claude/agents/code-reviewer.md) （preload: [`review-diff`](../.claude/skills/review-diff/SKILL.md) skill、model: sonnet）
**起動**: parent が dispatch（ユーザーは `/review-diff [high]`）。**完走がコミットゲートを stamp する**。
参照: [ADR-0009](./adr/0009-unified-review-workflow.md)（規律）, [ADR-0011](./adr/0011-nested-subagent-review-and-verification.md)（機構）

コミット前に **「本当にバグっていないか？ 規約に違反していないか？」** を fresh context の finder が網羅探索し、別の verifier child が各指摘を反証する。通らないとコミットできない。

```
code-reviewer agent (review-diff skill を preload):

  Step 1: Find — diff (git diff HEAD + untracked) を 1 回読み全観点を同時探索
    · logic      境界条件 / off-by-one / 条件反転 / null·undefined
    · state      競合状態 / stale closure / effect 依存 / 二重送信
    · integrity  エラー握り潰し / 失敗経路欠落 / 部分書き込み / 境界検証
    · cleanup    重複 / dead code / 過剰な複雑さ / 周辺規約からの逸脱
    · rules      AGENTS.md + パススコープ rules (.claude/rules/ を自ら読む)
    coverage-first: 確信が持てなくても全部報告。フィルタは verify がやる。

  Step 2: Dedup — (file, line) で統合。最高 severity が残る。

  Step 3: Verify — verifier child (general-purpose) を dispatch
    全 findings を渡し「反証せよ (try to REFUTE)」。実コードを読んで追跡。
    · standard: reproduction 1 レンズ
    · high:     correctness · reproduction · scope の 3 レンズ → 過半数で棄却
    CONFIRMED (追跡できた) / PLAUSIBLE (妥当だが未追跡) / REFUTED (除外)。

  返り: { effort, findings[], stats }
  stamp: 手動 touch はしない。agent 完走で post-agent-review-stamp.sh が自動作成。
```

**補足**:
- **「fallback」と「本番」の統合**: 以前は「workflow を回す or code-reviewer を単発 dispatch」の 2 経路だったが、code-reviewer が本体になり 1 経路に統合された。
- **fail-closed**: verifier child が全滅しても findings は unverified として残す（カバレッジは落とさない）。agent 自体が失敗すれば stamp は付かず commit はブロックされる。
- **findings の消費者**: agent は報告まで。修正は parent が直接行う。

### 2.2 `spec-verifier` — 作る前に壊す

**agent**: [`.claude/agents/spec-verifier.md`](../.claude/agents/spec-verifier.md) （preload: [`verify-spec`](../.claude/skills/verify-spec/SKILL.md) skill、model: sonnet）
**起動**: parent が spec パス付きで dispatch（ユーザーは `/verify-spec specs/x.spec.md`）。**design-time ツールなので stamp はしない**。
参照: [ADR-0010](./adr/0010-agent-based-spec-verification.md)（規律）, [ADR-0011](./adr/0011-nested-subagent-review-and-verification.md)（機構）

仕様を状態機械として書き下し、**「戻る・リロード・二重送信・権限変更の合わせ技で壊せるか？」** をエージェントに試させる。

```
spec-verifier agent (verify-spec skill を preload):

  Step 1: Formalize — 仕様を構造化状態機械に変換し曖昧箇所を洗い出す
    返り: { states, initial, actions, invariants, forbiddenFlows,
            requirements, ambiguities }
    machine の整合性 (initial ∈ states, from/to が既知) を自己検算。

  Step 2: Hunt — depth 以内の legal trace で全観点を同時探索
    · invariant   不変条件を破る操作列はあるか？
    · forbidden   禁止フローに到達できるか？
    · liveness    完了できなくなる / 抜け出せなくなるパスはあるか？
    · refinement  この要求は設計で本当に保証されるか？
    武器: 戻る · リロード · 二重クリック · 並行タブ · 権限変更 · 通信エラー

  Step 3: Verify — verifier child (general-purpose) を dispatch
    反例を 1 ステップずつ再生。嘘の反例はここで落ちる。

  返り: { spec, depth, ambiguities, counterexamples[], incomplete, stats }
```

**正直な限界**: 「見つけたものは本物」だが「見つからなかった = 安全」ではない。hunt が失敗（outage）した場合は `incomplete: true` で明示し、clean pass と区別する（fail-closed）。

### 2.3 探索・並列実装用のサブエージェント

品質検証以外の委譲はコンテキスト影響で判断する（ADR-0013）。

| 用途 | エージェント | model |
|------|-------------|-------|
| 大量ファイル読み・ログ掘り・横断調査（生出力を親に残さない） | `Explore` / research | haiku（精度が要るなら sonnet） |
| 独立した並列実装ユニット（共有ファイルなし・出力依存なし） | `general-purpose` を 1 メッセージで複数 dispatch | sonnet |
| 長期自律・複雑な移行・弱い結果からのエスカレーション | 上記を | opus |

依存関係のあるユニットは逐次実行するか parent に残す。同じファイルを編集するユニットは並列化しない。

---

## 3. 使用している基盤ツール

サブエージェントと親セッションの判断を支える外部の仕組み。いずれも MCP / プラグインとして接続される。

### 3.1 Aegis（MCP: `aegis` + `aegis-admin`）— 「何に従うか」

ADR とルールを管理する **コンテキストコンパイラ**。全ドキュメントを読ませる代わりに、ファイルパスとコマンドからエッジ（`path-requires` / `command-requires`）を辿って必要なドキュメントだけを決定論的に返す。

- **使い所**: `/start-workflow` step 2 で `aegis_compile_context({ target_files, plan, command, intent_tags })` を呼び、関連 ADR / ルールを relevance スコア付きで取得。subagent dispatch 前は `pre-agent-aegis-guard.sh` が未呼び出しをブロック。
- **データ**: `aegis-share/`（git 管理の共有バンドル: `source/documents/` の Markdown + `source/edges/` の glob→doc_id）と `.aegis/aegis.db`（gitignore 済みローカル SQLite、SessionStart で自動構築）。
- **メンテ**: 新規 ADR は `aegis_import_doc`、既存編集は `aegis_sync_docs`（どちらも proposal → 承認 → `post-aegis-share-sync.sh` が DB→share を同期）。compile miss は `aegis_observe` → `/aegis-triage`。
- 詳細は [ADR](./adr/README.md) と `aegis-share/` を参照。

### 3.2 Superpowers（プラグイン: `superpowers@claude-plugins-official`）— 「どう進めるか」

タスクの進め方をガイドする方法論スキル群。`/start-workflow` の各ステップやフックのリマインダーから呼ばれる。superpowers 自身はコードを書かない指揮レイヤー。

| スキル | いつ |
|--------|------|
| `brainstorming` | 要件が曖昧 / 複数アプローチ / UI 設計 |
| `writing-plans` | 設計確定後、実装前のファイル単位計画 |
| `test-driven-development` | 純関数・well-specified なロジック |
| `subagent-driven-development` | 並列タスクの dispatch |
| `finishing-a-development-branch` | 全タスク完了後の merge / PR / cleanup |
| `systematic-debugging` | 原因不明のバグ（推測で直すことを禁止） |
| `verification-before-completion` | 完了報告前の証拠確認 |

### 3.3 その他の MCP / プラグイン

| 種別 | 名前 | 役割 |
|------|------|------|
| プラグイン | `chrome-devtools-mcp` | ブラウザ操作（スクリーンショット・クリック・Lighthouse） |
| プラグイン | `typescript-lsp` | LSP 連携（型情報・シンボル検索） |
| MCP | `context7` | ライブラリドキュメント取得（React, TanStack, Tailwind 等） |

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

**セッション開始 / 毎プロンプト**:

| Hook | 役割 |
|------|------|
| `session-start-aegis-hydrate.sh` | `aegis-share/source` から `.aegis/aegis.db` を構築（未構築時のみ） |
| `user-prompt-skill-reminder.sh` | planning / brainstorming / implementation のリマインダーを注入 |

**ツール実行前 (PreToolUse)** — ガードレール:

| Hook | トリガー | 役割 |
|------|---------|------|
| `pre-aegis-compile-guard.sh` | aegis_compile_context | `intent_tags` 未指定をブロック + レビューゲートをリセット（新サイクル開始） |
| `pre-agent-aegis-guard.sh` | Agent dispatch | compile_context 未呼び出しをブロック（code-reviewer / spec-verifier は例外） |
| `pre-agent-review-clear.sh` | Agent dispatch (code-reviewer) | レビュー起動時にゲートをリセット（`post-agent-review-stamp.sh` と対。stale stamp を防ぐ） |
| `pre-commit-guard.sh` | git commit | レビューゲート確認 |

**ツール実行後 (PostToolUse)** — 同期・スタンプ・即時チェック:

| Hook | トリガー | 役割 |
|------|---------|------|
| `post-agent-review-stamp.sh` | Agent 完了 | `code-reviewer` agent 完走時に `.review-stamp` を作成 |
| `post-aegis-near-miss-warn.sh` | aegis_compile_context | エッジの glob がファイルにマッチしなかった場合に警告 |
| `post-aegis-share-sync.sh` | aegis_sync_docs / import_doc | DB → `aegis-share/` を同期 |
| (インライン) | Edit / Write | 編集ごとに `bun run lint` + `bun run typecheck` |

**セッション終了時 (Stop)** — 最終ゲート:

| Hook | 役割 |
|------|------|
| `stop-gate.sh` | typecheck + lint + format + knip + similarity + aegis 同期チェック（全て blocking） |

### コミットゲート

```
.claude/.review-stamp のライフサイクル (対称):

  削除: code-reviewer dispatch 時 (pre-agent-review-clear.sh) — レビュー起動でリセット
        / aegis_compile_context 呼び出し時 (新しい実装サイクル開始)
  作成: code-reviewer agent 完走時 (post-agent-review-stamp.sh)

  → レビューがエラー/中断で完走しなければ stamp は復活せず、stale stamp は残らない
  不在時 → git commit は pre-commit-guard.sh がブロック
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
[新しい ADR の追加]  aegis_import_doc({ file_path, doc_id, kind, edge_hints, tags })
                     → proposal 生成 → aegis_approve_proposal で承認
[既存 ADR の編集]    aegis_sync_docs() → content_hash 差分検出 → proposals → 承認
[compile miss]       aegis_observe({ event_type: "compile_miss", ... })
                     → /aegis-triage で分析 → proposals → 承認
```

### ADR

非自明な設計判断がされたら新しい ADR を追加。MADR-lite テンプレートを使用（[`docs/adr/README.md`](./adr/README.md) 参照）。番号は厳密に連番。

### スキル / エージェント / プロンプトのチューニング

新規作成・大幅編集時は [`/empirical-prompt-tuning`](../.claude/skills/empirical-prompt-tuning/SKILL.md) を使用。2 回連続で新たな曖昧さが出なくなるまで改善。`code-reviewer` / `spec-verifier` agent とその preload skill は毎コミットで load-bearing なので、変更はここを通す。

---

## 6. 特殊フロー

| 状況 | 対応 |
|------|------|
| 原因不明のバグ | `superpowers:systematic-debugging` を挿入 |
| レビューだけ再実行 | `code-reviewer` agent を dispatch (= `/review-diff`、`high` で深掘り) |
| 設計の状態遷移だけ検証 | `spec-verifier` agent を dispatch (= `/verify-spec specs/<feature>.spec.md`) |
| 並列マルチエージェント | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` を使用 |
| agent / skill 自体の編集 | `/empirical-prompt-tuning` で検証してからマージ |
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

### サブエージェント

| agent | preload skill | 役割 |
|-------|--------------|------|
| `code-reviewer` | `review-diff` | コミット前レビュー（finder + verifier child、ゲート stamp） |
| `spec-verifier` | `verify-spec` | design-time 仕様検証（formalize + hunt + verifier child） |
| `Explore` | — | 読み取り専用の探索・検索 |
| `general-purpose` | — | 汎用（並列実装ユニット・verifier child） |

### スキル一覧

| スキル | 説明 |
|--------|------|
| `/start-workflow` | チケット粒度の作業の全フロー |
| `/review-diff` | `code-reviewer` agent を dispatch するコミット前レビュー |
| `/verify-spec` | `spec-verifier` agent を dispatch する状態機械仕様の反例探索 |
| `/remove-db` | DB / 認証 / ストレージの外科的除去 |
| `/empirical-prompt-tuning` | スキル / エージェント / プロンプトの反復改善 |
| `/launch-checklist` | リリース前の総合監査 |
| `/lighthouse-audit` | 全ページの Lighthouse 監査 |
| `/performance-audit` | Core Web Vitals の計測と改善 |
| `/react-doctor` | React 診断 |
| `/aegis-setup` | Aegis ナレッジベースの初期構築 |
| `/aegis-bulk-import` | ルール / ADR の一括インポート |
| `/aegis-triage` | pending observations の分析・proposal 生成 |

### ファイル配置

| 関心事 | 場所 |
|--------|------|
| コーディングルール | [`AGENTS.md`](../AGENTS.md) + [`.claude/rules/`](../.claude/rules/) |
| サブエージェント | [`.claude/agents/`](../.claude/agents/) |
| スキル | [`.claude/skills/`](../.claude/skills/) |
| 状態機械の仕様 | [`specs/`](../specs/) |
| Hooks | [`.claude/hooks/`](../.claude/hooks/) + [`.claude/settings.json`](../.claude/settings.json) |
| パーミッション | [`.claude/settings.json`](../.claude/settings.json) |
| MCP サーバー | [`.mcp.json`](../.mcp.json) |
| ADR | [`docs/adr/`](./adr/) |
| CI | [`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml) + [`scripts/audit-direct.sh`](../scripts/audit-direct.sh) |
| 依存自動更新 | [`.github/dependabot.yml`](../.github/dependabot.yml) |
