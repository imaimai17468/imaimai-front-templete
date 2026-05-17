# Types

## Branded Types for ID Distinction

When semantically different values share the same primitive type (e.g., `UserId` and `ArticleId` are both strings), make them distinguishable at compile time using Branded Types. Without branding, passing a user ID where an article ID is expected causes no compiler error.

Use **unique symbol** as the brand. String-keyed brands (`__brand__`) pollute autocomplete.

```tsx
// --- userId.ts ---
const userIdBrand = Symbol();
export type UserId = string & { [userIdBrand]: unknown };
export const createUserId = (rawId: string): UserId => rawId as UserId;

// --- articleId.ts ---
const articleIdBrand = Symbol();
export type ArticleId = string & { [articleIdBrand]: unknown };
export const createArticleId = (rawId: string): ArticleId => rawId as ArticleId;
```

Key points:
- Do not export the symbol. The type "lie" stays contained within the module.
- At runtime, branded values remain plain strings — usable directly in DB queries and API calls with no conversion overhead.
- Confine `as` casts to factory functions (`createUserId`, etc.). Call sites should never cast directly.
