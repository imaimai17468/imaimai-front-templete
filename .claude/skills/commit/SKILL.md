---
name: commit
description: Git commit skill. Use when the user asks to commit changes. Splits commits by feature/content, uses conventional commit prefixes, and ensures each commit contains only the changes described in its message.
user_invocable: true
---

# Commit Skill

Split changes into well-scoped commits grouped by feature or purpose.

---

## Commit Prefix

Use the following prefixes:

| prefix     | Usage                                        | Example                                    |
| ---------- | -------------------------------------------- | ------------------------------------------ |
| `feat`     | New feature or UI/behavior change            | `feat: ログインダイアログ追加`             |
| `chore`    | Config, dependencies, CI                     | `chore: eslint設定更新`                    |
| `test`     | Add or fix tests                             | `test: ArticleCard テスト追加`             |
| `docs`     | Documentation changes                        | `docs: README更新`                         |
| `refactor` | Internal improvement with no behavior change | `refactor: formatTimeAgo を共通関数に抽出` |
| `fix`      | Bug fix (unintended behavior)                | `fix: ダイアログが閉じない問題`            |

---

## Commit Message Format

### feat, chore, test, docs

Single line. Write the content concisely after the prefix.

```
feat: 記事一覧を2列グリッドに変更
```

### refactor, fix

Add a **reason** on the 3rd line explaining why the change was needed.

```
refactor: ArticleCard の formatTimeAgo をユーティリティに抽出

複数コンポーネントで同じ日時フォーマットロジックを使う必要が出たため。
```

```
fix: ログインダイアログが閉じない問題を修正

onOpenChange のコールバックが state を更新していなかったため。
```

---

## Rules

1. **Split commits by feature/purpose** — do not mix unrelated changes in one commit
2. **Only include diffs described in the commit message** — use explicit `git add <file>` (never `git add -A` or `git add .`)
3. **Write in Japanese** — except for the prefix
4. **Append Co-Authored-By trailer**

---

## Procedure

1. Run `git status` and `git diff` to understand all changes
2. Group changes by feature/purpose
3. For each group:
   a. Stage only the target files with `git add <file1> <file2> ...`
   b. Write the commit message (following the format above)
   c. Run `git commit`
4. After all commits, verify with `git log --oneline -n <count>`

---

## Example Workflow

```bash
# 1. Review changes
git status
git diff --stat

# 2. Stage files for feature A
git add src/components/features/timeline-page/timeline/Timeline.tsx
git add src/components/features/timeline-page/timeline/article-card/ArticleCard.tsx

# 3. Commit
git commit -m "$(cat <<'EOF'
feat: タイムライン記事一覧を2列グリッドに変更

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"

# 4. Stage files for feature B
git add src/app/layout.tsx

# 5. Commit
git commit -m "$(cat <<'EOF'
fix: layout.tsx の二重パディング修正

outer div の px-10 を削除し main を px-8 に変更。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```
