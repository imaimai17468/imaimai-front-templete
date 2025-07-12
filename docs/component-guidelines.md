# コンポーネント分離・作成ガイド

## コンポーネント命名規則

### 厳格なルール
1. **ディレクトリ名**: kebab-case
2. **TSXファイル名**: PascalCase
3. **TSファイル名**: camelCase（ユーティリティ関数、ヘルパー、型など）
4. **コンポーネント名**: PascalCase（ファイル名と完全一致）
5. **ディレクトリとファイル名の対応**: kebab-case → PascalCase変換
6. **バレルファイル禁止**: index.tsを使用せず、直接インポートのみ
7. **インポートパス**: `@/`エイリアスを使用し、相対パスは使用しない

### 対応規則
- **ディレクトリ名とTSXファイル名は一致必須**（kebab-case → PascalCase変換）
- **TSXファイル名とコンポーネント名は完全一致**
- **ディレクトリ名とTSXファイル名が一致しない場合は新しいディレクトリを作成**

### 例

#### ✅ 正しい構造
```
src/components/features/videos/
├── Videos.tsx              // export function Videos()
├── videoHelpers.ts         // camelCase for TS utility files
└── empty-state/
    └── EmptyState.tsx      // export function EmptyState()
```

#### ❌ 間違った構造
```
src/components/features/videos/
├── VideoGrid.tsx           // ディレクトリ名と一致しない
├── video-helpers.ts        // camelCaseにすべき
└── empty-state/
    └── VideoEmpty.tsx      // ディレクトリ名と一致しない
```

### 命名変換テーブル

| ディレクトリ (kebab-case) | TSXファイル (PascalCase) | TSファイル (camelCase) | コンポーネント名 |
|------------------------|----------------------|---------------------|----------------|
| `video-grid`           | `VideoGrid.tsx`      | `videoHelpers.ts`   | `VideoGrid`    |
| `empty-state`          | `EmptyState.tsx`     | `stateUtils.ts`     | `EmptyState`   |
| `user-profile`         | `UserProfile.tsx`    | `userHelpers.ts`    | `UserProfile`  |
| `api-client`           | `ApiClient.tsx`      | `apiUtils.ts`       | `ApiClient`    |

### インポートスタイル
```typescript
// ✅ 正しい - 直接インポートのみ
import { LoginForm } from "@/components/features/auth/login-form/LoginForm";
import { RegisterForm } from "@/components/features/auth/register-form/RegisterForm";

// ❌ 間違い - バレルファイルの使用
import { LoginForm, RegisterForm } from "@/components/features/auth";
```

### ディレクトリ構造ガイドライン
```
src/components/
├── ui/                     # shadcn/ui components only
│   ├── button.tsx         # From shadcn/ui (flat naming)
│   └── input.tsx          # From shadcn/ui (flat naming)
├── shared/                # Reusable components across features
│   ├── header/
│   │   └── Header.tsx
│   └── loading-spinner/
│       └── LoadingSpinner.tsx
└── features/              # Screen/page-specific components
    ├── auth/
    │   └── login-form/
    │       └── LoginForm.tsx
    └── dashboard/
        └── user-stats/
            └── UserStats.tsx
```

## コンポーネント分離ガイドライン

### 核心原則: 動作の観察可能性
**コンポーネント分離の基本的なルールは「すべての動作が観察できるかどうか」です。** 長さだけでは分離の基準ではありません。重要な質問は：**テストを書けるか？適切なテストを書くために分離が必要か？**

### 分離しない場合

#### ✅ propsベースの条件レンダリング
propsで直接制御できる条件レンダリングがある場合：

```typescript
// ✅ 分離不要 - 異なるpropsでStorybookストーリーを通じてテスト可能
function MyComponent({ variant }: { variant: 'primary' | 'secondary' }) {
  return (
    <div>
      {variant === 'primary' && <PrimaryContent />}
      {variant === 'secondary' && <SecondaryContent />}
    </div>
  );
}

// ✅ Storybookストーリーでテスト
export const Primary = { args: { variant: 'primary' } };
export const Secondary = { args: { variant: 'secondary' } };
```

### 分離する場合

#### 🔄 条件レンダリング用の計算・処理された値
propsを処理して、その計算結果を条件レンダリングに使用する場合：

```typescript
// ❌ テストが困難 - 計算ロジックとレンダリングが混在
function BadComponent({ user, settings }: Props) {
  const isVipUser = user.level > 5 && settings.vipEnabled && user.subscriptionActive;
  
  return (
    <div>
      {isVipUser && <VipBadge />}
      {!isVipUser && <RegularBadge />}
    </div>
  );
}

// ✅ 改善 - 計算とレンダリングを分離
function computeUserStatus(user: User, settings: Settings): 'vip' | 'regular' {
  return user.level > 5 && settings.vipEnabled && user.subscriptionActive ? 'vip' : 'regular';
}

function UserBadge({ status }: { status: 'vip' | 'regular' }) {
  return (
    <div>
      {status === 'vip' && <VipBadge />}
      {status === 'regular' && <RegularBadge />}
    </div>
  );
}

function MyComponent({ user, settings }: Props) {
  const status = computeUserStatus(user, settings);
  return <UserBadge status={status} />;
}
```

## 高度なパターン: 内部可視性制御

**核心原則**: 外部条件レンダリング（`{condition && <Component />}`）ではなく、条件をコンポーネント内部に`isVisible`プロップとして移動する。これにより、テストでのフックモックが不要になります。

### ❌ 外部条件レンダリング（テストが困難）
```typescript
// 親コンポーネント
{isStreaming && (
  <StreamingMessage text={streamingText} timestamp={getCurrentTime()} />
)}
{loading && !isStreaming && <LoadingMessage />}

// テストにはuseTourismAgentフックのモックが必要
jest.mock('@/hooks/useTourismAgent');
mockUseTourismAgent.mockReturnValue({ isStreaming: true, loading: false, ... });
```

### ✅ 内部可視性制御（テストが簡単）
```typescript
// 親コンポーネント - 常にレンダリング、コンポーネントが可視性を決定
<StreamingMessage 
  text={streamingText} 
  timestamp={getCurrentTime()} 
  isVisible={isStreaming} 
/>
<LoadingMessage isVisible={loading && !isStreaming} />

// テストはpropsで簡単
render(<StreamingMessage text="test" timestamp="12:34" isVisible={true} />);
render(<StreamingMessage text="test" timestamp="12:34" isVisible={false} />);
```

### コンポーネント実装パターン
```typescript
interface ComponentProps {
  // ... other props
  isVisible: boolean;
}

export function Component({ isVisible, ...otherProps }: ComponentProps) {
  // 可視性制御のための早期リターンパターン
  if (!isVisible) return null;
  
  return (
    <div>
      {/* Component content */}
    </div>
  );
}
```

## 高度なパターン: 完全ロジック抽出

**核心原則**: 外部状態（フック、props）に依存する複雑な条件ロジックに遭遇した時、条件だけでなく分岐ロジック全体を別の関数として抽出する。

### ❌ 不十分なアプローチ: 条件のみの抽出
```typescript
// 悪い例: 条件の検証のみ抽出
export function shouldSendMessage(message: string): boolean {
  return message.trim().length > 0;
}

// 実際の実行ロジックはまだテストが困難
const handleSendMessage = async () => {
  if (!shouldSendMessage(newMessage)) return; // ← これはテスト可能
  
  // しかし、この複雑なロジックはまだテストが困難
  const userMessage = newMessage;
  setNewMessage("");
  try {
    if (useStreaming) {
      await sendStreamingMessage(userMessage);
    } else {
      await sendMessage(userMessage);
    }
  } catch (error) {
    console.error("Error:", error);
  }
};
```

### ✅ 改善されたアプローチ: 完全ロジック抽出
```typescript
// 分岐ロジック全体をテスト可能な関数として抽出
export async function sendUserMessage(
  message: string,
  useStreaming: boolean,
  sendStreamingMessage: (msg: string) => Promise<void>,
  sendMessage: (msg: string) => Promise<unknown>,
): Promise<{ success: boolean; error?: string }> {
  if (!message.trim()) {
    return { success: false, error: "Message is empty" };
  }

  try {
    if (useStreaming) {
      await sendStreamingMessage(message);
    } else {
      await sendMessage(message);
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// コンポーネントはシンプルで焦点が明確
const handleSendMessage = async () => {
  const userMessage = newMessage;
  setNewMessage("");

  const result = await sendUserMessage(
    userMessage,
    useStreaming,
    sendStreamingMessage,
    sendMessage,
  );

  if (!result.success && result.error) {
    console.error("Error:", result.error);
  }
};
```

## Package by Feature アーキテクチャ

**核心原則**: 技術タイプではなく機能によって関連するコードをグループ化する。機能固有のロジックは、それを使用するコンポーネントの近くに配置する。

### ディレクトリ組織ルール
1. **グローバルユーティリティ**: 真にジェネリックな関数は`src/lib/`または`src/hooks/`に配置
2. **機能固有ロジック**: 機能固有のフック、ユーティリティ、型は機能ディレクトリ内に配置
3. **コロケーション**: 関連するコードは可能な限り使用場所の近くに配置

### ✅ 正しい機能組織
```
src/components/features/chat-page/
├── ChatPage.tsx                 # メインコンポーネント
├── messageHandlers.ts           # 機能固有ロジック
├── useChatState.ts             # 機能固有フック
├── types.ts                    # 機能固有型
├── chat-header/
│   └── ChatHeader.tsx
├── chat-message/
│   ├── ChatMessage.tsx
│   └── messageUtils.ts         # メッセージ固有ユーティリティ
└── chat-input-area/
    ├── ChatInputArea.tsx
    └── inputValidation.ts      # 入力固有ロジック
```

## 決定フレームワーク

コンポーネント分離を検討する際の質問：

1. **このビヘイビアをpropsで制御できるか？**
   - ✅ はい → 同じコンポーネントに保持、Storybookストーリーでテスト
   - ❌ いいえ → 内部可視性制御による分離を検討

2. **外部条件レンダリング（`{condition && <Component />}`）はあるか？**
   - ✅ はい → 条件をコンポーネント内部に`isVisible`プロップとして移動
   - ❌ いいえ → 現在の構造を維持

3. **外部状態依存の複雑な条件ロジックはあるか？**
   - ✅ はい → ロジックブロック全体を別の関数として抽出
   - ❌ いいえ → 一緒に保持

4. **条件レンダリング前に計算・処理はあるか？**
   - ✅ はい → 計算ロジックを分離し、処理された値を受け取るコンポーネントを作成
   - ❌ いいえ → 一緒に保持

5. **この部分を単独で意味のあるテストを書けるか？**
   - ✅ はい → 分離の良い候補
   - ❌ いいえ → 一緒に保持

6. **この部分は明確で単一の責任を持つか？**
   - ✅ はい → 保守性向上のため分離を検討
   - ❌ いいえ → 最初にロジックをリファクタリング

### 適切な分離の利点

- **テスト可能性**: 各部分を単独でテスト可能
- **再利用性**: 分離されたコンポーネントは他の場所で再利用可能
- **保守性**: 明確な責任と境界
- **Storybook**: より良いコンポーネントドキュメンテーションと視覚的テスト

## コンポーネント作成チェックリスト
- [ ] 正しい場所を決定: `ui/` (shadcn/ui), `shared/` (再利用可能), または `features/` (画面固有)
- [ ] ディレクトリ名がkebab-case（`ui/`は平坦な命名を使用）
- [ ] TSXファイル名がPascalCase（`ui/`は平坦な命名を使用）
- [ ] TSファイル名がcamelCase（ユーティリティ、ヘルパー、型用）
- [ ] コンポーネント名がファイル名と完全一致
- [ ] ディレクトリ名がファイル名に変換される（kebab-case → PascalCase）
- [ ] 機能固有ロジックは機能ディレクトリ内に配置（Package by Feature）
- [ ] グローバルユーティリティは真にジェネリックな関数のみ
- [ ] バレルファイル（index.ts）は使用しない
- [ ] 相対パスではなく`@/`エイリアスで絶対インポートパスを使用
- [ ] 全てのコンポーネントで直接インポートを使用
- [ ] **ARIA属性と競合するprop名を避ける**（例：`role`の代わりに`avatarType`を使用）

## AIエージェント向け重要な注意事項
- **常にユーザーの承認を得る** コンポーネントの作成、移動、リファクタリング前に
- **明確な計画を提示する** どの命名規則が適用されるか、正確なファイルパスを示す
- **命名の一貫性を確認する** ファイル操作前にディレクトリ、ファイル、コンポーネント名の間の一貫性を確認