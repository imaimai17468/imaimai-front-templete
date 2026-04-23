# Coding Style

## No Loops

`for`, `for...in`, `for...of`, `while`, `do...while` are forbidden. Use functional alternatives.

```tsx
// NG
for (let i = 0; i < items.length; i++) {
  results.push(transform(items[i]));
}

// OK
const results = items.map(transform);
```

| Purpose     | Method                  |
| ----------- | ----------------------- |
| Transform   | `map`                   |
| Filter      | `filter`                |
| Aggregate   | `reduce`                |
| Flat + Map  | `flatMap`               |
| Side effect | `forEach`               |
| Existence   | `some`, `every`, `find` |

## Tailwind — 既存クラスを使う

Tailwind の arbitrary value 記法 `[...]` は使わない。既存のユーティリティと `globals.css` のテーマトークンだけで表現する。

**サイズ系 (`w-`, `h-`, `p-`, `m-`, `gap-`, `inset-` 等)**

Tailwind v4 では `--spacing` 変数ベースで動的生成されるため、任意の整数をそのまま使える（例: `w-80` = `20rem`、`w-327` も有効）。`w-[327px]` のような arbitrary は不要。

**色・フォントサイズ・border-radius など "トークン化したいもの"**

arbitrary で直書きせず、`globals.css` にトークンを追加してから Tailwind クラスで参照する。

色の透明度修飾子 `-XXX/YY`（例: `text-gray-800/80`, `bg-blue-600/50`）で色の濃淡を調整しない。「色を薄く」が必要な場面では、透明度を乗せるのではなく**別のシェードのクラス**に切り替える（例: `text-gray-800` → `text-gray-700`）。半透明が本当に必要な場合（オーバーレイ等）は `globals.css` に専用のカラートークンを登録してから参照する。

```tsx
// NG — arbitrary value / 色を薄くするために透明度を使う
<div className="w-[327px] text-[13px] bg-[#1a1a1a] rounded-[10px] text-gray-800/80" />

// OK — サイズは数値クラス、色・フォントサイズはトークン、薄くするならシェードを変える
<div className="w-80 text-sm bg-background rounded-lg text-gray-700" />
```
