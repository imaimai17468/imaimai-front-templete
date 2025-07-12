# 命名規則

## 英語文法規則

**原則**: 自然な英語を使用し、適切な文法規則に従う。

### 基本規則
- **関数**: 動詞で始める (`getUserById`, `isValid`, `canEdit`)
- **変数**: 名詞を使用 (`userId`, `totalPrice`, `isLoading`)
- **コンポーネント**: 名詞を使用 (`UserProfile`, `NavigationMenu`)
- **イベントハンドラー**: `handle` + イベント名 (`handleSubmit`, `handleClick`)
- **関数引数**: 2個以上の引数を持つ場合はオブジェクトを使用 (`getUserData({ id, includeProfile })`, `createUser({ name, email })`)

### よくある間違い
```typescript
// ❌ 動詞の欠落
function userById() // → getUserById()
const validEmail // → isEmailValid or validateEmail()

// ❌ 日本語的思考
const getUserInfo // → getUserInformation
const calcPrice // → calculatePrice

// ❌ 不自然な語順
const usersActive // → activeUsers
function getUserFromId() // → getUserById()

// ❌ 複数引数を個別に定義
function createUser(name, email) // → createUser({ name, email })
function updateSettings(id, theme, language) // → updateSettings({ id, theme, language })
function calculatePrice(quantity, unitPrice) // → calculatePrice({ quantity, unitPrice })
```

## 省略規則

**原則**: 省略形を避け、完全な英語の単語を使用する。

### 基本規則
- **避ける**: `bg` → `backgroundColor`, `prev` → `previous`, `btn` → `button`
- **許可**: 確立された技術用語のみ (`id`, `url`, `ref`)

### 頭字語の大文字小文字規則
複合語では、頭字語の標準的な大文字小文字を維持する:

```typescript
// ✅ 正しい
const generateURLParameter = () => {};  // URL は大文字のまま
const APIClient = class {};             // API は大文字のまま
const parseJWTToken = () => {};         // JWT は大文字のまま

// ❌ 間違い
const generateUrlParameter = () => {};  // Url → URL
const apiClient = class {};             // api → API
const parseJwtToken = () => {};         // Jwt → JWT
```