# Functional Style Guide

関数を書く際に守る3つの原則: **イミュータブル**・**関数型**・**型推論が効く**。

---

## 1. イミュータブル

引数や外部状態を変更しない。常に新しい値を返す。

```typescript
// ❌ 引数の Map を変更
const appendToGroup = (map: Map<string, Doc[]>, key: string, row: Doc) =>
  map.set(key, [...(map.get(key) ?? []), row]);

// ✅ Remeda の groupBy で新しいオブジェクトを返す
import { groupBy } from "remeda";
const grouped = groupBy(items, (item) => item.key);
```

```typescript
// ❌ reduce 内でアキュムレータを変更
rows.reduce((acc, row) => {
  acc.noDateRows = [...acc.noDateRows, row]; // プロパティ再代入
  return acc;
}, { dateMap: new Map(), noDateRows: [] });

// ✅ partition で分割してから構築
import { partition } from "remeda";
const [dated, undated] = partition(items, (item) => item.key !== null);
```

### Remeda の活用

| やりたいこと | 使う関数 |
|-------------|---------|
| キーでグルーピング | `groupBy` |
| 条件で2分割 | `partition` |
| ユニークな値 | `unique` / `uniqueBy` |
| オブジェクト変換 | `mapValues` / `mapKeys` |
| パイプライン | `pipe` |

---

## 2. 関数型

`for`/`while`/`push` を使わず、`map`/`filter`/`flatMap`/`reduce` や再帰で書く。

### パターン対応表

| 命令型パターン | 関数型の置き換え |
|--------------|---------------|
| `for` + `push` で配列構築 | `map` / `flatMap` |
| `for` + 条件 `push` | `filter` + `map` |
| `for` + `Map.set` でグルーピング | Remeda `groupBy` |
| `for` + early return で検索 | `find` / `map` + `find` |
| `while` で木を走査 | 再帰関数 |
| ネストした `for` | `flatMap` |
| `for` + `await` (逐次) | `Promise.all(items.map(...))` |
| テスト内の `for` | `it.each` |

### null 除外パターン

```typescript
// ❌ map + filter with type guard
items
  .map((item) => transform(item))
  .filter((x): x is Result => x !== null);

// ✅ flatMap で null を除外（型推論が自然に効く）
items.flatMap((item) => {
  const result = transform(item);
  return result ? [result] : [];
});
```

### 再帰による木走査

```typescript
// ❌ while ループで変更しながら走査
let node = current;
while (node.parentId) {
  const parent = map.get(node.parentId);
  if (!parent) break;
  chain.unshift(parent);
  node = parent;
}

// ✅ 再帰で新しい配列を返す
const collectAncestors = (
  map: Map<string, Node>,
  parentId: string | null,
): AncestorNode[] => {
  if (!parentId) return [];
  const parent = map.get(parentId);
  if (!parent) return [];
  return [
    ...collectAncestors(map, parent.parentId),
    { id: parent.id, title: parent.title },
  ];
};
```

### 副作用 API の例外

Yjs や DOM API など、副作用前提の API は `forEach` を使ってよい。
ただし `map` + `filter` で前処理してから `forEach` に渡す。

```typescript
// ✅ 前処理は関数型、副作用だけ forEach
json.content
  .map((node) => toYXml(node))
  .filter((el): el is Y.XmlElement => el !== null)
  .forEach((el) => fragment.push([el]));
```

---

## 3. 型推論が効く

TypeScript の推論を最大限活かし、冗長な型注釈を書かない。

### 不要な型注釈を書かない

```typescript
// ❌ map の返り値に型注釈（推論できる）
const groups: RowGroup[] = options.map((opt) => ({
  key: opt.label,
  rows: [],
}));

// ✅ 推論に任せる
const groups = options.map((opt) => ({
  key: opt.label,
  rows: [] as Document[],  // 空配列のみ要素型が推論できないので注釈
}));
```

### `!` (non-null assertion) を避ける

```typescript
// ❌ partition 後に ! で握りつぶす
const [dated, undated] = partition(items, (item) => item.key !== null);
const grouped = groupBy(dated, (item) => item.key!);  // ← TS は key: string | null のまま

// ✅ type predicate で型を絞り込む
const [dated, undated] = partition(
  items,
  (item): item is { row: Document; key: string } => item.key !== null,
);
const grouped = groupBy(dated, (item) => item.key);  // ← key: string に推論される
```

### `as` キャストを避ける

```typescript
// ❌ filter + as で型を騙す
.filter((a): a is ArrowData => a !== null);

// ✅ flatMap で null を構造的に除外
.flatMap((item) => {
  if (!item) return [];
  return [item];  // 型は自然に ArrowData に推論される
});
```

### 既存の型を再利用する

```typescript
// ❌ 手書きで型を再定義
const findColor = (
  properties: Record<string, { value: string | number | boolean | null | string[] }>
) => { ... };

// ✅ 既存の型を import して使う
import type { DocumentProperties } from "@/entities/database";
const findColor = (properties: DocumentProperties) => { ... };
```

---

## 4. `let` を使わない

`let` は再代入を許すため、値の流れが追いにくくなる。`const` で書けるように構造を工夫する。

### パターン対応表

| `let` パターン | `const` の置き換え |
|--------------|------------------|
| `let x; if (...) x = a; else x = b;` | `const x = ... ? a : b;` (三項演算子) |
| `let x = init; if (...) x = other;` | `const x = ... ? other : init;` |
| `let x; try { x = ...; } catch { x = fallback; }` | `const x = (() => { try { return ...; } catch { return fallback; } })();` |
| `let flag = false; callback(() => { flag = true; }); if (flag) ...` | 副作用の結果を別の方法で検出（例: `tr.steps.length > 0`） |
| `let x = a; switch (...) { case: x = b; }` | `const { x } = (() => { switch (...) { ... } })();` |
| `let x; if (a) { x = a.id; } else if (b) { x = await b(); }` | `const x = a?.id ?? (await b?.());` (nullish coalescing) |

### 例外（`let` を使ってよいケース）

- **useEffect のクリーンアップフラグ**: `let ignore = false;` / `let cancelled = false;` — React の定番パターン
- **TipTap 拡張の状態管理**: `let popup`, `let root` — フレームワークの制約
- **モジュールレベルのシングルトンフラグ**: `let initialized = false;` — 遅延初期化

```typescript
// ❌ let + if/else
let text = "";
switch (type) {
  case "created_at": text = formatDateTime(createdAt); break;
  case "updated_at": text = formatDateTime(updatedAt); break;
}

// ✅ const + 三項演算子
const text =
  type === "created_at" ? formatDateTime(createdAt)
  : type === "updated_at" ? formatDateTime(updatedAt)
  : "";
```

```typescript
// ❌ let + try/catch
let content: string;
try {
  content = JSON.stringify(convert(doc));
} catch {
  content = JSON.stringify({ type: "doc", content: [] });
}

// ✅ const + 即時関数
const content = (() => {
  try {
    return JSON.stringify(convert(doc));
  } catch {
    return JSON.stringify({ type: "doc", content: [] });
  }
})();
```

```typescript
// ❌ let + 複数条件
let colId: string | undefined;
const existing = findColumn(columns);
if (existing) { colId = existing.id; }
else if (onCreate) { colId = await onCreate(); }

// ✅ const + nullish coalescing
const colId = findColumn(columns)?.id ?? (await onCreate?.());
```

---

## チェックリスト

関数を書いた後に確認:

- [ ] `for` / `while` / `push` / `Map.set` を使っていないか
- [ ] 引数やアキュムレータを変更していないか
- [ ] `as` キャスト・`!` (non-null assertion) を使っていないか
- [ ] 冗長な型注釈がないか（推論に任せられないか）
- [ ] 手書きの型を既存の型で置き換えられないか
- [ ] `let` を使っていないか（useEffect クリーンアップフラグ等の例外を除く）
