# Coding Style, Naming & Types

**Linter-enforced:** no-loops, no-tailwind-arbitrary, no-tailwind-opacity (`tools/oxlint-plugins/style-rules.js`)

## Tailwind — utility classes and theme tokens

**Sizing utilities (`w-`, `h-`, `p-`, `m-`, `gap-`, `inset-`, etc.)**

Tailwind v4 generates these dynamically from the `--spacing` variable, so any integer class is valid (e.g., `w-80` = `20rem`, `w-327` works too).

**Tokenizable values (colors, font sizes, border-radius, etc.)**

Add a token to `globals.css` first, then reference it through a Tailwind class. When you need "a lighter color," switch to a **different shade class** (e.g., `text-gray-800` → `text-gray-700`).

## Naming — Three Patterns Based on English Grammar

Identifiers fall into three grammatical patterns. Names that don't follow these patterns introduce ambiguity.

### Pattern 1: Command (Functions / Methods)

Start with a verb in its base form. The name reads as an imperative sentence that conveys "what to do" without a subject.

```tsx
// Basic: verb + object
findUserById(id)
activateUsers()
fetchArticles()

// Conversion: to-syntax
toString()
stringToInt(value)

// Get/set: SVOC sentence pattern
getEnabled()
setEnabled(true)
```

### Pattern 2: Thing / Concept / Person (Variables / Types / Classes)

Use noun phrases. A central noun modified by adjectives, participles, or prepositional phrases.

```tsx
// Adjective + noun
activeUsers
selectedItems

// Present participle (action performed by the subject)
runningProcesses

// Past participle (action received by the object)
usersRemovedByAdmin
filteredArticles

// To-infinitive (future action)
usersToRemove
itemsToProcess
```

Do not use gerunds (-ing) as the head noun. They are ambiguous between "the agent performing the action" and "the feature/concept."

```tsx
// NG — ambiguous: the agent selecting? or the selection feature?
selectingUsers
usersSelecting

// OK
usersSelection
selectedUsers
```

### Pattern 3: Proposition (Boolean Variables)

The name should read as a declarative sentence: subject + verb.

```tsx
// be-verb (passive — describes a received action, acceptable)
item.isDisabled
input.isRequired

// General verbs
array.contains(something)
form.hasEmptyFields

// Modal verbs (preferred for React state/props — expresses purpose)
artifact.canDeploy
dialog.shouldOpen
props.willOpenConfirmDialog
button.canSubmit
```

Omitting the be-verb is acceptable (`enabled`, `visible`, etc.).

For React state flags, props, and hook options, prefer **modal verbs** (`can`, `should`, `will`) over be-verb + adjective (`isActive`, `isAuthenticated`). See hooks.md "Boolean Flag Naming" for details.

### Event Handler Naming

Name event handlers by **user intent**, not by the interaction mechanism (click, tap, etc.).

```tsx
// NG — interaction mechanism is in the name
<Toolbar onClickPlayButton={() => { ... }} />

// OK — focuses on the user's intent
<Toolbar onPlayMovie={() => { ... }} />
```

### Dictionary Usage

Google Translate favors broad, high-frequency words — not ideal for naming. Use an English-English dictionary (e.g., LDOCE) to verify precise meaning, and search `"(word) synonym"` to compare alternatives. Choose words based on contrast relationships, not direct translation.

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
