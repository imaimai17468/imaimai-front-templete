# Dependencies

## Exact Version Pinning

Dependency versions in `package.json` must be **fully pinned**. Do not use range specifiers (`^`, `~`) or major-only notation (`"4"`, `"^20"`) — always write exact versions like `"1.2.3"`.

**NG**

```json
{
  "dependencies": {
    "next": "^16.1.1",
    "react": "^19.2.3"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20"
  }
}
```

**OK**

```json
{
  "dependencies": {
    "next": "16.1.1",
    "react": "19.2.3"
  },
  "devDependencies": {
    "typescript": "5.8.3",
    "@types/node": "20.19.9"
  }
}
```

**When adding or updating:**

- Add as exact: `bun add -E <pkg>` / `bun add -E -d <pkg>`.
- When updating an existing dependency, check that no `^` / `~` / major-only notation remains in `package.json` after the update. If a range crept in, fix it manually to exact.
- To see the currently installed versions, use `bun pm ls`.

Rationale: this is a template repository, so derivative projects must not see environment drift. Updates are intentional, and `package.json` must always match the lockfile.
