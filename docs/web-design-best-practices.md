# Web Design - 実装原則

**出典**: Kinsta, WebStacks

---

## 6つのコアデザイン原則

### 1. シンプルさを保つ
**原則**: 不要な要素を削除し、ユーザーを圧倒しない

- ✅ ファーストビューで単一の主要CTA
- ✅ アクション志向のボタンラベル（「今すぐ購入」「無料で試す」）
- ✅ 十分な余白でコンテンツを呼吸させる
- ✅ 関連情報を論理的にグループ化
- ❌ 複数の競合するCTA、曖昧なボタンテキスト

**実装例**:
```tsx
// ✅ シンプルで明確なCTA
<section className="flex flex-col items-center gap-4">
  <h1 className="text-4xl font-bold">無料で始める</h1>
  <Button size="lg" className="bg-primary">
    今すぐ始める
  </Button>
  <p className="text-sm text-muted-foreground">
    クレジットカード不要
  </p>
</section>

// ❌ 悪い例: 複数の競合するCTA
<div>
  <Button>送信</Button>
  <Button>クリック</Button>
  <Button>詳細</Button>
  <Button>今すぐ</Button>
</div>
```

---

### 2. 視覚階層を作る
**原則**: サイズ、色、コントラストで重要度を明確に

- ✅ 重要な要素を**大きく**
- ✅ 高コントラストで注目を集める
- ✅ 配置と余白で重要度を示す
- ✅ タイポグラフィの太さと大きさで階層構築
- ❌ すべて同じサイズ・色・重さ

**実装例**:
```tsx
// ✅ 明確な視覚階層
<div className="space-y-4">
  <h1 className="font-bold text-4xl">主要見出し</h1>
  <h2 className="font-semibold text-2xl">副見出し</h2>
  <p className="text-base">本文テキスト</p>

  {/* CTAの階層 */}
  <div className="flex gap-4">
    <Button
      size="lg"
      className="bg-primary px-8 py-4 font-semibold text-lg"
    >
      主要アクション
    </Button>
    <Button
      variant="outline"
      size="sm"
      className="px-4 py-2"
    >
      サブアクション
    </Button>
  </div>
</div>
```

---

### 3. 一貫性を維持
**原則**: インターフェース全体で統一されたパターン

- ✅ 同じアクションに同じボタンスタイル
- ✅ 一貫したスペーシングスケール（4px, 8px, 16px, 24px...）
- ✅ 予測可能なナビゲーション配置
- ✅ 統一されたインタラクション動作
- ❌ ページごとに異なるスタイル、ランダムなマージン

**実装例**:
```tsx
// ✅ デザイントークンで一貫性
const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
} as const

const colors = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  error: '#EF4444',
} as const

// すべての主要ボタンが同じスタイル
<Button className="bg-primary px-md py-sm rounded-lg">
  アクション
</Button>
```

---

### 4. 即座にフィードバック
**原則**: ユーザーの全アクションに視覚的確認を提供

- ✅ ホバー状態、アクティブ状態、無効状態
- ✅ ローディング表示（スケルトン、スピナー）
- ✅ 成功/エラーメッセージ（トースト、アラート）
- ✅ フォームバリデーションはリアルタイム
- ❌ 反応のないボタン、遅延フィードバック

**実装例**:
```tsx
// ✅ 即座のフィードバック
<Button
  className={cn(
    "transition-all duration-200",
    "hover:scale-105 hover:shadow-lg",
    "active:scale-95",
    "disabled:opacity-50 disabled:cursor-not-allowed"
  )}
  disabled={isLoading}
>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      処理中...
    </>
  ) : (
    "送信"
  )}
</Button>

// ✅ リアルタイムバリデーション
<Input
  error={errors.email}
  onChange={(e) => {
    validateEmail(e.target.value) // 即座に検証
  }}
/>
{errors.email && (
  <p className="text-destructive text-sm">{errors.email}</p>
)}
```

---

### 5. アクセシビリティを確保
**原則**: すべてのユーザーが利用可能に

- ✅ セマンティックHTML（`<header>`, `<nav>`, `<main>`, `<article>`）
- ✅ コントラスト比 **4.5:1以上**（WCAG AA準拠）
- ✅ キーボードナビゲーション対応（Tab, Enter, Escape）
- ✅ 画像にalt属性、フォームにラベル
- ❌ divだらけ、低コントラスト、キーボード不可

**実装例**:
```tsx
// ✅ アクセシブルなフォーム
<form>
  <label htmlFor="email" className="sr-only">
    メールアドレス
  </label>
  <Input
    id="email"
    type="email"
    aria-label="メールアドレスを入力"
    aria-describedby="email-error"
    aria-invalid={!!errors.email}
  />
  {errors.email && (
    <p id="email-error" role="alert" className="text-destructive">
      {errors.email}
    </p>
  )}
</form>

// ✅ セマンティックHTML
<article className="space-y-4">
  <header>
    <h1>記事タイトル</h1>
  </header>
  <main>
    <p>本文...</p>
  </main>
  <footer>
    <time dateTime="2025-12-09">2025年12月9日</time>
  </footer>
</article>
```

---

### 6. レスポンシブ対応
**原則**: あらゆるデバイスで最適な体験

- ✅ モバイルファースト設計
- ✅ ブレークポイント: **sm(640px), md(768px), lg(1024px), xl(1280px)**
- ✅ タッチターゲット **44x44px以上**
- ✅ フレキシブルグリッド、流動的画像
- ❌ 固定幅レイアウト、小さすぎるボタン

**実装例**:
```tsx
// ✅ レスポンシブグリッド
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>

// ✅ タッチターゲット
<Button className="min-h-[44px] min-w-[44px]">
  タップ
</Button>

// ✅ レスポンシブタイポグラフィ
<h1 className="text-2xl md:text-3xl lg:text-4xl">
  見出し
</h1>
```

---

## クイックチェックリスト

実装時に確認すべき6項目:

```
[ ] 1. シンプル: 単一CTA、十分な余白、明確なアクション
[ ] 2. 視覚階層: 重要度に応じたサイズ・色・コントラスト
[ ] 3. 一貫性: 統一されたスタイル・スペーシング・パターン
[ ] 4. フィードバック: ホバー・ローディング・成功/エラー表示
[ ] 5. アクセシビリティ: セマンティックHTML、4.5:1コントラスト、キーボード対応
[ ] 6. レスポンシブ: モバイルファースト、44x44pxタッチターゲット
```

---

## カラー戦略

### コントラスト
- **テキスト**: 背景とのコントラスト比 **4.5:1以上**（本文）、**3:1以上**（大きなテキスト）
- **ボタン**: 高コントラストで視認性確保

### カラーパレット
```tsx
// プライマリ + バリエーション
const colors = {
  primary: {
    DEFAULT: '#3B82F6',  // Base
    hover: '#2563EB',     // Darker
    light: '#93C5FD',     // Lighter
  },
  // 3-5色に制限
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
}
```

---

## タイポグラフィ

### スケール
```tsx
const typography = {
  h1: 'text-4xl font-bold',      // 36px
  h2: 'text-3xl font-bold',      // 30px
  h3: 'text-2xl font-semibold',  // 24px
  h4: 'text-xl font-semibold',   // 20px
  body: 'text-base',             // 16px
  small: 'text-sm',              // 14px
  tiny: 'text-xs',               // 12px
}
```

### 読みやすさ
- ✅ 行間: **1.5-1.6**
- ✅ 行長: **45-75文字**
- ✅ フォント数: **最大3種類**

---

## スペーシング

### 一貫したスケール
```tsx
const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
  12: '48px',
  16: '64px',
}
```

### 適用
- ✅ 要素間: **8px, 16px, 24px**
- ✅ セクション間: **48px, 64px**
- ✅ パディング: **16px, 24px, 32px**

---

## アニメーション

### 原則
- ✅ 意味のある動き（ユーザー理解を助ける）
- ✅ 短時間（**200-300ms**）
- ✅ 自然なイージング（`ease-in-out`, `cubic-bezier`）
- ❌ 過度なアニメーション、遅い動き

```tsx
// ✅ シンプルなトランジション
<div className="transition-all duration-200 ease-in-out hover:scale-105">
  カード
</div>

// ✅ フェードイン
<div className="animate-in fade-in duration-300">
  コンテンツ
</div>
```

---

## パフォーマンス

### 重要メトリクス
- **LCP** (Largest Contentful Paint): 2.5秒以下
- **FID** (First Input Delay): 100ms以下
- **CLS** (Cumulative Layout Shift): 0.1以下

### 最適化
```tsx
// ✅ 画像最適化
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="ヒーロー画像"
  width={1200}
  height={600}
  priority // Above the fold
  loading="lazy" // Below the fold
/>

// ✅ コード分割
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false,
})
```

---

## 避けるべきミス

### デザイン
- ❌ 低コントラスト（読みにくい）
- ❌ 小さすぎるフォント（16px未満）
- ❌ 過度なアニメーション
- ❌ 一貫性のないスタイル

### UX
- ❌ 遅いローディング（フィードバックなし）
- ❌ 複雑すぎるフォーム
- ❌ 不明確なエラーメッセージ
- ❌ キーボードナビゲーション不可

### アクセシビリティ
- ❌ alt属性なしの画像
- ❌ セマンティックでないHTML（divだらけ）
- ❌ 低コントラスト比（4.5:1未満）

---

**最終更新**: 2025年12月9日
