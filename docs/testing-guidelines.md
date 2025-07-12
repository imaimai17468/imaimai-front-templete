# テストガイドライン

## テストを書く場合

**核心ルール**: **すべての条件ロジック**にテストを書く - すべての`if`文、三項演算子、分岐ロジックはテストが必要。

## ロジックテスト（単体テスト）
propsで制御できないロジック用：

```typescript
// ❌ テストが困難 - ロジックがコンポーネントに混在
function UserCard({ user, settings }: Props) {
  const canEdit = user.role === 'admin' || (user.role === 'editor' && settings.editingEnabled);
  
  return (
    <div>
      {canEdit && <EditButton />}
      {/* other UI */}
    </div>
  );
}

// ✅ 単体テスト用にロジックを抽出
export function canUserEdit(user: User, settings: Settings): boolean {
  return user.role === 'admin' || (user.role === 'editor' && settings.editingEnabled);
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
describe('canUserEdit', () => {
  it('should allow admin to edit', () => {
    expect(canUserEdit({ role: 'admin' }, { editingEnabled: false })).toBe(true);
  });
  
  it('should allow editor when editing is enabled', () => {
    expect(canUserEdit({ role: 'editor' }, { editingEnabled: true })).toBe(true);
  });
  
  it('should not allow editor when editing is disabled', () => {
    expect(canUserEdit({ role: 'editor' }, { editingEnabled: false })).toBe(false);
  });
});
```

## コンポーネントテスト
propsで制御される条件レンダリング用：

```typescript
function StatusBadge({ status, showIcon }: { status: 'success' | 'error'; showIcon: boolean }) {
  return (
    <div className={`badge badge-${status}`}>
      {showIcon && <Icon name={status === 'success' ? 'check' : 'x'} />}
      <span>{status}</span>
    </div>
  );
}

// propsを通してすべての条件分岐をテスト
describe('StatusBadge', () => {
  it('should render success badge with icon', () => {
    render(<StatusBadge status="success" showIcon={true} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
  });
  
  it('should render error badge without icon', () => {
    render(<StatusBadge status="error" showIcon={false} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });
});
```

## スナップショットテスト
将来の変更を監視する必要がある場合の**アクセシビリティとセマンティックテスト**用：

```typescript
// HTMLの構造とアクセシビリティが重要なコンポーネント
describe('NavigationMenu', () => {
  it('should maintain accessibility structure', () => {
    const { container } = render(<NavigationMenu items={mockItems} />);
    expect(container).toMatchSnapshot();
  });
  
  it('should preserve ARIA attributes for screen readers', () => {
    const { container } = render(<NavigationMenu items={mockItems} expanded={true} />);
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

```typescript
// ✅ 正しいテスト構造
describe('canUserEdit', () => {
  // Arrange: describe レベルの共通テストデータ
  const adminUser = { role: 'admin', id: 1 };
  const editorUser = { role: 'editor', id: 2 };
  const defaultSettings = { editingEnabled: true };

  test('should allow admin to edit regardless of settings', () => {
    // Arrange (テスト固有データ)
    const disabledSettings = { editingEnabled: false };
    
    // Act
    const actual = canUserEdit(adminUser, disabledSettings);
    
    // Assert
    const expected = true;
    expect(actual).toBe(expected);
  });

  test('should allow editor when editing is enabled', () => {
    // Act
    const actual = canUserEdit(editorUser, defaultSettings);
    
    // Assert
    const expected = true;
    expect(actual).toBe(expected);
  });

  test('should deny editor when editing is disabled', () => {
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

1. **単一レベルのdescribeのみ** - ネストしたdescribeブロックはなし
2. **個別のテストケースには`test()`を使用** - `it()`ではなく
3. **テストごとに1つのexpect** - 各テストは正確に1つのことを検証
4. **describe レベルの共通データ** - テスト間でセットアップデータを共有
5. **名前付き変数**: テスト結果には`actual`、期待値には`expected`を使用
6. **重要な分岐のみテスト** - 核心的条件ロジックに焦点、エッジケースの過度なテストは避ける
7. **不必要なコメントを削除** - シンプルなテストのAct/Assertコメントは含めない

### アンチパターン

```typescript
// ❌ 間違い: ネストしたdescribe
describe('UserPermissions', () => {
  describe('canUserEdit', () => { // ネストしない！
    // tests...
  });
});

// ❌ 間違い: 1つのテストで複数のexpect
test('should handle user permissions', () => {
  expect(canUserEdit(admin, settings)).toBe(true); // 複数のexpect
  expect(canUserEdit(editor, settings)).toBe(false); // 1つのテストで
});

// ❌ 間違い: test()の代わりにit()を使用
it('should allow admin', () => { // test()を使用、it()ではない
  // ...
});

// ❌ 間違い: 意味のある変数名なしのインライン値
test('should allow admin', () => {
  expect(canUserEdit({ role: 'admin' }, { editing: true })).toBe(true);
  // 何をテストしているかがわからない
});

// ❌ 間違い: 類似したテストケースの過度なテスト
test('should not call onStartChat when question is empty', () => {
  // 空文字列のテスト
});
test('should not call onStartChat when question is whitespace only', () => {
  // 空白文字列のテスト - ロジックがtrim()のみをチェックする場合は冗長
});
test('should not call onStartChat when question is null', () => {
  // 入力検証が他の場所で処理される場合は多くの場合不要
});

// ❌ 間違い: 複数の副作用をテスト
test('should call function and not call other function', () => {
  expect(mockFunctionA).toHaveBeenCalled();
  expect(mockFunctionB).not.toHaveBeenCalled(); // 別のテストにすべき
});
```

## テスト簡素化の例

**重要な分岐のみに焦点：**

```typescript
// ✅ 正しい: 核心的分岐ロジックのみテスト
describe('createKeyDownHandler', () => {
  test('should call onStartChat when Enter key is pressed', () => {
    const handleKeyDown = createKeyDownHandler(mockOnStartChat);
    const enterKeyEvent = { key: "Enter" } as React.KeyboardEvent;
    
    handleKeyDown(enterKeyEvent);
    
    expect(mockOnStartChat).toHaveBeenCalledTimes(1);
  });

  test('should not call onStartChat when other keys are pressed', () => {
    const handleKeyDown = createKeyDownHandler(mockOnStartChat);
    const spaceKeyEvent = { key: " " } as React.KeyboardEvent;
    
    handleKeyDown(spaceKeyEvent);
    
    expect(mockOnStartChat).not.toHaveBeenCalled();
  });
});

// ✅ 正しい: 重要な条件のみテスト
describe('createHandleStartChat', () => {
  test('should call onStartChat when question has valid content', () => {
    const question = "浅草周辺を午後から回りたい";
    const handleStartChat = createHandleStartChat(question, mockOnStartChat);
    
    handleStartChat();
    
    expect(mockOnStartChat).toHaveBeenCalledWith(question);
  });

  test('should not call onStartChat when question is empty or whitespace', () => {
    const emptyQuestion = "";
    const handleStartChat = createHandleStartChat(emptyQuestion, mockOnStartChat);
    
    handleStartChat();
    
    expect(mockOnStartChat).not.toHaveBeenCalled();
  });
});
```

## 複数のアサーションの処理

複数の関連プロパティを検証する必要がある場合は、オブジェクト比較を使用：

```typescript
// ✅ 正しい: オブジェクト比較で単一のexpect
test('should return complete user status', () => {
  const user = { role: 'editor', level: 3 };
  const settings = { editingEnabled: true, maxLevel: 5 };
  
  const actual = getUserStatus(user, settings);
  
  const expected = {
    canEdit: true,
    canDelete: false,
    accessLevel: 'standard'
  };
  expect(actual).toEqual(expected);
});
```

## コンポーネントテスト構造

```typescript
describe('StatusBadge', () => {
  // Arrange: 共通props
  const defaultProps = {
    status: 'success' as const,
    showIcon: true,
  };

  test('should render success icon when showIcon is true', () => {
    // Act
    render(<StatusBadge {...defaultProps} />);
    const actual = screen.queryByRole('img');
    
    // Assert
    const expected = expect.anything(); // アイコンが存在すべき
    expect(actual).toEqual(expected);
  });

  test('should hide icon when showIcon is false', () => {
    // Arrange
    const props = { ...defaultProps, showIcon: false };
    
    // Act
    render(<StatusBadge {...props} />);
    const actual = screen.queryByRole('img');
    
    // Assert
    const expected = null;
    expect(actual).toBe(expected);
  });

  test('should display error styling for error status', () => {
    // Arrange
    const props = { ...defaultProps, status: 'error' as const };
    
    // Act
    render(<StatusBadge {...props} />);
    const actual = screen.getByText('error').className;
    
    // Assert
    const expected = expect.stringContaining('badge-error');
    expect(actual).toEqual(expected);
  });
});
```