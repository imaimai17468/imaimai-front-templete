# MCP詳細コマンドリファレンス

このファイルは、Next.js MCP、Chrome DevTools MCP、Browser Eval MCPの詳細なコマンドとパラメータを記載したリファレンスです。

[CLAUDE.md](./CLAUDE.md) の Phase 9 で使用する詳細なコマンドを参照する際に使用してください。

---

## 目次

1. [Kiri MCP](#kiri-mcp)
2. [Serena MCP](#serena-mcp)
3. [Next.js Runtime MCP](#nextjs-runtime-mcp)
4. [Next.js Documentation MCP](#nextjs-documentation-mcp)
5. [Chrome DevTools MCP](#chrome-devtools-mcp)
6. [Browser Eval MCP](#browser-eval-mcp)

---

## Kiri MCP

コードベース検索とコンテキスト抽出に特化したMCPです。Serenaよりも高度な検索機能を提供します。

### 主な機能

#### 1. コンテキストバンドル取得（最重要）
```
mcp__kiri__context_bundle
goal: 'User authentication flow, JWT token validation'
limit: 7  # 取得するスニペット数（デフォルト: 7）
compact: true  # メタデータのみ（デフォルト: true、トークン消費を95%削減）
```

**説明**: タスクや質問に関連するコードスニペットをAIが自動的にランク付けして取得します。

**特徴**:
- フレーズ認識: `page-agent`, `user_profile` などの複合語を単一フレーズとして認識
- パスベーススコアリング: キーワードがファイルパスに含まれるとスコアが上がる
- ファイルタイプ優先度: 実装ファイルをドキュメントより優先（設定可能）
- 依存関係分析: インポート関係を考慮
- セマンティック類似度: クエリとの構造的類似性でランク付け

**goalパラメータの書き方**:
- ✅ 良い例: `'User authentication flow, JWT token validation'`
- ✅ 良い例: `'Canvas page routing, API endpoints, navigation patterns'`
- ✅ 良い例: `'page-agent Lambda handler implementation'`
- ❌ 悪い例: `'Understand how canvas pages are accessed'` (抽象的な動詞)
- ❌ 悪い例: `'understand'` (単語のみ)
- ❌ 悪い例: `'fix bug'` (具体性がない)

**compactモードの使い方**:
- `compact: true`: メタデータのみ（path, range, why, score）、トークン消費を95%削減
- `compact: false`: コードプレビューも含む

**推奨ワークフロー**（2段階アプローチ）:
1. `context_bundle({goal: 'auth handler', compact: true, limit: 10})` → 候補リスト取得
2. 結果からパスとスコアを確認
3. `snippets_get({path: result.context[0].path})` → 必要なファイルのみ取得

#### 2. ファイル検索
```
mcp__kiri__files_search
query: 'validateToken'  # 具体的な関数名、クラス名、エラーメッセージ
lang: 'typescript'  # オプション: 言語でフィルタ
ext: '.ts'  # オプション: 拡張子でフィルタ
path_prefix: 'src/auth/'  # オプション: パスプレフィックスでフィルタ
limit: 50  # 最大結果数（デフォルト: 50）
```

**説明**: 具体的なキーワードや識別子でファイルを検索します。

**いつ使うか**:
- ✅ 特定の関数名、クラス名がわかっている: `query: 'validateToken'`
- ✅ 正確なエラーメッセージ: `query: 'Cannot read property'`
- ✅ 特定のインポートパターン: `query: 'import { jwt }'`
- ❌ 広範な調査: `'understand authentication'` → `context_bundle`を使用

#### 3. コードスニペット取得
```
mcp__kiri__snippets_get
path: 'src/auth/login.ts'
start_line: 10  # オプション
end_line: 50  # オプション
```

**説明**: 特定のファイルからコードスニペットを取得します。シンボル境界（関数、クラス、メソッド）を認識して適切なセクションを抽出します。

**使い方**:
- ファイルパスがわかっている場合に使用
- `start_line`を指定すると、その行を含む最も関連性の高いシンボルを取得
- ファイル全体を読み込むよりトークン効率が良い

#### 4. セマンティック再ランク
```
mcp__kiri__semantic_rerank
text: 'user authentication flow'
candidates: [
  {path: 'src/auth/login.ts', score: 0.8},
  {path: 'src/auth/register.ts', score: 0.7}
]
k: 5  # 上位N件を返す
```

**説明**: ファイル候補リストをセマンティック類似度で再ランク付けします。

**いつ使うか**:
- `files_search`の結果を絞り込みたい場合
- 複数の候補から最も関連性の高いものを選びたい場合

**注意**: `context_bundle`は内部で自動的にセマンティックランキングを行うため、併用は不要です。

#### 5. 依存関係クロージャ
```
mcp__kiri__deps_closure
path: 'src/utils.ts'
direction: 'inbound'  # 'inbound' または 'outbound'
max_depth: 3  # トラバース深度（デフォルト: 3）
include_packages: false  # 外部パッケージも含める
```

**説明**: ファイルの依存関係グラフをトラバースします。

**direction**:
- `inbound`: このファイルに依存しているファイルを取得（影響範囲分析）
- `outbound`: このファイルが依存しているファイルを取得（依存チェーン）

**いつ使うか**:
- リファクタリング時の影響範囲を調べる
- モジュール境界を理解する
- 循環依存を発見する
- 変更が影響するファイルを特定する

**例**:
```
# src/utils.tsを変更した場合、どのファイルが影響を受けるか
mcp__kiri__deps_closure
path: 'src/utils.ts'
direction: 'inbound'
max_depth: 3
```

### Kiri vs Serena

| 機能 | Kiri | Serena |
|------|------|--------|
| **コードベース検索** | ⭐ 高度（セマンティック検索、フレーズ認識） | 基本（パターンマッチング） |
| **コンテキスト抽出** | ⭐ 自動ランク付け、トークン効率的 | 手動でシンボル検索 |
| **シンボル操作** | ❌ なし | ⭐ あり（編集、リネーム、挿入） |
| **依存関係分析** | ⭐ グラフトラバース | 参照検索のみ |
| **メモリ機能** | ❌ なし | ⭐ あり |

**推奨使い分け**:
- **Phase 1（調査）**: Kiriを優先（`context_bundle`, `files_search`）
- **Phase 5（実装）**: Serenaを使用（`replace_symbol_body`, `insert_after_symbol`など）

### 使用例

#### 例1: 新機能の調査
```
# 1. 関連コードを自動取得
mcp__kiri__context_bundle
goal: 'user authentication, login flow, session management'
limit: 10
compact: true

# 2. 必要なファイルの詳細を取得
mcp__kiri__snippets_get
path: 'src/auth/login.ts'
```

#### 例2: バグ修正の影響範囲調査
```
# 1. バグのあるファイルを検索
mcp__kiri__files_search
query: 'calculateTotal'
lang: 'typescript'

# 2. 依存関係を調査（影響範囲）
mcp__kiri__deps_closure
path: 'src/utils/calculations.ts'
direction: 'inbound'
max_depth: 2
```

#### 例3: 特定エラーメッセージの調査
```
# エラーメッセージで検索
mcp__kiri__files_search
query: 'TypeError: Cannot read property'
limit: 20
```

**使用タイミング**: Phase 1（調査フェーズ）で積極的に活用してください。

---

## Serena MCP

シンボルベースのコード編集と操作に特化したMCPです。

**主な機能**:
- シンボル検索（`find_symbol`, `get_symbols_overview`）
- シンボル編集（`replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol`）
- シンボルリネーム（`rename_symbol`）
- 参照検索（`find_referencing_symbols`）
- パターン検索（`search_for_pattern`）
- メモリ機能（`write_memory`, `read_memory`）

**使用タイミング**: Phase 5（実装フェーズ）でコード編集が必要な場合。

詳細は元々のSerena MCPドキュメントを参照してください。

---

## Next.js Runtime MCP

Next.js開発サーバーのランタイム情報を取得するためのMCPです。

### サーバー検出とツール一覧

#### サーバー検出
```
mcp__next-devtools__nextjs_runtime
action: 'discover_servers'
```

**説明**: 実行中のNext.js開発サーバーを自動検出します。

#### 利用可能なツールを確認
```
mcp__next-devtools__nextjs_runtime
action: 'list_tools'
port: <検出したポート番号>
```

**説明**: Next.js MCPが提供するすべてのツールとそのスキーマを取得します。

### ランタイムエラー・警告の確認

#### ビルドエラー・ランタイムエラーを取得
```
mcp__next-devtools__nextjs_runtime
action: 'call_tool'
port: <ポート番号>
toolName: 'get-errors'
```

**説明**: 現在のビルドエラーやランタイムエラーを取得します。

**使用タイミング**: Phase 9Aで必須。エラーがゼロであることを確認します。

#### ログを取得
```
mcp__next-devtools__nextjs_runtime
action: 'call_tool'
port: <ポート番号>
toolName: 'get-logs'
```

**説明**: Next.js開発サーバーのログを取得します。

#### 診断情報を取得
```
mcp__next-devtools__nextjs_runtime
action: 'call_tool'
port: <ポート番号>
toolName: 'get-diagnostics'
```

**説明**: システムの診断情報（メモリ使用量、CPU使用率など）を取得します。

### ルート情報の取得

#### アプリケーションのルート構造を取得
```
mcp__next-devtools__nextjs_runtime
action: 'call_tool'
port: <ポート番号>
toolName: 'get-routes'
```

**説明**: アプリケーション内のすべてのルート（App Router）を一覧表示します。

**使用タイミング**: Phase 9Aで推奨。すべてのルートが正しく認識されているか確認します。

#### 特定ルートの詳細情報を取得
```
mcp__next-devtools__nextjs_runtime
action: 'call_tool'
port: <ポート番号>
toolName: 'get-route-info'
args: {path: '/your-route'}
```

**説明**: 特定のルートに関する詳細情報（コンポーネント、レンダリング戦略など）を取得します。

**注意**: `args`パラメータは必ずオブジェクトとして渡す必要があります。

### キャッシュ・ビルド状態の確認

#### キャッシュ情報を取得
```
mcp__next-devtools__nextjs_runtime
action: 'call_tool'
port: <ポート番号>
toolName: 'get-cache-info'
```

**説明**: Next.jsのキャッシュ状態を取得します。

#### キャッシュをクリア
```
mcp__next-devtools__nextjs_runtime
action: 'call_tool'
port: <ポート番号>
toolName: 'clear-cache'
```

**説明**: Next.jsのキャッシュをクリアします。

**使用タイミング**: 古いキャッシュが原因で問題が発生している場合。

---

## Next.js Documentation MCP

Next.js 16の最新ドキュメントを検索するためのMCPです。

### ドキュメント検索

```
mcp__next-devtools__nextjs_docs
query: '検索キーワード'
category: 'api-reference'  # または 'guides', 'getting-started', 'all'
```

**カテゴリ一覧:**
- `all`: すべてのドキュメント
- `getting-started`: 入門ガイド
- `guides`: ガイドとベストプラクティス
- `api-reference`: APIリファレンス
- `architecture`: アーキテクチャ
- `community`: コミュニティ

**使用タイミング**: Phase 1で特定のNext.js機能について調査する際。

---

## Chrome DevTools MCP

ブラウザの詳細な動作確認とテストを行うためのMCPです。

### ページ管理

#### ページ一覧を取得
```
mcp__chrome-devtools__list_pages
```

**説明**: 現在開いているすべてのページを一覧表示します。

#### 新しいページを作成
```
mcp__chrome-devtools__new_page
url: 'http://localhost:3000/your-route'
timeout: 30000  # オプション：ミリ秒
```

**説明**: 新しいタブでURLを開きます。

#### ページを選択
```
mcp__chrome-devtools__select_page
pageIdx: 0
```

**説明**: 操作対象のページを選択します。以降のコマンドはこのページに対して実行されます。

#### ページに移動
```
mcp__chrome-devtools__navigate_page
url: 'http://localhost:3000/your-route'
timeout: 30000  # オプション
```

**説明**: 現在選択されているページを指定したURLに移動します。

#### ページを閉じる
```
mcp__chrome-devtools__close_page
pageIdx: 1
```

**説明**: 指定したインデックスのページを閉じます。最後のページは閉じられません。

#### ページ履歴を移動
```
mcp__chrome-devtools__navigate_page_history
navigate: 'back'  # または 'forward'
timeout: 30000
```

**説明**: ブラウザの戻る/進むボタンと同じ動作をします。

### ページ構造の確認

#### アクセシビリティツリーのスナップショット
```
mcp__chrome-devtools__take_snapshot
verbose: false  # 詳細情報が必要な場合はtrue
```

**説明**: ページのアクセシビリティツリー（テキストベース）を取得します。各要素には一意の`uid`が付与されます。

**重要**: この`uid`は他のコマンド（`click`, `fill`など）で要素を指定する際に使用します。

**使用タイミング**: インタラクション前に必ず実行。要素の`uid`を取得します。

#### スクリーンショット
```
mcp__chrome-devtools__take_screenshot
fullPage: true      # フルページ（true）またはビューポートのみ（false）
format: 'png'       # 'png', 'jpeg', 'webp'
quality: 90         # JPEG/WebP用（0-100）
uid: '<要素uid>'    # オプション：特定要素のみ
filePath: '/path/to/save.png'  # オプション：保存先
```

**説明**: ページまたは特定要素のスクリーンショットを取得します。

**使用タイミング**: ビジュアル確認が必要な場合、またはデバッグ時。

### インタラクション

#### 要素をクリック
```
mcp__chrome-devtools__click
uid: '<snapshot内の要素uid>'
dblClick: false  # ダブルクリックの場合はtrue
```

**説明**: 指定した要素をクリックします。

**注意**: クリック前に必ず`take_snapshot`で`uid`を取得してください。

#### フォーム入力
```
mcp__chrome-devtools__fill
uid: '<input要素のuid>'
value: '入力値'
```

**説明**: input要素、textarea、select要素に値を入力します。

#### フォーム一括入力
```
mcp__chrome-devtools__fill_form
elements: [
  {uid: '<uid1>', value: '値1'},
  {uid: '<uid2>', value: '値2'},
  {uid: '<uid3>', value: '値3'}
]
```

**説明**: 複数のフォーム要素に一度に入力します。

**使用タイミング**: 複数フィールドがあるフォームのテスト時。

#### ホバー
```
mcp__chrome-devtools__hover
uid: '<要素uid>'
```

**説明**: 要素にマウスホバーします。

**使用タイミング**: ホバーエフェクトやツールチップの確認時。

#### ドラッグ&ドロップ
```
mcp__chrome-devtools__drag
from_uid: '<ドラッグ元のuid>'
to_uid: '<ドロップ先のuid>'
```

**説明**: 要素を別の要素にドラッグ&ドロップします。

#### ファイルアップロード
```
mcp__chrome-devtools__upload_file
uid: '<file input要素のuid>'
filePath: '/path/to/file.jpg'
```

**説明**: ファイル入力要素にファイルをアップロードします。

#### 待機
```
mcp__chrome-devtools__wait_for
text: '表示されるテキスト'
timeout: 30000
```

**説明**: 指定したテキストがページに表示されるまで待機します。

**使用タイミング**: 非同期処理の完了待ち、ページ遷移後の確認。

#### ダイアログ処理
```
mcp__chrome-devtools__handle_dialog
action: 'accept'  # または 'dismiss'
promptText: 'プロンプトに入力するテキスト'  # オプション
```

**説明**: alert、confirm、promptダイアログを処理します。

### JavaScriptの実行

#### カスタムスクリプト実行
```
mcp__chrome-devtools__evaluate_script
function: '() => { return document.title; }'
```

**説明**: ページ内でJavaScript関数を実行し、結果を取得します。

**例（要素を引数として渡す）:**
```
mcp__chrome-devtools__evaluate_script
function: '(el) => { return el.innerText; }'
args: [{uid: '<要素uid>'}]
```

**注意**: 戻り値はJSON-serializable である必要があります。

### ネットワーク・コンソール確認

#### コンソールメッセージ一覧
```
mcp__chrome-devtools__list_console_messages
types: ['error', 'warn']  # エラーと警告のみ。全タイプは下記参照
pageSize: 50
pageIdx: 0
includePreservedMessages: false  # 過去3ナビゲーション分も含める場合true
```

**メッセージタイプ:**
- `log`, `debug`, `info`, `error`, `warn`
- `dir`, `dirxml`, `table`, `trace`
- `clear`, `startGroup`, `startGroupCollapsed`, `endGroup`
- `assert`, `profile`, `profileEnd`, `count`, `timeEnd`, `verbose`

**説明**: ブラウザコンソールのメッセージ一覧を取得します。

**使用タイミング**: Phase 9Bでコンソールエラー・警告がないか確認する際。

#### 特定のコンソールメッセージ詳細
```
mcp__chrome-devtools__get_console_message
msgid: <メッセージID>
```

**説明**: 特定のコンソールメッセージの詳細情報を取得します。

#### ネットワークリクエスト一覧
```
mcp__chrome-devtools__list_network_requests
resourceTypes: ['xhr', 'fetch']  # API通信のみ。全タイプは下記参照
pageSize: 50
pageIdx: 0
includePreservedRequests: false
```

**リソースタイプ:**
- `document`, `stylesheet`, `image`, `media`, `font`, `script`
- `texttrack`, `xhr`, `fetch`, `prefetch`, `eventsource`, `websocket`
- `manifest`, `signedexchange`, `ping`, `cspviolationreport`, `preflight`, `fedcm`, `other`

**説明**: ネットワークリクエスト一覧を取得します。

**使用タイミング**: Phase 9BでAPIリクエストが正常か確認する際。

#### 特定のリクエスト詳細
```
mcp__chrome-devtools__get_network_request
reqid: <リクエストID>
```

**説明**: 特定のネットワークリクエストの詳細（ヘッダー、ボディ、レスポンスなど）を取得します。

### パフォーマンス測定

#### パフォーマンストレース開始
```
mcp__chrome-devtools__performance_start_trace
reload: true      # ページリロードしてトレース
autoStop: true    # 自動停止（ロード完了後）
```

**説明**: パフォーマンストレースを開始します。

**使用タイミング**: Core Web Vitals（LCP, FID, CLS）を測定する際。

#### トレース停止
```
mcp__chrome-devtools__performance_stop_trace
```

**説明**: パフォーマンストレースを停止し、結果を取得します。

**結果に含まれる情報:**
- Core Web Vitals（LCP, FID, CLS）
- Performance Insights
- タイミング情報

#### パフォーマンスインサイト詳細
```
mcp__chrome-devtools__performance_analyze_insight
insightName: 'LCPBreakdown'  # または 'DocumentLatency'など
```

**説明**: 特定のパフォーマンスインサイトの詳細情報を取得します。

**主なインサイト:**
- `LCPBreakdown`: Largest Contentful Paintの内訳
- `DocumentLatency`: ドキュメント読み込みの遅延
- `RenderBlocking`: レンダリングブロッキングリソース

### エミュレーション

#### CPU スロットリング
```
mcp__chrome-devtools__emulate_cpu
throttlingRate: 4  # 4倍遅い CPUをシミュレート (1-20)
```

**説明**: CPUスロットリングを設定します。1で無効化。

**使用タイミング**: 低スペックデバイスでのパフォーマンスを確認する際。

#### ネットワークスロットリング
```
mcp__chrome-devtools__emulate_network
throttlingOption: 'Slow 3G'
```

**オプション:**
- `No emulation`: スロットリング無効
- `Offline`: オフライン
- `Slow 3G`: 低速3G
- `Fast 3G`: 高速3G
- `Slow 4G`: 低速4G
- `Fast 4G`: 高速4G

**使用タイミング**: 低速ネットワークでの動作を確認する際。

#### ページリサイズ（レスポンシブ確認）
```
mcp__chrome-devtools__resize_page
width: 375   # iPhone SE幅
height: 667
```

**説明**: ページの表示サイズを変更します。

**一般的なサイズ:**
- iPhone SE: 375 x 667
- iPhone 12/13: 390 x 844
- iPad: 768 x 1024
- Desktop: 1920 x 1080

**使用タイミング**: Phase 9Bでレスポンシブデザインを確認する際。

---

## Browser Eval MCP

Playwright を使用したブラウザ自動化のためのMCPです。

**注意**: Chrome DevTools MCPが利用できる場合はそちらを優先してください。Browser Eval MCPはより高度な自動化やテストシナリオに使用します。

### ブラウザ起動
```
mcp__next-devtools__browser_eval
action: 'start'
browser: 'chrome'  # 'chrome', 'firefox', 'webkit'
headless: false    # UIを表示する場合はfalse
```

**説明**: ブラウザを起動します。verboseログは常に有効です。

### ページ移動
```
mcp__next-devtools__browser_eval
action: 'navigate'
url: 'http://localhost:3000'
```

**説明**: 指定したURLに移動します。

### スクリーンショット
```
mcp__next-devtools__browser_eval
action: 'screenshot'
fullPage: true
```

**説明**: ページのスクリーンショットを取得します。

### コンソールメッセージ取得
```
mcp__next-devtools__browser_eval
action: 'console_messages'
errorsOnly: true  # エラーのみ取得
```

**説明**: ブラウザコンソールのメッセージを取得します。

**重要**: Next.jsプロジェクトの場合、`nextjs_runtime` MCPを優先してください。こちらはより詳細な情報を提供します。

### その他のアクション
- `click`: 要素をクリック
- `type`: テキスト入力
- `fill_form`: フォーム一括入力
- `evaluate`: JavaScriptを実行
- `drag`: ドラッグ&ドロップ
- `upload_file`: ファイルアップロード
- `list_tools`: 利用可能なツール一覧

詳細は `action: 'list_tools'` で確認してください。

### ブラウザクローズ
```
mcp__next-devtools__browser_eval
action: 'close'
```

**説明**: ブラウザを閉じます。

---

## まとめ

### Phase 9A（必須）で使用するMCP
- **Next.js Runtime MCP**: エラーチェック、ルート確認

### Phase 9B（任意）で使用するMCP
- **Chrome DevTools MCP**: 詳細なブラウザ検証、インタラクション、パフォーマンス測定
- **Browser Eval MCP**: 高度な自動化（必要に応じて）

### 推奨ワークフロー（Phase 9B）

1. **ページを開く**
   ```
   mcp__chrome-devtools__new_page
   mcp__chrome-devtools__navigate_page
   ```

2. **構造を確認**
   ```
   mcp__chrome-devtools__take_snapshot
   mcp__chrome-devtools__take_screenshot
   ```

3. **インタラクションテスト**
   ```
   mcp__chrome-devtools__click
   mcp__chrome-devtools__fill
   ```

4. **エラー確認**
   ```
   mcp__chrome-devtools__list_console_messages
   mcp__chrome-devtools__list_network_requests
   ```

5. **パフォーマンス測定**
   ```
   mcp__chrome-devtools__performance_start_trace
   mcp__chrome-devtools__performance_stop_trace
   ```

6. **レスポンシブ確認**
   ```
   mcp__chrome-devtools__resize_page
   mcp__chrome-devtools__take_screenshot
   ```

---

詳細な使用例やトラブルシューティングについては [CLAUDE.md](./CLAUDE.md) を参照してください。
