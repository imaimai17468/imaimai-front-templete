# テストガイドライン

## Vitest のインポート要件

**重要**: Vitest のテスト関数は明示的にインポートする必要があります。グローバル変数として利用できません。

### 必須インポート

```typescript
import { describe, expect, test, vi } from "vitest";
```

### よく使用されるインポート

- `describe` - テストスイートをグループ化
- `expect` - アサーション
- `test` または `it` - 個別のテストケース
- `vi` - モック機能
- `beforeEach`, `afterEach` - セットアップ/クリーンアップ
- `beforeAll`, `afterAll` - スイート全体のセットアップ/クリーンアップ

### 例

```typescript
// ❌ 間違い - インポートなしで使用
describe("MyComponent", () => {
  test("should work", () => {
    expect(true).toBe(true);
  });
});

// ✅ 正しい - 必要な関数をインポート
import { describe, expect, test } from "vitest";

describe("MyComponent", () => {
  test("should work", () => {
    expect(true).toBe(true);
  });
});
```

## テストタイトルの日本語化

**重要**: すべてのテストタイトル（describe、test、it）は日本語で記述してください。

### 理由

- コードレビューの効率化
- テスト内容の理解しやすさ向上
- プロジェクト全体での一貫性

### テストタイトルの書き方

**重要**: テストタイトルには具体的な props 名、変数名、値を明記してください。曖昧な表現を避け、何をテストしているかを明確にします。

#### 基本フォーマット

- `{props/変数名}が{具体的な値}の場合、〜すること`
- `{props/変数名}が{具体的な値}の時、〜されること/されないこと`

### 例

```typescript
// ❌ 間違い - 曖昧な表現
describe("WelcomeScreen", () => {
  test("表示状態の時にスナップショットと一致すること", () => {
    // どのpropsが何の値なのか不明確
  });

  test("ボタンクリック時にonNavigateToPlayerが呼ばれること", () => {
    // どのボタンか、どんな条件下かが不明確
  });
});

// ✅ 正しい - 具体的なprops名と値を明記
describe("WelcomeScreen", () => {
  test("isVisibleがtrueの時にスナップショットと一致すること", () => {
    // ...
  });

  test("isVisibleがfalseの時にスナップショットと一致すること", () => {
    // ...
  });
});

// ✅ より複雑な例
describe("UserCard", () => {
  test("roleが'admin'の場合、編集ボタンが表示されること", () => {
    // ...
  });

  test("roleが'editor'かつeditingEnabledがtrueの場合、編集可能であること", () => {
    // ...
  });

  test("statusが'error'かつshowIconがfalseの場合、アイコンなしでエラーバッジが表示されること", () => {
    // ...
  });
});
```

### 命名パターン例

- `〜すること` - 期待される動作を記述
- `〜の場合、〜すること` - 条件付きの動作を記述
- `〜エラーが発生すること` - エラーケースを記述
- `〜が表示されること/されないこと` - 表示状態を記述

## テストを書く場合

**核心ルール**: **すべての条件ロジック**にテストを書く - すべての`if`文、三項演算子、分岐ロジックはテストが必要。

## ロジックテスト（単体テスト）

props で制御できないロジック用：

```typescript
// ❌ テストが困難 - ロジックがコンポーネントに混在
function UserCard({ user, settings }: Props) {
  const canEdit =
    user.role === "admin" ||
    (user.role === "editor" && settings.editingEnabled);

  return (
    <div>
      {canEdit && <EditButton />}
      {/* other UI */}
    </div>
  );
}

// ✅ 単体テスト用にロジックを抽出
export function canUserEdit(user: User, settings: Settings): boolean {
  return (
    user.role === "admin" || (user.role === "editor" && settings.editingEnabled)
  );
}

function UserCard({ user, settings }: Props) {
  const canEdit = canUserEdit(user, settings);
  return (
    <div>
      {canEdit && <EditButton />}
      {/* other UI */}
    </div>
  );
}

// ロジック関数をテスト
describe("canUserEdit", () => {
  test("roleが'admin'の場合、editingEnabledがfalseでも編集可能であること", () => {
    expect(canUserEdit({ role: "admin" }, { editingEnabled: false })).toBe(
      true
    );
  });

  test("roleが'editor'かつeditingEnabledがtrueの場合、編集可能であること", () => {
    expect(canUserEdit({ role: "editor" }, { editingEnabled: true })).toBe(
      true
    );
  });

  test("roleが'editor'かつeditingEnabledがfalseの場合、編集不可であること", () => {
    expect(canUserEdit({ role: "editor" }, { editingEnabled: false })).toBe(
      false
    );
  });
});
```

## コンポーネントテスト

props で制御される条件レンダリング用：

```typescript
function StatusBadge({
  status,
  showIcon,
}: {
  status: "success" | "error";
  showIcon: boolean;
}) {
  return (
    <div className={`badge badge-${status}`}>
      {showIcon && <Icon name={status === "success" ? "check" : "x"} />}
      <span>{status}</span>
    </div>
  );
}

// propsを通してすべての条件分岐をテスト
describe("StatusBadge", () => {
  test("statusが'success'かつshowIconがtrueの場合、成功バッジがアイコン付きで表示されること", () => {
    render(<StatusBadge status="success" showIcon={true} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
  });

  test("statusが'error'かつshowIconがfalseの場合、エラーバッジがアイコンなしで表示されること", () => {
    render(<StatusBadge status="error" showIcon={false} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
  });
});
```

## スナップショットテスト

将来の変更を監視する必要がある場合の**アクセシビリティとセマンティックテスト**用：

```typescript
// HTMLの構造とアクセシビリティが重要なコンポーネント
describe("NavigationMenu", () => {
  test("アクセシビリティ構造が維持されること", () => {
    const { container } = render(<NavigationMenu items={mockItems} />);
    expect(container).toMatchSnapshot();
  });

  test("スクリーンリーダー用のARIA属性が保持されること", () => {
    const { container } = render(
      <NavigationMenu items={mockItems} expanded={true} />
    );
    expect(container).toMatchSnapshot();
  });
});
```

## スナップショットテストを書かない場合

- ❌ スタイリング/視覚的変更用（代わりに視覚的リグレッションツールを使用）
- ❌ 頻繁に変更される動的コンテンツ用
- ❌ 適切な単体/コンポーネントテストの代替として

## テスト構造ルール

### テストの簡潔性と焦点

**核心ルール**: テストはシンプルで、必須の条件ロジックのみに焦点を当てる。過度なテストや不必要な複雑さは避ける。

### Arrange-Act-Assert パターン

すべてのテストは**Arrange-Act-Assert**パターンに従い、特定の変数命名を使用する：

#### 変数名の命名規則

テストの可読性を高めるため、以下の命名規則を推奨します。

- **`actual`**: テスト対象の関数やメソッドを実行した結果を格納する変数。
- **`expected`**: `actual`と比較するための期待値を格納する変数。

```typescript
// ✅ 推奨される命名規則
test("roleが'admin'の場合、trueを返すこと", () => {
  // Arrange
  const adminUser = { role: "admin" };
  const settings = { editingEnabled: true };
  const expected = true;

  // Act
  const actual = canUserEdit(adminUser, settings);

  // Assert
  expect(actual).toBe(expected);
});
```

```typescript
// ✅ 正しいテスト構造
describe("canUserEdit", () => {
  // Arrange: describe レベルの共通テストデータ
  const adminUser = { role: "admin", id: 1 };
  const editorUser = { role: "editor", id: 2 };
  const defaultSettings = { editingEnabled: true };

  test("管理者は設定に関わらず編集可能であること", () => {
    // Arrange (テスト固有データ)
    const disabledSettings = { editingEnabled: false };

    // Act
    const actual = canUserEdit(adminUser, disabledSettings);

    // Assert
    const expected = true;
    expect(actual).toBe(expected);
  });

  test("編集が有効な場合、編集者は編集可能であること", () => {
    // Act
    const actual = canUserEdit(editorUser, defaultSettings);

    // Assert
    const expected = true;
    expect(actual).toBe(expected);
  });

  test("編集が無効な場合、編集者は編集不可であること", () => {
    // Arrange
    const disabledSettings = { editingEnabled: false };

    // Act
    const actual = canUserEdit(editorUser, disabledSettings);

    // Assert
    const expected = false;
    expect(actual).toBe(expected);
  });
});
```

### テスト組織ルール

1. **単一レベルの describe のみ** - ネストした describe ブロックはなし
2. **個別のテストケースには`test()`を使用** - `it()`ではなく
3. **テストごとに 1 つの expect** - 各テストは正確に 1 つのことを検証
4. **describe レベルの共通データ** - テスト間でセットアップデータを共有
5. **名前付き変数**: テスト結果には`actual`、期待値には`expected`を使用
6. **重要な分岐のみテスト** - 核心的条件ロジックに焦点、エッジケースの過度なテストは避ける
7. **不必要なコメントを削除** - シンプルなテストの Act/Assert コメントは含めない

### アンチパターン

```typescript
// ❌ 間違い: ネストしたdescribe
describe("UserPermissions", () => {
  describe("canUserEdit", () => {
    // ネストしない！
    // tests...
  });
});

// ❌ 間違い: 1つのテストで複数のexpect
test("ユーザー権限を処理すること", () => {
  expect(canUserEdit(admin, settings)).toBe(true); // 複数のexpect
  expect(canUserEdit(editor, settings)).toBe(false); // 1つのテストで
});

// ❌ 間違い: test()の代わりにit()を使用
it("管理者を許可すること", () => {
  // test()を使用、it()ではない
  // ...
});

// ❌ 間違い: 意味のある変数名なしのインライン値
test("管理者を許可すること", () => {
  expect(canUserEdit({ role: "admin" }, { editing: true })).toBe(true);
  // 何をテストしているかがわからない
});

// ❌ 間違い: 類似したテストケースの過度なテスト
test("questionが''（空文字）の場合、onStartChatが呼ばれないこと", () => {
  // 空文字列のテスト
});
test("questionが'   '（空白文字のみ）の場合、onStartChatが呼ばれないこと", () => {
  // 空白文字列のテスト - ロジックがtrim()のみをチェックする場合は冗長
});
test("questionがnullの場合、onStartChatが呼ばれないこと", () => {
  // 入力検証が他の場所で処理される場合は多くの場合不要
});

// ❌ 間違い: 複数の副作用をテスト
test("関数が呼ばれて、他の関数が呼ばれないこと", () => {
  expect(mockFunctionA).toHaveBeenCalled();
  expect(mockFunctionB).not.toHaveBeenCalled(); // 別のテストにすべき
});
```

## テスト簡素化の例

**重要な分岐のみに焦点：**

```typescript
// ✅ 正しい: 核心的分岐ロジックのみテスト
describe("createKeyDownHandler", () => {
  test("keyが'Enter'の時、onStartChatが呼ばれること", () => {
    const handleKeyDown = createKeyDownHandler(mockOnStartChat);
    const enterKeyEvent = { key: "Enter" } as React.KeyboardEvent;

    handleKeyDown(enterKeyEvent);

    expect(mockOnStartChat).toHaveBeenCalledTimes(1);
  });

  test("keyが' '（スペース）の時、onStartChatが呼ばれないこと", () => {
    const handleKeyDown = createKeyDownHandler(mockOnStartChat);
    const spaceKeyEvent = { key: " " } as React.KeyboardEvent;

    handleKeyDown(spaceKeyEvent);

    expect(mockOnStartChat).not.toHaveBeenCalled();
  });
});

// ✅ 正しい: 重要な条件のみテスト
describe("createHandleStartChat", () => {
  test("questionが'浅草周辺を午後から回りたい'（有効な内容）の場合、onStartChatが呼ばれること", () => {
    const question = "浅草周辺を午後から回りたい";
    const handleStartChat = createHandleStartChat(question, mockOnStartChat);

    handleStartChat();

    expect(mockOnStartChat).toHaveBeenCalledWith(question);
  });

  test("questionが''（空文字）の場合、onStartChatが呼ばれないこと", () => {
    const emptyQuestion = "";
    const handleStartChat = createHandleStartChat(
      emptyQuestion,
      mockOnStartChat
    );

    handleStartChat();

    expect(mockOnStartChat).not.toHaveBeenCalled();
  });
});
```

## 複数のアサーションの処理

複数の関連プロパティを検証する必要がある場合は、オブジェクト比較を使用：

```typescript
// ✅ 正しい: オブジェクト比較で単一のexpect
test("完全なユーザーステータスを返すこと", () => {
  const user = { role: "editor", level: 3 };
  const settings = { editingEnabled: true, maxLevel: 5 };

  const actual = getUserStatus(user, settings);

  const expected = {
    canEdit: true,
    canDelete: false,
    accessLevel: "standard",
  };
  expect(actual).toEqual(expected);
});
```

## コンポーネントテスト構造

```typescript
describe("StatusBadge", () => {
  // Arrange: 共通props
  const defaultProps = {
    status: "success" as const,
    showIcon: true,
  };

  test("showIconがtrueの場合、成功アイコンが表示されること", () => {
    // Act
    render(<StatusBadge {...defaultProps} />);
    const actual = screen.queryByRole("img");

    // Assert
    const expected = expect.anything(); // アイコンが存在すべき
    expect(actual).toEqual(expected);
  });

  test("showIconがfalseの場合、アイコンが非表示になること", () => {
    // Arrange
    const props = { ...defaultProps, showIcon: false };

    // Act
    render(<StatusBadge {...props} />);
    const actual = screen.queryByRole("img");

    // Assert
    const expected = null;
    expect(actual).toBe(expected);
  });

  test("エラーステータスの場合、エラースタイリングが表示されること", () => {
    // Arrange
    const props = { ...defaultProps, status: "error" as const };

    // Act
    render(<StatusBadge {...props} />);
    const actual = screen.getByText("error").className;

    // Assert
    const expected = expect.stringContaining("badge-error");
    expect(actual).toEqual(expected);
  });
});
```
