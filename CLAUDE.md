# いまいまいのフロントエンドテンプレート

## プロジェクト概要

### 技術スタック
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (厳格モード, tsgo)
- **Styling**: Tailwind CSS, shadcn/ui
- **Testing**: Vitest, React Testing Library
- **Backend**: Cloudflare (D1, R2) + Better Auth + Drizzle ORM
- **Build**: Bun
- **Lint**: oxlint
- **Format**: oxfmt

## 基盤ルール

### コロケーション

関連するコードは近くに置く。距離が離れるほど認知コストが上がる。

- **ディレクトリを切るのはコンポーネントを切る時のみ**（コンポーネント1つ = 1ディレクトリ）
- 関数・テスト・型定義は使用するコンポーネントと同階層に配置
- `src/utils/`、`src/helpers/`、`src/__tests__/` などの集約ディレクトリは作成しない

```
features/
  user-profile/
    UserProfile.tsx           # コンポーネント
    formatUserName.ts         # 関数（同階層）
    formatUserName.test.ts    # テスト（同階層）
    user-avatar/              # 子コンポーネント
      UserAvatar.tsx
```

### ホワイトボックステスト

条件分岐・副作用のロジックをコンポーネントから純粋関数として抽出し、テスト可能にする。

- **すべての表示状態をprops経由で制御可能にする**（内部stateで分岐しない）
- **useEffect/イベントハンドラ内の条件分岐は純粋関数に抽出する**（クロージャ変数への依存を排除）
- 抽出した関数は同階層にファイル化し、単体テストを書く
