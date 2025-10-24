# MCP詳細コマンドリファレンス

このファイルは、Next.js MCP、Chrome DevTools MCP、Browser Eval MCPの詳細なコマンドとパラメータを記載したリファレンスです。

[CLAUDE.md](./CLAUDE.md) の Phase 9 で使用する詳細なコマンドを参照する際に使用してください。

---

## 目次

1. [Next.js Runtime MCP](#nextjs-runtime-mcp)
2. [Next.js Documentation MCP](#nextjs-documentation-mcp)
3. [Chrome DevTools MCP](#chrome-devtools-mcp)
4. [Browser Eval MCP](#browser-eval-mcp)

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
