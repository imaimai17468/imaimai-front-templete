# エージェントワークフロー

Claude Code でこのリポジトリを開発するための作業マニュアル。判断の「なぜ」は `aegis-share/source/documents/` の ADR（Aegis が配信）、コーディングルールは [`AGENTS.md`](../AGENTS.md) を参照。

---

## TL;DR

> **`/start-workflow` → Aegis → 設計 → 実装 → `/review-diff` → commit → PR**
>
> 品質検証は **専用サブエージェント 1 体が内部を 4 段階で実行する**（ADR-0029、ADR-0015 の2エージェント構成を統合）。`.claude/agents/` で挙動を固定し、手順スキルを `skills:` frontmatter で preload する。find ≠ verify（review）/ hunt ≠ replay（spec）はもう「別 context に分離する仕掛け」ではなく「同一 context 内で守るべき規律」——反証段が再検証した `file:line`（review）や machine の行・ガード番号（spec）を必ず添えるのが、その格下げの埋め合わせ:
>
> - **コミット前レビュー**（`review-diff` skill を preload、ADR-0029）= **作った後に壊す** — 親が `code-reviewer` を1回 dispatch。中で Stage A find → B dedup → C refute → D return が順に走り、完走がそのままコミットゲートを stamp する。depth-1 で親が直接待つ（ネストの子待ちはこれまでどおり無い）
> - **spec 検証**（`verify-spec` skill を preload、ADR-0029）= **作る前に壊す** — 親が `spec-verifier` を1回 dispatch。中で Stage A formalize → B hunt → C replay → D return が順に走る。design-time / 非ゲート
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
  │     非自明な設計判断？ → aegis-share/source/documents/adr-NNNN.md を先に起票。
  │     純粋な機械作業？ → スキップ。
  │
  ├ 4. Plan                                     ← Superpowers / spec-verifier agent
  │     短いブリーフィング: 目的 · 対象ファイル · 受入基準 · 検証手順。
  │     複雑な作業 → superpowers:writing-plans。要件があいまい → brainstorming。
  │     非自明な状態遷移 (ウィザード · 認証フロー · 非同期ガード · 権限分岐)
  │     → specs/<feature>.spec.md を書いて spec-verifier を1体 dispatch。
  │       内部で formalize → hunt → replay → return の4段階を通し、
  │       反例候補を自ら再生検証する (ADR-0010/0029)。
  │       CONFIRMED の反例を設計に反映してから実装へ。
  │
  ├ 5. Implement                                ← Superpowers + Aegis
  │     parent が直接実装。委譲はコンテキスト影響で判断。
  │     大量のファイル読み・ログ掘り → Explore subagent (model: haiku)。
  │     独立並列ユニット → 複数 general-purpose (model: sonnet) を
  │     1 メッセージで並列 dispatch。TDD 対象 → superpowers:test-driven-development。
  │
  ├ 6. レビュー                                  ← code-reviewer (1体、4段階を内部実行)
  │     diff を読む。typecheck / test 実行。/review-diff (ADR-0029):
  │     親が code-reviewer を1体 dispatch → 内部で find → dedup → refute →
  │     return が順に走り、重大度順 survivors を返す → 完走がそのまま
  │     コミットゲートを stamp。指摘は parent が直接修正 → そこで終了
  │     (ADR-0019。修正編集では stamp は消えない。再レビュー工程は無い)。
  │     dispatch 中に親が編集するとゲートに映らない残存ギャップあり (§4)。
  │
  ├ 7. commit (ユーザー確認後)
  │     目的ごとに分割 (1 コミット = 1 つの revert 可能な意図)。
  │
  └ 8. PR (ユーザー確認後)
        gh pr create。英語サマリー + 末尾に生成クレジット。
```

参照: ADR-0006 (オーケストレーション), ADR-0011 (レビュー・検証), ADR-0012 (parent 直接実装と委譲基準), ADR-0013 (強制ゲートの機構), ADR-0015 (フラット2エージェント化), ADR-0029 (1エージェント4段階への統合)

---

## 2. サブエージェント

品質検証（レビュー・仕様検証）は、親セッションではなく **専用の名前付きサブエージェント** が実行する。親が実装した文脈を見ていない fresh context こそがバイアスチェックになるからだ。

### 2.0 共通パターン — 固定された agent + preload skill + Stage 分離という規律

2 つの仕掛けで「手順が無視されない」ことを保証する。ADR-0015 まではここに3つ目として「find と verify を別 context に分離」があったが、ADR-0029 が第二 dispatch を撤去したことでその仕掛けは無くなった。find ≠ verify（review）/ hunt ≠ replay（spec）は今は同一 context 内の規律であり、詳細と受け入れた代償は 2.1 / 2.2 を参照:

| 仕掛け | 実現するもの | 具体 |
|--------|-------------|------|
| **agent 定義** (`.claude/agents/*.md`) | 挙動の固定 | system prompt がエージェントの正体。インラインプロンプトのように変質しない |
| **`skills:` frontmatter で preload** | 手順が確実にコンテキストに入る | skill 全文が起動時に注入される。手順の single source は skill 側に一元化 |

レビュー（ADR-0029、ADR-0015 の2エージェント構成を統合）は **親が `code-reviewer` を1回 dispatch** し、その中で Stage A find → B dedup → C refute → D return が順に走る。depth-1 で親が直接待つため、「サブエージェントが自分の子を待つ」脆い関節はない（この関節は 2026-07-10 に評決ロストを2回起こし、ADR-0015 が構造ごと撤去した。ADR-0029 は「統合した agent が検証用の子を dispatch する」形を選択肢として明示的に却下している——それは撤去した関節を呼び戻すことになるため）。dispatch が1回になったので「2段がユーザーの入力を挟まず続けて走るか」という論点自体が消えた。ただし既定の背景実行だと親のターンは起動時点でいったん終わるので、それを 1 ターンに収めるためのフラグ `run_in_background: false` は変わらず必要。効くかどうかについて観測できていることは `review-diff` step 0 にある:

```
親セッション
  └─ dispatch: code-reviewer (sonnet)  depth 1  → 内部で A find → B dedup → C refute → D return、完走で stamp
```

spec 検証も同じ形（design-time / 非ゲートなので stamp フックは無い）:

```
親セッション
  └─ dispatch: spec-verifier (opus)    depth 1  → 内部で A formalize → B hunt → C replay → D return
```

移行の経緯（旧 dynamic workflow / コードグラフ → ネスト）は ADR-0011、ネスト → フラット2エージェント化（review・spec 両方）は ADR-0015、フラット2エージェント → 1エージェント4段階への統合は ADR-0029 を参照。

### 2.1 コミット前レビュー — 作った後に壊す（1エージェント4段、ADR-0029）

**agent**: [`code-reviewer`](../.claude/agents/code-reviewer.md) 1体。[`review-diff`](../.claude/skills/review-diff/SKILL.md) skill を preload、model: sonnet、permissionMode: auto（下の「パーミッション」を参照）。Stage A 発見 → B 重複統合 → C 反証 → D 返却を1コンテキストで通す。
**起動**: parent が1体 dispatch して待つ（ユーザーは `/review-diff [high]`）。**完走（かつ報告が空でないこと）がコミットゲートを stamp する**。
参照: ADR-0009（規律）, ADR-0011（旧機構）, ADR-0015（フラット化）, ADR-0029（1エージェント化）

コミット前に **「本当にバグっていないか？ 規約に違反していないか？」** を単一の fresh context が Stage A〜D の順に、見つけて反証するところまで一人で行う。通らないとコミットできない。

```
親が dispatch:

  code-reviewer （1体、4段階を内部で順に実行）
     Stage A: Find — diff (git diff HEAD + untracked) を 1 回読み全観点を同時探索
       · logic / state / integrity / cleanup / rules(AGENTS.md + パススコープ)
       coverage-first: 確信が持てなくても全部報告。フィルタは Stage C がやる。
     Stage B: Dedup — (file, line) で統合し重大度順に整列
     Stage C: Refute — 各候補を実コードで「反証せよ (try to REFUTE)」
       · standard: reproduction 1 レンズ
       · high:     correctness · reproduction · scope の 3 レンズ → 過半数で棄却
       CONFIRMED / PLAUSIBLE / REFUTED（迷ったら REFUTED）
       Stage A を書いたのは自分自身なので、その推論を見える状態で反証する
       ——find ≠ verify が「別 context という仕掛け」から「同一 context 内の
       規律」に格下げされた代償（下記補足）。埋め合わせとして、全ての判定に
       再読した file:line を必ず記録する。
     Stage D: Return — REFUTED を落とし survivors を返す
       生き残りには fix（具体的な修正）と acceptance（確認方法）を必ず付ける
       （判断が要る所見は fix に「決めるべき選択肢」を書く。ADR-0020）
       { effort, findings[], stats }
     stamp: 手動 touch はしない。完走で post-agent-review-stamp.sh が自動作成。
```

**補足**:
- **なぜフラット（ネストではない）**: depth-1 で親が直接待つ。ネスト（agent が自分の子を待つ）は 2026-07-10 に評決ロストを2回起こした関節で、それを構造ごと撤去（ADR-0015）。ADR-0029 は「統合した agent が検証用の子を dispatch する」形を選択肢として明示的に却下している——それは撤去した関節をそのまま呼び戻すことになるため。
- **find ≠ verify は仕掛けから規律になった（受け入れた代償）**: ADR-0015 までは「見つけた本人とは別の fresh context が反証する」ことで独立性を機構として担保していた。ADR-0029 は第二 dispatch を統合し、Stage C は Stage A の推論を見える状態のまま反証する。コードを一度も開かずに反証したかどうかは Stage C の `file:line` 引用で可視化されるが、それが起きなくなる保証にはならない——ADR-0029 はこれを事故ではなく承知の上のリスクとして明記している。
- **fail-closed**: Stage C が候補を確証できなくても unverified として残す（カバレッジは落とさない）。エージェントが完走しなければ stamp は付かず commit はブロック。
- **モードは1つ**: 未コミット diff 全体を1回見て終わり（ADR-0019）。部分再走の delta モードは撤去済み。
- **findings の消費者**: parent が返された `fix` を適用し `acceptance` で確認する。外れると判断したら理由を明示する。1回で終わる以上、修正案まで返させないと修正だけ誰の判定も受けない（ADR-0020）。
- **残存ギャップ**: dispatch 中に親がファイルを編集すると、エージェントが一度も読んでいないツリーに stamp が付く。仕組みの詳細と受け入れた理由は §4「コミットゲート」。

### 2.2 spec 検証 — 作る前に壊す（1エージェント4段、ADR-0029）

**agent**: [`spec-verifier`](../.claude/agents/spec-verifier.md) 1体。[`verify-spec`](../.claude/skills/verify-spec/SKILL.md) skill を preload、model: opus。Stage A 形式化 → B 反例探索 → C 再生検証 → D 返却を1コンテキストで通す。
**起動**: parent が1体 dispatch して待つ（ユーザーは `/verify-spec specs/x.spec.md`）。**design-time ツールなので stamp はしない**。**単発実行** — parent は自動で再実行しない。反例修正後の再検証はユーザーが明示的に行う新しい 1 パス。
参照: ADR-0010（規律）, ADR-0011（旧機構）, ADR-0015（フラット化）, ADR-0029（1エージェント化）

仕様を状態機械として書き下し、**「戻る・リロード・二重送信・権限変更の合わせ技で壊せるか？」** を単一の fresh context に、内部規律だけで hunt から replay まで通させる。

```
親が dispatch:

  spec-verifier （1体、4段階を内部で順に実行）
     Stage A: Formalize — 仕様を構造化状態機械に変換し曖昧箇所を洗い出す
       machine の整合性 (initial ∈ states, from/to が既知) を自己検算。
     Stage B: Hunt — depth 以内の legal trace で全観点を同時探索
       · invariant / forbidden / liveness / refinement
       武器: 戻る · リロード · 二重クリック · 並行タブ · 権限変更 · 通信エラー
       返り: machine, ambiguities, candidates[]（フィルタは Stage C がやる）
     Stage C: Replay — 各反例を machine で 1 ステップずつ再生し反証を試みる。
       Stage B を書いたのは自分自身なので、その推論を見える状態で反証する
       ——find ≠ verify（review）と同じ格下げの代償（2.1 補足参照）。
       埋め合わせとして、全ての判定に machine の行・ガード・チェック番号を
       必ず記録する。
     Stage D: Return — { machine, ambiguities, counterexamples[], stats }
       （design-time なので stamp なし）
```

eval: `scripts/evals/verify-spec/`（シード反例を持つ spec fixture で
単一エージェントの spec パイプラインを実走検証、ADR-0014/0029）。

**正直な限界**: 「見つけたものは本物」だが「見つからなかった = 安全」ではない。hunt が失敗（outage）した場合は `incomplete: true` で明示し、clean pass と区別する（fail-closed）。

### 2.3 探索・並列実装用のサブエージェント

品質検証以外の委譲はコンテキスト影響で判断する（ADR-0012）。

| 用途 | エージェント | model |
|------|-------------|-------|
| 大量ファイル読み・ログ掘り・横断調査（生出力を親に残さない） | `Explore` / research | haiku（精度が要るなら sonnet） |
| 独立した並列実装ユニット（共有ファイルなし・出力依存なし） | `general-purpose` を 1 メッセージで複数 dispatch | sonnet |
| 長期自律・複雑な移行・弱い結果からのエスカレーション | 上記を | opus |

依存関係のあるユニットは逐次実行するか parent に残す。同じファイルを編集するユニットは並列化しない。並列ユニットには `run_in_background: false` を付けない — 同時に synchronous dispatch した束が並列のまま走るかは未検証で、確認できるまで既定（背景）に置く（AGENTS.md「Delegation」）。

---

## 3. 使用している基盤ツール

サブエージェントと親セッションの判断を支える外部の仕組み。いずれも MCP / プラグインとして接続される。

### 3.1 Aegis（MCP: `aegis` + `aegis-admin`）— 「何に従うか」

ADR とルールを管理する **コンテキストコンパイラ**。全ドキュメントを読ませる代わりに、必要なドキュメントだけを決定論的に返す。経路は2つあり、返り値も別の節に入る:

- **エッジ**（`path-requires` / `command-requires`）→ `base`。ファイルパスとコマンドから辿る。
- **タグ**（`tag-mappings`）→ `expanded`。`intent_tags` から辿る。パスに相関しない意図がここに乗る。例と追加基準は AGENTS.md step 2 と ADR-0023 を参照。
- **使い所**: `/start-workflow` step 2 で `aegis_compile_context({ target_files, plan, command, intent_tags })` を呼び、関連 ADR / ルールを relevance スコア付きで取得。カタログは `aegis_get_known_tags` で引く。subagent dispatch 前は `pre-agent-aegis-guard.sh` が未呼び出しをブロック。
- **データ**: `aegis-share/`（git 管理の共有バンドル: `source/documents/` の Markdown + `source/edges/` の glob→doc_id + `source/tag-mappings.json` の tag→doc_id）と `.aegis/aegis.db`（gitignore 済みローカル SQLite、SessionStart で自動構築）。`manifest.json` の `includes_tag_mappings` が false なら `expanded` は発火しない。
- **メンテ**: `aegis-share/source/` が canonical。新規 ADR・既存編集とも `source/documents/`（+必要なら `source/edges/`）を編集し、`share-format` → `share-lint` → `share-materialize` → `share-export` で DB とバンドルへ反映（`aegis_import_doc` の直接投入は source と乖離を生むため使わない）。`aegis_sync_docs` は file-anchored な文書を再アンカーする道具で、ADR-0021 以降どの文書も file-anchored ではないため実質 no-op。compile miss は `aegis_observe` → `/aegis-triage`。
- 詳細は `aegis-share/source/documents/` の ADR を参照。

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
| `ask` | 確認が必要な操作 | `git commit`, `git push`, `gh pr create`, `deploy`, `bunx`, 未登録の `bun run` |
| `allow` | 自由に実行可能 | 参照系の git/gh に加えて `git add` / `git stash` / `gh api`（後者は `-X POST` で書き込める — read-only ではない）, ゲート用の個別 `bun run` スクリプト (lint/check/typecheck/test/knip 等), `bun add -E`, `tree`/`ls`/`grep`, `find` |

`find` はルールでは `allow` だが、`pre-bash-guard.sh` が危険な形だけ**拒否**する
（探索起点が `.` / `..` / `/` / `~` / 変数 / 絶対パス / 起点なし、または
`-exec` / `-delete` 系）。`find . -type f | xargs cat` は allow のコマンドだけで
保護ファイルを読めるため、`-exec` の有無ではなく起点で見る必要がある。起点は
複数取れるので全部見る。確認ではなく拒否なのは、hook の `ask` が allow 済み
コマンドに効くかが未確認で、黙って何もしないガードより厳しい方を選んだため。
ADR-0004 の 2026-07-29 amend、検査は `scripts/test-bash-guard.py`。

参照: ADR-0004

`.claude/agents/` の2エージェント（`code-reviewer` / `spec-verifier` —
ADR-0029 が `review-verifier` / `spec-checker` を削除した後の構成）は
`permissionMode: auto` で動くため、上の表のうち **`allow` にも `ask` にも
載っていない Bash** は対話プロンプトではなく分類器の審査を通る。`deny` と
`ask` はそのまま効く（`ask` は auto でもプロンプトを出す —— ADR-0004 の
2026-07-28 amend）。理由と出典は AGENTS.md「Permission mode for the pinned
agents」。

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
| `pre-agent-aegis-guard.sh` | Agent dispatch | `.aegis-stamp` 不在をブロック（例外リストの実体はフック内の `case` 文。2つのレビュー/spec エージェント（`code-reviewer` / `spec-verifier`、ADR-0029 で4つから統合）とハーネス組み込みのものが除外される — ここに写すと古くなるので数えない）。Aegis 不在の環境は `.aegis-unavailable` マーカーで明示的に degrade — ADR-0013 |
| `pre-agent-review-clear.sh` | Agent dispatch (code-reviewer) | dispatch＝新サイクル開始。前サイクルの `.review-stamp` をリセットする（ハッシュは記録しない — ADR-0029 でペアリング検査自体が第二 dispatch と一緒に無くなったため） |
| `pre-bash-guard.sh` | Bash | 4つのガード（`.env` 遮断 / `find` の到達範囲制限 / ゲートのマーカー参照拒否 / コミットゲート）。判定条件はフック冒頭の番号付きコメントが正 — ADR-0004・ADR-0024 |
| `lib-commit-shape.sh` | （フックではない。source される） | 「このコマンドはコミットを着地させるか」の**唯一の定義**（`pre-bash-guard.sh` と `post-bash-stamp-consume.sh` が共有。2つの手書き正規表現がずれて穴になったため — ADR-0024）。ペアリング用ツリーハッシュを定義していた `lib-review-hash.sh` は `pre-agent-review-pair.sh` ごと ADR-0029 で削除された |

**ツール実行後 (PostToolUse)** — 同期・スタンプ:

| Hook | トリガー | 役割 |
|------|---------|------|
| `post-aegis-compile.sh` | aegis_compile_context | `.aegis-stamp` を作成（dispatch ゲートの成果物）+ エッジの glob がファイルにマッチしなかった場合に警告 |
| `post-aegis-share-sync.sh` | aegis_sync_docs / import_doc | DB → `aegis-share/` を同期 |
| `post-bash-stamp-consume.sh` | Bash | `git commit` 後にツリーがクリーンなら `.review-stamp` を消費（ADR-0019。1スタンプで分割コミットは通し、タスク越えはさせない） |

**サブエージェント完了時 (SubagentStop)** — レビューゲートのスタンプ:

| Hook | トリガー | 役割 |
|------|---------|------|
| `post-agent-review-stamp.sh` | code-reviewer の**完了** | `code-reviewer` が完走し、かつ `last_assistant_message` が空でないときだけ `.review-stamp` を作成する（ADR-0029）。ゲートが依拠する事実はこれ一つ——「エージェントが何かを報告して完走した」。呼び出し引数が `finder` / `verifier` / 無指定のどれでも同じに扱う（設定の再読込タイミングが未確認なため、キャッシュされた旧登録が残っても壊れないように — `scripts/test-review-gate.py` が三通りとも検証）。`PostToolUse(Agent)` ではなく `SubagentStop` に登録されている理由は ADR-0022 のまま — Agent ツールは**起動**した時点で返るので、PostToolUse では「派遣した」ことしか証明できない |

**セッション終了時 (Stop)** — 最終ゲート:

| Hook | 役割 |
|------|------|
| `stop-gate.sh` | typecheck + lint + format + knip + similarity（コード系ファイルの変更時のみ）+ markdown リンク切れチェック（リポジトリ全体。リンク先の削除で他ファイルのリンクが死ぬケースを拾うため差分に絞らない）+ aegis 同期チェック。`stop_hook_active` の 2 周目は警告に降格し無限ループを防ぐ。similarity-ts / python3 未導入はスキップとして明示 |

### コミットゲート

```
ゲートのライフサイクル (単一エージェント、ADR-0029 — ADR-0015 のフラット
finder→verifier からの統合):

  スタンプが依拠する事実は1つだけになった:
    「code-reviewer が完走し、何かを報告した」 → SubagentStop でしか判定できない

  ADR-0022 まではここにもう1つの事実があった——「親が2体のエージェントの間で
  編集していない」。dispatch が1回になったことで「間」そのものが無くなり、
  この事実は判定対象から消えた（下記「残存ギャップ」）。

  .review-stamp (コミットゲート。現存する唯一のマーカー):
    作成: code-reviewer 完走時、last_assistant_message が空でないときだけ
          (post-agent-review-stamp.sh — SubagentStop 登録)

  削除された3マーカー (ADR-0029、第二 dispatch と一緒に撤去):
    .finder-done / .finder-hash / .pair-ok
    — それぞれ「finder が完走した証明」「その時点のツリーのハッシュ」
      「ペアリング成立の証明」を実装していたが、いずれも「2回の dispatch の
      間に親が編集していないか」を判定するためだけに存在した。判定対象自体が
      無くなったので、3つとも実体が要らなくなった。

  消え方は変わらず原則で覚える（実体は .gitignore の `.claude/.*` エントリと
  各フックの rm -f。ADR-0027/0028 の「session_id が一致し、かつ source が
  clear/fork でないときだけ残す」規則は、対象マーカーが4つから1つに減っても
  そのまま適用される）:
    ・新サイクル開始イベントは .review-stamp をリセットする
      — code-reviewer dispatch (pre-agent-review-clear.sh)
      / aegis_compile_context 呼び出し (pre-aegis-compile-guard.sh)
      / セッション開始 (session-start-env-check.sh — 条件付き、同一セッション
        再発火時は保持。ADR-0027)
    ・git commit 後にツリーがクリーンなときに消費される (post-bash-stamp-consume.sh、
      ADR-0019。1スタンプで分割コミットは通し、タスク越えはさせない)
    ・Edit・Write では消えない — 所見の修正で再レビューを起こさないため
      (ADR-0019 が ADR-0013 の該当判断を amend)

  → stamp は「code-reviewer が完走し、何かを報告した」ことの証明でしかない。
  → レビューがエラー/中断で完走しなければ stamp は付かず、stale stamp は残らない。

  残存ギャップ (ADR-0029 が承知の上で受け入れたリスク。scripts/test-review-gate.py
  の「the stamp is not bound to the tree」節がこの性質を固定している):
    2エージェント時代は .finder-hash が「finder 完走時のツリー」を基準点として
    持っていたため、2回の dispatch の間に親が編集すれば stamp は付かなかった。
    dispatch が1回になった今、その基準点はどこにも無い。だから **エージェントが
    実行している最中に親がファイルを編集すると、エージェントが一度も読んで
    いないツリーに対して stamp が付いてしまう**。dispatch → 完了の区間をハッシュ
    で挟む案は ADR-0022 の時点で両端とも試されて失敗している（エージェント自身が
    Bash で作る一時ファイルがその区間に入り込み、無実の pass を無効化した）ため、
    今回も採用されていない。埋め合わせは仕組みではなく規律で、`review-diff`
    step 0 の「Ordering」スロットが「dispatch 中は編集しない」と親に明示させる
    一文があるだけ——強制する hook は無い。
  → コミット分割は編集を伴わないので、1 回のレビューで複数コミットに分割できる
  不在時 → git commit は pre-bash-guard.sh がブロック
```

### ルール (`AGENTS.md`)

毎セッションにロードされるコーディング規約。Design Philosophy / Knowledge Currency / Code Practices / Rules of React / Testing / Commits / Agents の各セクションとして凝縮。パススコープの詳細ルール (`.claude/rules/react.md`、`design.md`) は対象パス編集時に自動ロード。

参照: ADR-0008

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

参照: ADR-0002

### Aegis ナレッジベース

```
canonical は aegis-share/source/（import_doc の直接投入は乖離を生むため不使用）

[新しい ADR の追加]  source/documents/adr-NNNN.md を書く（frontmatter + 本文。写しは無い）
                     + source/edges/*.json に必要な edge を追加
                     → npx aegis share-format → share-lint → share-materialize → share-export（4 コマンドを順に実行）
[既存 ADR の編集]    source/documents/adr-NNNN.md を編集（写しは無い）
                     → 同上の share パイプライン（doctor で in_sync を確認）
[タグの追加]         source/tag-mappings.json に {tag, doc_id, confidence, source} を追加
                     → 同上の share パイプライン
                     ※ 追加基準は ADR-0023 / AGENTS.md step 2。エッジで既に
                       到達できる文書へのタグは足さない（語彙だけ増える）
[hydrate 直後]       追加操作なし（file-anchored な文書は無い / ADR-0021）
[compile miss]       aegis_observe({ event_type: "compile_miss", ... })
                     → /aegis-triage で分析 → proposals → 承認
```

### ADR

非自明な設計判断がされたら新しい ADR を追加。MADR-lite テンプレートを使用（AGENTS.md の「ADR form」参照）。番号は厳密に連番。

### スキル / エージェント / プロンプトのチューニング

新規作成・大幅編集時は [`/empirical-prompt-tuning`](../.claude/skills/empirical-prompt-tuning/SKILL.md) を使用。2 回連続で新たな曖昧さが出なくなるまで改善。ただし `code-reviewer` agent（ADR-0029 で `review-verifier` を統合済み）と `review-diff` skill の load-bearing な変更、およびそのモデル階層変更は、ADR-0014/0029 によりスコア付き golden eval（`scripts/evals/review-diff/`）の実走が必須（この点で empirical-prompt-tuning の従来義務を置換）。ADR-0029 自体の実走ゲートは `results/2026-07-29-briefing-skeleton.md` のベースラインとの比較——統合後のパイプラインが期待所見を落とす、または無害な fixture に過検知するなら、単発ノイズの範囲を超えた分だけこの ADR は revert 対象になる（ADR-0029 の Consequences）。`spec-verifier` agent（ADR-0029 で `spec-checker` を統合済み）も同じ regime。eval は `scripts/evals/verify-spec/`（tier を判別する fixture sx-01..03）に整備済みで、モデル階層の変更にはスコア付き実走が必須 — 2026-07-12 の比較が両エージェントを opus に据えたので、降格するならその結果を上回る新しい実走が必要（ADR-0014 内の 2026-07-12 解決メモ / AGENTS.md「Model continuity」）。

### 監査 / eval サイクル（ADR-0014）

決定論ゲート・fresh-context レビューが日々の品質を担保する一方、それらが構造的に拾えない領域と、最良モデルの判断そのものの陳腐化を、2 つのオンデマンド機構で補う。

```
[repo-audit]   /repo-audit — オンデマンド（スケジュール実行しない）
  最良モデルで 4 レーン監査（アーキテクチャドリフト / セキュリティ /
  依存戦略 / docs·DX）。lint·型·テスト·dead-code·フォーマットはゲートが持つので対象外。
  成果物は既存レールのみに振り分ける（新形式を作らない）:
    · 知識（規約・判断）→ ADR / AGENTS.md → aegis-share フロー
    · 作業（直す・作る）→ 監査サマリでユーザーに報告 → /start-workflow
  2 回連続で空振りしたら skill 自体の削除を提案（ADR-0011 の教訓）。

[golden eval]  scripts/evals/review-diff/
  review パイプラインの回帰検出器。シード欠陥パッチ + 期待所見で
  code-reviewer を採点。model 階層・load-bearing skill の変更時に実走し
  results/ に記録（上記チューニング項の必須要件）。
```

参照: ADR-0014

---

## 6. 特殊フロー

| 状況 | 対応 |
|------|------|
| 原因不明のバグ | `superpowers:systematic-debugging` を挿入 |
| レビューを走らせる | `/review-diff`（= 親が `code-reviewer` を1体 dispatch、内部で find → dedup → refute → return、`high` で refute を深掘り、ADR-0029）。所見を修正したらそこで終わり、再実行は不要（ADR-0019） |
| リポジトリ健全性の点検 | `/repo-audit` — ゲートが拾えない領域を最良モデルで監査し既存レールへ (ADR-0014) |
| 設計の状態遷移だけ検証 | `spec-verifier` agent を dispatch (= `/verify-spec specs/<feature>.spec.md`)。内部で formalize → hunt → replay → return が走る (ADR-0029) |
| 並列マルチエージェント | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` をセッション単位で自分でセット（settings.json ではデフォルト無効） |
| agent / skill 自体の編集 | `/empirical-prompt-tuning` で検証してからマージ（`code-reviewer`/`review-diff` の load-bearing 変更とモデル階層変更は ADR-0014/0029 の golden eval 必須 — §5 参照） |
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
| `code-reviewer` | `review-diff` | コミット前レビューを単独で完走（find→dedup→refute→return の4段階、完走でゲート stamp）(ADR-0029、`review-verifier` を統合) |
| `spec-verifier` | `verify-spec` | spec 検証を単独で完走（formalize→hunt→replay→return の4段階、反例候補の再生検証まで行う）(ADR-0029、`spec-checker` を統合) |
| `Explore` | — | 読み取り専用の探索・検索 |
| `general-purpose` | — | 汎用（並列実装ユニット） |

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
| 状態機械の仕様 | `.claude/skills/verify-spec/SKILL.md` の Format セクション |
| Hooks | [`.claude/hooks/`](../.claude/hooks/) + [`.claude/settings.json`](../.claude/settings.json) |
| パーミッション | [`.claude/settings.json`](../.claude/settings.json) |
| MCP サーバー | [`.mcp.json`](../.mcp.json) |
| ADR | `aegis-share/source/documents/` |
| CI | [`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml)（呼ぶスクリプトは ci.yaml のステップ一覧が実体） |
| 依存自動更新 | [`.github/dependabot.yml`](../.github/dependabot.yml) |
