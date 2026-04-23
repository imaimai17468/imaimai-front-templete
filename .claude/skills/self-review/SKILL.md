---
name: self-review
description: 作業完了（"done" / "完了" と報告）する前の自己点検。コーディング規約は stop-agent-review hook が見るので割愛し、(1) 新規分岐のテストカバレッジ漏れ、(2) 使われないコード・過剰抽象化 (YAGNI)、(3) null/undefined/off-by-one 等の疑わしいバグパターン、を未コミット差分から洗い出して修正まで行う。複数ファイルにまたがる実装・条件分岐追加・新規ファイル作成を伴う作業の直後に自律的に起動する。自明な 1 行修正・設定変更・コメント追加のみの作業ではスキップ。
---

# Self Review

"done" と宣言する前の最終セルフチェック。**stop-agent-review hook と役割分担**しており、このスキルはコーディング規約準拠チェック（style / architecture / dependencies）は見ない。hook に任せる。

---

## 起動条件

**起動する**:

- 複数ファイルを編集 or 新規ファイルを作成した
- 条件分岐（`if` / 三項 / `switch` / ガード節）を増やした
- pure 関数を追加した
- Container / Presenter を新規作成した

**起動しない**:

- 1 行修正 / タイポ / コメントのみの変更
- 設定ファイル (`package.json`, `*.json`, `*.toml`, `.gitignore`) だけの変更
- ドキュメント (`*.md`) だけの変更
- 既に同ターンで review 済み

---

## 観点（この 3 つだけ）

### 1. テストカバレッジの漏れ

追加した分岐・新規 pure 関数・新規 Presenter（props で出し分けがある / a11y 属性がある）に対応するテストが存在し、分岐を網羅しているかを確認する。

- **Pure 関数**: 常に必須。同ディレクトリに `*.test.ts` があり、全分岐をカバーしているか
- **Presenter**: props / state で出し分け or a11y 属性あり → テスト必須
- **Container**: データ取得モック + Presenter に渡す props を検証しているか
- 既存テストファイルに分岐を足した場合、対応する `it()` が増えているか

不足があれば、`.claude/rules/testing.md` の AAA + "should [expected] when [condition]" 形式でテストを追加してから done する。

### 2. YAGNI / 過剰設計 / dead code

AGENTS.md の「bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper」に照らして、**その場の要件を超えた追加**がないか diff を読み直す。

チェック:

- **使われていない export / 関数 / 変数**（knip 相当だが diff 直後の目視チェック）
- **1 箇所しか呼ばれないヘルパー関数**をわざわざ抽出していないか（3回目まではインライン）
- **存在しないシナリオ向けの error handling / fallback / validation**（内部コードは信頼、境界だけ検証）
- **バックコンパット shim / 機能フラグ / `// removed` コメント**のような不要な保険
- **空の try/catch、呑み込み catch**
- **1 回しか通らない分岐 / 到達不能コード**
- **役に立たないコメント**（`// WHAT` の説明コメント。残すのは WHY / 非自明な不変条件 / 罠だけ）

該当すれば削除 or インライン化してから done する。

### 3. 疑わしいバグパターン

規約違反ではないが、実行時に壊れやすい箇所を目視で洗う。型チェック (`tsgo`) は hook で走るが、それでは捕まらない意味論的バグを対象にする。

チェック:

- **null / undefined アクセス**: optional chaining / nullish coalescing が抜けていないか。`data.items.map(...)` で `items` が undefined の可能性はないか
- **off-by-one**: `slice` / `substring` の境界、ページネーションの開始 index、`length - 1` 系
- **配列の空チェック**: `[0]` / `.find()` 結果を undefined チェックせず使っていないか
- **非同期の await 漏れ**: Promise を返す関数を `await` せずに使っていないか（特に `setInterval` / `useEffect` cleanup）
- **useEffect 依存配列**: 依存の欠落 / 過剰で stale closure や再レンダリングループが起きないか
- **型アサーション (`as`) の乱用**: unsafe cast が実行時に壊れる余地を残していないか
- **境界値**: 0 / 負数 / 空配列 / 空文字列 / 最大値 を入力されて破綻しないか

該当すれば修正 or ガード追加してから done する。

---

## 手順

1. `git diff HEAD` で未コミット差分を取得。diff の情報だけで判断できない実装詳細（cleanup / 依存配列 / 初期 state 等）がある箇所は、対応するファイルを Read で直接確認する。
2. 上記 3 観点で読み直し、発見を箇条書きで内部メモ。**該当なしの観点はログに出さず沈黙する**（「YAGNI: 該当なし」のようなノイズは書かない）。
3. 発見が 0 件なら「self-review: clean」とだけ報告して done。
4. 発見があれば、重要度順に修正する。
5. 修正後は `bun run typecheck` / `bun run test` で該当箇所が壊れていないか検証する。壊れていれば 4 に戻る。
6. done 報告時に修正した項目を 1 行ずつ列挙する。

**出力方針**: 発見ゼロの時の報告は 1 行。発見ありの時は「修正した項目 N 件」＋箇条書き。長文レビューログは書かない（人間が diff を読めば分かる）。
