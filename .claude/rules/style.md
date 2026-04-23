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

## Tailwind — use existing classes only

Do not use Tailwind's arbitrary value syntax `[...]`. Express everything with existing utilities and the theme tokens defined in `globals.css`.

**Sizing utilities (`w-`, `h-`, `p-`, `m-`, `gap-`, `inset-`, etc.)**

Tailwind v4 generates these dynamically from the `--spacing` variable, so any integer class is valid (e.g., `w-80` = `20rem`, `w-327` works too). Arbitrary values like `w-[327px]` are unnecessary.

**Tokenizable values (colors, font sizes, border-radius, etc.)**

Don't write arbitrary values inline. Add a token to `globals.css` first, then reference it through a Tailwind class.

Don't use the color-opacity modifier `-XXX/YY` (e.g., `text-gray-800/80`, `bg-blue-600/50`) to adjust shade intensity. When you need "a lighter color," switch to a **different shade class** rather than layering opacity (e.g., `text-gray-800` → `text-gray-700`). If true transparency is genuinely required (overlays, etc.), add a dedicated color token in `globals.css` and reference it.

```tsx
// NG — arbitrary values / using opacity to lighten a color
<div className="w-[327px] text-[13px] bg-[#1a1a1a] rounded-[10px] text-gray-800/80" />

// OK — numeric classes for sizing, tokens for color/font-size, shade switch for lightness
<div className="w-80 text-sm bg-background rounded-lg text-gray-700" />
```
