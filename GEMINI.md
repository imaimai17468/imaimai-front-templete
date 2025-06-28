# コンポーネント命名規則

## 基本ルール

### 1. ディレクトリとファイルの命名

- **ディレクトリ名**: ケバブケース（kebab-case）
- **TSXファイル名**: パスカルケース（PascalCase）
- **コンポーネント名**: パスカルケース（PascalCase）

### 2. 一致ルール

- **ディレクトリ名とTSXファイル名は合わせる**
  - ケバブケース → パスカルケースの変換で一致させる
- **TSXファイル名とコンポーネント名は完全一致**

### 3. 分離ルール

- **ディレクトリ名とTSXファイル名が合わない場合は新しくディレクトリを切る**

## 例

### ✅ 正しい例

```
src/components/features/videos/
├── Videos.tsx              // export function Videos()
└── empty-state/
    └── EmptyState.tsx      // export function EmptyState()
```

- `videos` ディレクトリ → `Videos.tsx` ファイル → `Videos` コンポーネント
- `empty-state` ディレクトリ → `EmptyState.tsx` ファイル → `EmptyState` コンポーネント

### ❌ 間違った例

```
src/components/features/videos/
├── VideoGrid.tsx           // ディレクトリ名と不一致
└── empty-state/
    └── VideoEmpty.tsx      // ディレクトリ名と不一致
```

### 🔄 修正方法

間違った例を修正する場合：

```
src/components/features/
├── videos/
│   └── Videos.tsx          // export function Videos()
├── video-grid/
│   └── VideoGrid.tsx       // export function VideoGrid()
└── video-empty/
    └── VideoEmpty.tsx      // export function VideoEmpty()
```

## 命名変換ルール

| ディレクトリ名 (kebab-case) | ファイル名 (PascalCase) | コンポーネント名 |
|---------------------------|----------------------|-----------------|
| `video-grid`              | `VideoGrid.tsx`      | `VideoGrid`     |
| `empty-state`             | `EmptyState.tsx`     | `EmptyState`    |
| `user-profile`            | `UserProfile.tsx`    | `UserProfile`   |
| `api-client`              | `ApiClient.tsx`      | `ApiClient`     |

## 追加ガイドライン

### バレルファイル（index.ts）

- **使用しない** - ダイレクトインポートを使用
- 各コンポーネントは直接インポートする

### インポート例

```typescript
// ✅ 正しい
import { EmptyState } from "./empty-state/EmptyState";
import { Videos } from "./videos/Videos";

// ❌ 間違い（バレルファイル使用）
import { EmptyState } from "./empty-state";
```

### ディレクトリ構造の例

```
src/components/
├── ui/                     // 基本UIコンポーネント
│   ├── button/
│   │   └── Button.tsx
│   └── input/
│       └── Input.tsx
└── features/              // 機能別コンポーネント
    ├── videos/
    │   ├── Videos.tsx
    │   └── empty-state/
    │       └── EmptyState.tsx
    └── user-profile/
        ├── UserProfile.tsx
        └── profile-avatar/
            └── ProfileAvatar.tsx
```

## チェックリスト

コンポーネント作成時は以下を確認：

- [ ] ディレクトリ名がケバブケースになっている
- [ ] TSXファイル名がパスカルケースになっている
- [ ] コンポーネント名がファイル名と一致している
- [ ] ディレクトリ名とファイル名が対応している（kebab-case → PascalCase）
- [ ] バレルファイルを使用していない
- [ ] ダイレクトインポートを使用し��いる

---

### AIエージェントへの指示

-   **ファイル操作の事前確認:**
    -   コンポーネントの作成、移動、リファクタリングなど、ファイルシステムに変更を加える操作を行う前には、必ず以下の内容を含む**計画**を提示し、ユーザーの承認を得ること。
        1.  **準拠するルール:** どのルールに基づいて操作を行うのか。
        2.  **対象パス:** 作成、変更、移動するファイルの具体的なパス。