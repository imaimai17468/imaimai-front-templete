# エージェントワークフロー

Claude Code でこのリポジトリを開発するための作業マニュアル。判断の「なぜ」は [ADR 一覧](./adr/README.md)、コーディングルールは [`AGENTS.md`](../AGENTS.md) を参照。

---

## TL;DR

> **`/start-workflow` → Aegis → 設計 → 実装 → `/review-diff` → commit → PR**
>
> 品質検証は **専用サブエージェント** が担う。`.claude/agents/` で挙動を固定し、手順スキルを `skills:` frontmatter で preload し、「見つける役」とは別の fresh context が反証する（find ≠ verify）:
>
> - **コミット前レビュー**（`review-diff` skill を preload、ADR-0015）= **作った後に壊す** — 親が2段を順に dispatch: `code-reviewer`（finder、候補を返す）→ `review-verifier`（候補を実コードで反証）。verifier 完走でコミットゲートを stamp。どちらも depth-1 で親が直接待つ（ネストの子待ちを撤去）
> - **`spec-verifier`**（`verify-spec` skill を preload）= **作る前に壊す** — 仕様を状態機械にして反例を探索 → verifier child が trace を再生（design-time / 非ゲート、ネストのまま — 負債として記録）
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
  ├ 6. レビュー                                  ← code-reviewer + review-verifier
  │     diff を読む。typecheck / test 実行。/review-diff (ADR-0015):
  │     親が code-reviewer(finder)を dispatch → 候補を受け取り →
  │     review-verifier を dispatch → 実コードで反証 → 重大度順 survivors →
  │     verifier 完走でコミットゲートを stamp(finder が同一 diff で先行した
  │     場合のみ)。指摘は parent が直接修正 → 編集で stamp が消えるので
  │     再レビュー(ADR-0013。delta モードで安価)。
  │
  ├ 7. commit (ユーザー確認後)
  │     目的ごとに分割 (1 コミット = 1 つの revert 可能な意図)。
  │
  └ 8. PR (ユーザー確認後)
        gh pr create。英語サマリー + 末尾に生成クレジット。
```

参照: [ADR-0006](./adr/0006-orchestration-layering.md) (オーケストレーション), [ADR-0011](./adr/0011-nested-subagent-review-and-verification.md) (レビュー・検証), [ADR-0012](./adr/0012-parent-centric-implementation.md) (parent 直接実装と委譲基準), [ADR-0013](./adr/0013-deterministic-enforcement-gates.md) (強制ゲートの機構)

---

## 2. サブエージェント

品質検証（レビュー・仕様検証）は、親セッションではなく **専用の名前付きサブエージェント** が実行する。親が実装した文脈を見ていない fresh context こそがバイアスチェックになるからだ。

### 2.0 共通パターン — 固定された agent + preload skill + find ≠ verify

3 つの仕掛けで「手順が無視されず、かつ独立に検証される」ことを保証する:

| 仕掛け | 実現するもの | 具体 |
|--------|-------------|------|
| **agent 定義** (`.claude/agents/*.md`) | 挙動の固定 | system prompt がエージェントの正体。インラインプロンプトのように変質しない |
| **`skills:` frontmatter で preload** | 手順が確実にコンテキストに入る | skill 全文が起動時に注入される。手順の single source は skill 側に一元化 |
| **find と verify を別 context に分離** | find ≠ verify の独立性 | 見つけた本人ではなく、探索結果を知らない別コンテキストが反証する |

レビュー（ADR-0015）は **親がフラットに2段 dispatch** する。どちらも depth-1 で親が直接待つため、「サブエージェントが自分の子を待つ」脆い関節がない（この関節は 2026-07-10 に評決ロストを2回起こした）:

```
親セッション
  ├─ dispatch: code-reviewer (finder, sonnet)  depth 1  → 候補を返す
  └─ dispatch: review-verifier (sonnet)         depth 1  → 候補を反証、完走で stamp
```

spec-verifier は design-time / 非ゲートのため当面ネストのまま（子待ちの脆さは同じだが低リスク、負債として記録）:

```
親セッション
  └─ dispatch: spec-verifier (opus)             depth 1
       └─ dispatch: verifier child              depth 2  → 反例を再生
```

移行の経緯（旧 dynamic workflow / コードグラフ → ネスト）は [ADR-0011](./adr/0011-nested-subagent-review-and-verification.md)、ネスト → フラット化は [ADR-0015](./adr/0015-flat-review-pipeline.md) を参照。

### 2.1 コミット前レビュー — 作った後に壊す（finder + verifier、ADR-0015）

**agents**: [`code-reviewer`](../.claude/agents/code-reviewer.md)（finder）+ [`review-verifier`](../.claude/agents/review-verifier.md)（verifier）。どちらも [`review-diff`](../.claude/skills/review-diff/SKILL.md) skill を preload、model: sonnet。
**起動**: parent が2段を順に dispatch（ユーザーは `/review-diff [high]`）。**verifier の完走がコミットゲートを stamp する**。
参照: [ADR-0009](./adr/0009-unified-review-workflow.md)（規律）, [ADR-0011](./adr/0011-nested-subagent-review-and-verification.md)（旧機構）, [ADR-0015](./adr/0015-flat-review-pipeline.md)（フラット化）

コミット前に **「本当にバグっていないか？ 規約に違反していないか？」** を fresh context の finder が網羅探索し、別の fresh context の verifier が各指摘を反証する。通らないとコミットできない。

```
親が dispatch:

  ① code-reviewer (finder)
     Step 1: Find — diff (git diff HEAD + untracked) を 1 回読み全観点を同時探索
       · logic / state / integrity / cleanup / rules(AGENTS.md + パススコープ)
       coverage-first: 確信が持てなくても全部報告。フィルタは verify がやる。
     Step 2: Dedup — (file, line) で統合し候補を返す（検証も stamp もしない）

  ② review-verifier (verifier) ← 親が候補 JSON を渡して dispatch（候補 0 でも実行）
     Step 3: Verify — 候補を実コードで「反証せよ (try to REFUTE)」
       · standard: reproduction 1 レンズ
       · high:     correctness · reproduction · scope の 3 レンズ → 過半数で棄却
       CONFIRMED / PLAUSIBLE / REFUTED（迷ったら REFUTED）
     Step 4: Return — REFUTED を落とし survivors を返す
       { effort, mode, fallback?, findings[], stats }
     stamp: 手動 touch はしない。verifier 完走で post-agent-review-stamp.sh が自動作成。
```

**補足**:
- **なぜフラット**: 両 agent とも depth-1 で親が直接待つ。ネスト（agent が自分の子を待つ）は 2026-07-10 に評決ロストを2回起こした関節で、それを構造ごと撤去（ADR-0015）。独立性は finder / verifier が別 context である事実で担保。
- **fail-closed**: verifier が候補を確証できなくても unverified として残す（カバレッジは落とさない）。verifier が完走しなければ stamp は付かず commit はブロック。
- **mode/delta**: delta は同一サイクル内の再レビュー（finder に前回レポート + 差分説明を渡す。曖昧なら full へ fail-closed）。前回クリーンだった箇所への回帰は delta では見えないので、前提が変わる修正の後は full。
- **findings の消費者**: agent は報告まで。修正は parent が直接行う。

### 2.2 `spec-verifier` — 作る前に壊す

**agent**: [`.claude/agents/spec-verifier.md`](../.claude/agents/spec-verifier.md) （preload: [`verify-spec`](../.claude/skills/verify-spec/SKILL.md) skill、model: opus。verifier child も opus）
**起動**: parent が spec パス付きで dispatch（ユーザーは `/verify-spec specs/x.spec.md`）。**design-time ツールなので stamp はしない**。**単発実行** — parent は自動で再 dispatch しない。反例修正後の再検証はユーザーが明示的に行う新しい 1 パス。
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

品質検証以外の委譲はコンテキスト影響で判断する（ADR-0012）。

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
- **メンテ**: `aegis-share/source/` が canonical。新規 ADR・既存編集とも `source/documents/`（+必要なら `source/edges/`）を編集し、`share-format` → `share-lint` → `share-materialize` → `share-export` で DB とバンドルへ反映（`aegis_import_doc` の直接投入は source と乖離を生むため使わない）。`aegis_sync_docs` は hydrate 後の再アンカー用。compile miss は `aegis_observe` → `/aegis-triage`。
- 詳細は [ADR](./adr/README.md) と `aegis-share/` を参照。

### 3.2 Superpowers（プラグイン: `superpowers@claude-plugins-official`）— 「どう進めるか」

タスクの進め方をガイドする方法論スキル群。`/start-workflow` の各ステップや AGENTS.md「Workflow」節のトリガーから呼ばれる。superpowers 自身はコードを書かない指揮レイヤー。プラグイン未導入の環境ではスキルの意図を手動で実施する（AGENTS.md「Degraded Environments」）。

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
| `session-start-env-check.sh` | ゲート依存ツールの欠落を報告（degraded セッションの可視化）+ セッションマーカーのリセット |
| `session-start-aegis-hydrate.sh` | `aegis-share/source` から `.aegis/aegis.db` を構築（未構築時のみ） |
| `user-prompt-gate.sh` | `.aegis-stamp` をクリア（プロンプトごとに相談ウィンドウを開き直す）+ AGENTS.md へのポインタを注入（指示本文は AGENTS.md に一元化） |

**ツール実行前 (PreToolUse)** — ガードレール:

| Hook | トリガー | 役割 |
|------|---------|------|
| `pre-aegis-compile-guard.sh` | aegis_compile_context | `intent_tags` 未指定をブロック + レビューゲートをリセット（新サイクル開始） |
| `pre-agent-aegis-guard.sh` | Agent dispatch | `.aegis-stamp` 不在をブロック（code-reviewer / review-verifier / spec-verifier は例外。Aegis 不在の環境は `.aegis-unavailable` マーカーで明示的に degrade — ADR-0013） |
| `pre-agent-review-clear.sh` | Agent dispatch (code-reviewer) | finder 起動＝新サイクルで `.review-stamp` と `.finder-done` をリセット（`post-agent-review-stamp.sh` と対。stale stamp を防ぐ） |
| `pre-bash-guard.sh` | Bash | `.env` 系ファイルを参照するコマンドをブロック（ADR-0004 改訂）+ git commit のレビューゲート確認 |

**ツール実行後 (PostToolUse)** — 同期・スタンプ・即時チェック:

| Hook | トリガー | 役割 |
|------|---------|------|
| `post-agent-review-stamp.sh` | Agent 完了 | `code-reviewer`(finder)完走時に diff ハッシュを `.finder-done` に記録; `review-verifier` 完走時に `.finder-done` が有り同一 diff ハッシュのときのみ `.review-stamp` を作成し `.finder-done` を消費（ADR-0015 決定論ゲート） |
| `post-aegis-compile.sh` | aegis_compile_context | `.aegis-stamp` を作成（dispatch ゲートの成果物）+ エッジの glob がファイルにマッチしなかった場合に警告 |
| `post-aegis-share-sync.sh` | aegis_sync_docs / import_doc | DB → `aegis-share/` を同期 |
| `post-edit-check.sh` | Edit / Write | `.review-stamp` をクリア（レビュー後の編集を無効化）+ 編集ファイル単体を lint（全体チェックは Stop gate に集約） |

**セッション終了時 (Stop)** — 最終ゲート:

| Hook | 役割 |
|------|------|
| `stop-gate.sh` | typecheck + lint + format + knip + similarity + aegis 同期チェック（コード系ファイルの変更時のみ。`stop_hook_active` の 2 周目は警告に降格し無限ループを防ぐ。similarity-ts 未導入はスキップとして明示） |

### コミットゲート

```
ゲートのライフサイクル (フラット finder→verifier、ADR-0015):

  .finder-done (finder が見た diff のハッシュ):
    作成: code-reviewer(finder)完走時 (post-agent-review-stamp.sh)
    削除: review-verifier 完走時に消費 / 新サイクル開始時
          (pre-agent-review-clear.sh・pre-aegis-compile-guard.sh・SessionStart)
  .review-stamp (コミットゲート):
    作成: review-verifier 完走時、ただし .finder-done が有り
          「finder 時点の diff ハッシュ == 現在の diff ハッシュ」のときだけ
          (post-agent-review-stamp.sh)
    削除: code-reviewer dispatch 時 (pre-agent-review-clear.sh)
          / aegis_compile_context 呼び出し時（新実装サイクル）
          / Edit・Write 実行時 (post-edit-check.sh) — レビュー後の編集は再レビュー必須 (ADR-0013)
          / セッション開始時 (session-start-env-check.sh)

  → stamp は「finder が先行し、verifier が同一 diff を検証した」ことの証明。
    verifier 単独 dispatch や finder→verifier 間の編集では stamp が付かない（C1/C2）
  → レビューがエラー/中断で完走しなければ stamp は付かず、stale stamp は残らない
  → コミット分割は編集を伴わないので、1 回のレビューで複数コミットに分割できる
  不在時 → git commit は pre-bash-guard.sh がブロック
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
canonical は aegis-share/source/（import_doc の直接投入は乖離を生むため不使用）

[新しい ADR の追加]  docs/adr/NNNN-*.md を書く
                     → aegis-share/source/documents/adr-NNNN.md（frontmatter+本文ミラー）
                       + source/edges/*.json に必要な edge を追加
                     → npx aegis share-format / share-lint / share-materialize / share-export
[既存 ADR の編集]    docs/adr/ を編集 → source/documents/ のミラー本文を同期
                     → 同上の share パイプライン（doctor で in_sync を確認）
[hydrate 直後]       aegis_sync_docs() で file-anchored ドキュメントを再アンカー
[compile miss]       aegis_observe({ event_type: "compile_miss", ... })
                     → /aegis-triage で分析 → proposals → 承認
```

### ADR

非自明な設計判断がされたら新しい ADR を追加。MADR-lite テンプレートを使用（[`docs/adr/README.md`](./adr/README.md) 参照）。番号は厳密に連番。

### スキル / エージェント / プロンプトのチューニング

新規作成・大幅編集時は [`/empirical-prompt-tuning`](../.claude/skills/empirical-prompt-tuning/SKILL.md) を使用。2 回連続で新たな曖昧さが出なくなるまで改善。ただし `code-reviewer` / `review-verifier` agent と `review-diff` skill の load-bearing な変更、およびそのモデル階層変更は、ADR-0014/0015 によりスコア付き golden eval（`docs/superpowers/evals/review-diff/`）の実走が必須（この点で empirical-prompt-tuning の従来義務を置換）。`spec-verifier` / `verify-spec` は eval 未整備のため従来通り empirical tuning + ユーザー承認（明示的な負債）。

### 監査 / eval サイクル（ADR-0014）

決定論ゲート・fresh-context レビューが日々の品質を担保する一方、それらが構造的に拾えない領域と、最良モデルの判断そのものの陳腐化を、2 つのオンデマンド機構で補う。

```
[repo-audit]   /repo-audit — オンデマンド（スケジュール実行しない）
  最良モデルで 4 レーン監査（アーキテクチャドリフト / セキュリティ /
  依存戦略 / docs·DX）。lint·型·テスト·dead-code·フォーマットはゲートが持つので対象外。
  成果物は既存レールのみに振り分ける（新形式を作らない）:
    · 知識（規約・判断）→ ADR / AGENTS.md → aegis-share フロー
    · 作業（直す・作る）→ docs/superpowers/specs/ 計画書 → /start-workflow
  2 回連続で空振りしたら skill 自体の削除を提案（ADR-0011 の教訓）。

[golden eval]  docs/superpowers/evals/review-diff/
  review パイプラインの回帰検出器。シード欠陥パッチ + 期待所見で
  code-reviewer を採点。model 階層・load-bearing skill の変更時に実走し
  results/ に記録（上記チューニング項の必須要件）。
```

参照: [ADR-0014](./adr/0014-measurement-first-model-continuity.md)

---

## 6. 特殊フロー

| 状況 | 対応 |
|------|------|
| 原因不明のバグ | `superpowers:systematic-debugging` を挿入 |
| レビューだけ再実行 | `/review-diff`（= 親が `code-reviewer` finder → `review-verifier` を順に dispatch、`high` で深掘り、ADR-0015）。修正後は **delta モード**推奨（finder に前回レポート + 差分説明を渡し差分のみ精査、ADR-0014） |
| リポジトリ健全性の点検 | `/repo-audit` — ゲートが拾えない領域を最良モデルで監査し既存レールへ (ADR-0014) |
| 設計の状態遷移だけ検証 | `spec-verifier` agent を dispatch (= `/verify-spec specs/<feature>.spec.md`) |
| 並列マルチエージェント | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` をセッション単位で自分でセット（settings.json ではデフォルト無効） |
| agent / skill 自体の編集 | `/empirical-prompt-tuning` で検証してからマージ（`code-reviewer`/`review-diff` の load-bearing 変更とモデル階層変更は ADR-0014 の golden eval 必須 — §5 参照） |
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
| `code-reviewer` | `review-diff` | コミット前レビューの **finder**（候補を返すだけ） |
| `review-verifier` | `review-diff` | コミット前レビューの **verifier**（候補を反証、完走でゲート stamp）(ADR-0015) |
| `spec-verifier` | `verify-spec` | design-time 仕様検証（formalize + hunt + verifier child、ネスト） |
| `Explore` | — | 読み取り専用の探索・検索 |
| `general-purpose` | — | 汎用（並列実装ユニット・spec-verifier の verifier child） |

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
| `/repo-audit` | 最良モデルによるオンデマンド監査（ゲートが拾えない領域を既存レールへ）(ADR-0014) |

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
