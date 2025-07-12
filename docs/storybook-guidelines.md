# Storybook ガイドライン

## ストーリーを書く場合

**核心ルール**: **propsで制御される視覚的分岐**に対して新しいストーリーを作成する。視覚的な違いがない場合や、propsで分岐を制御できない場合は、コンポーネント分離を再検討する。

## ストーリー設定

### Metaオブジェクト設定
**基本原則**: meta設定は最小限に保つ。特定の要件が必要な場合のみ`parameters`、`argTypes`、`autoDocs`を追加する。

```typescript
// ✅ 推奨: シンプルなmeta設定
const meta = {
  component: Button,
  args: { onClick: fn() }, // fn()を使用してイベントハンドラーを追加
} satisfies Meta<typeof Button>;

// ❌ 避ける: 不要な設定
const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: { docs: { autodocs: true } }, // 通常は不要
  argTypes: { ... }, // 通常は不要
} satisfies Meta<typeof Button>;
```

### イベントハンドラー設定
イベントハンドラー（onClick、onSubmitなど）を持つコンポーネントの場合、`args`プロパティで`fn()`関数を使用：

```typescript
import { fn } from 'storybook/test';

const meta = {
  component: Button,
  args: { 
    onClick: fn(), // Storybookでアクションログを提供
  },
} satisfies Meta<typeof Button>;
```

## ✅ ストーリーを書く場合: Props制御の視覚的バリエーション

```typescript
// propsを通して視覚的バリエーションを持つコンポーネント
function Button({ variant, size, disabled, onClick }: ButtonProps) {
  return (
    <button 
      className={`btn btn-${variant} btn-${size} ${disabled ? 'disabled' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      Click me
    </button>
  );
}

// 各視覚的バリエーションのストーリー
const meta = {
  component: Button,
  args: { onClick: fn() }, // fn()でイベントハンドラー
} satisfies Meta<typeof Button>;

export default meta;

export const Primary = { args: { variant: 'primary', size: 'medium' } };
export const Secondary = { args: { variant: 'secondary', size: 'medium' } };
export const Large = { args: { variant: 'primary', size: 'large' } };
export const Disabled = { args: { variant: 'primary', disabled: true } };
```

## ✅ 単一ストーリーで十分な場合: 視覚的バリエーションなし

```typescript
// 視覚的分岐のないコンポーネント
function UserProfile({ name, email }: UserProfileProps) {
  return (
    <div className="profile">
      <h2>{name}</h2>
      <p>{email}</p>
    </div>
  );
}

// デフォルトストーリーのみ必要
export const Default = { 
  args: { name: 'John Doe', email: 'john@example.com' } 
};
```

## ❌ アンチパターン: 制御できない分岐

```typescript
// 悪い例: `isLoading`をpropsで制御できない
function UserCard({ user }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div>
      {isLoading ? <Spinner /> : <UserInfo user={user} />}
    </div>
  );
}

// ❌ ローディング状態のための意味のあるストーリーを作成できない
// これは不十分なコンポーネント分離を示している
```

**解決策**: ローディング状態を制御可能なコンポーネントに抽出：

```typescript
// ✅ 適切な分離
function UserCardContent({ user, isLoading }: { user: User; isLoading: boolean }) {
  return (
    <div>
      {isLoading ? <Spinner /> : <UserInfo user={user} />}
    </div>
  );
}

// ✅ 両方の状態のストーリーを作成できる
export const Loading = { args: { user: mockUser, isLoading: true } };
export const Loaded = { args: { user: mockUser, isLoading: false } };
```

## ストーリー組織

- **意味のある視覚的状態ごとに1つのストーリー**
- **視覚的違いを反映する説明的な名前を使用**
- **Storybookの階層命名を使用して関連するバリエーションをグループ化**
- **エッジケースを含める**（空の状態、長いテキストなど）

## 非視覚的ストーリーを避ける

**視覚的出力を生成しない状態のストーリーを作成しない：**

```typescript
// ❌ 避ける: 隠れた/見えないストーリー
export const Hidden = { args: { isVisible: false } }; // 何も表示しない
export const EmptyState = { args: { items: [] } }; // 空のdivを表示

// ✅ 改善: 非視覚的ロジックにはスナップショットテストを使用
describe('Component', () => {
  it('should render nothing when not visible', () => {
    const { container } = render(<Component isVisible={false} />);
    expect(container).toMatchSnapshot();
  });
});
```

**原則**: Storybookは視覚的確認のためのもので、ロジックテストのためではない。ストーリーが何も表示しない場合や視覚的価値を提供しない場合は、代わりにスナップショットテストを使用する。

## 警告サイン

これらの状況に遭遇した場合、コンポーネント分離の問題を示している：

1. **視覚的バリエーションのストーリーを作成できない** → 制御可能なコンポーネントを抽出
2. **ストーリーで内部フックのモックが必要** → ロジックを別の関数に移動
3. **複数のストーリーが同じに見える** → バリエーションが実際に視覚的かどうかを再検討
4. **内部状態をテストする必要がある** → ロジックをテスト可能な関数に抽出
5. **何も表示しないストーリー** → Storybookストーリーの代わりにスナップショットテストを使用

## 非視覚的ストーリーを避ける理由

**核心原則**: Storybookは視覚的確認のためのもので、ロジックテストのためではない。

### 回避すべき例
- ❌ 視覚的出力を生成しない状態（`isVisible: false`、空の状態）
- ❌ 内部フックや状態に依存するストーリー（制御不可能）
- ❌ 同じ視覚的結果を生成する複数のストーリー（冗長）

### 代替手段
- **スナップショットテスト**: 非視覚的ロジックテスト用
- **単体テスト**: ビジネスロジックとユーティリティ関数用
- **コンポーネントテスト**: Props制御のレンダリング用

## Biome設定
- **インデント**: タブ
- **クォート**: JavaScriptはダブルクォート
- **インポート整理**: 自動インポートソート有効
- **カスタムルール**:
  - `noUnusedImports`: エラー
  - `noUnusedVariables`: エラー
  - `useSortedClasses`: エラー（Tailwindクラスのソート）
- **ファイルスコープ**: `src/**/*.{js,ts,jsx,tsx,json,jsonc}`ファイルのみ処理

## TypeScript
- strict モードを使用
- `tsc --noEmit`で型チェック
- Next.js App Router のTypeScript設定

## shadcn/ui 設定

### セットアップ
- **スタイル**: New York variant
- **ベースカラー**: Neutral
- **CSS変数**: 有効
- **RSC**: React Server Components 有効
- **アイコンライブラリ**: Lucide React

### パスエイリアス
- `@/components` → `src/components`
- `@/lib` → `src/lib`
- `@/utils` → `src/lib/utils`
- `@/ui` → `src/components/ui`
- `@/hooks` → `src/hooks`