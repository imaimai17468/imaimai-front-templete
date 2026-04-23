---
name: commit
description: Git commit skill. Use when the user asks to commit changes. The core job is to split the working tree into one commit per feature / purpose — never mix unrelated changes into a single commit. Message format rules are secondary and act as a reference only.
user_invocable: true
---

# Commit Skill

The reason this skill exists is **split discipline**: agents tend to collapse everything in the working tree into one big commit, which destroys review and revert granularity. Everything else in this file is subordinate to that.

---

## The One Rule That Matters

**One commit = one purpose.** If two changes could be reverted independently without regressing each other, they must be separate commits.

A "purpose" is defined by *intent*, not by file or directory. A single-file edit may be two commits (if it fixes a bug AND adds a feature); a cross-cutting rename may be one commit (single intent).

### How to decide the split

Before staging anything, look at `git status` + `git diff` and ask, for each hunk:

1. **Could I write its commit message in a single sentence, no conjunctions?** If the natural sentence contains "and also", "plus", "while we're at it" — split.
2. **Does one hunk exist only because another hunk was made?** (e.g., a test for a new function, a `.gitignore` entry for a newly generated file) → same commit as its driver.
3. **Are two hunks touching the same concern but for independent reasons?** (e.g., renaming a variable AND fixing its off-by-one bug) → split.
4. **Is it cleanup / drive-by refactor adjacent to the real work?** → split. Bug fixes don't need surrounding cleanup; cleanup commits stand on their own.

### Traps agents fall into

- **"Same file → same commit"** — wrong. One file may need two commits.
- **"While I'm at it, fix this typo"** — that's a second commit. Always.
- **"Bundle the test with the next thing"** — a test for a feature goes in the feature's commit, not deferred.
- **"This config change is small, fold it in"** — small doesn't mean related. Config drift belongs in its own chore commit.
- **`git add -A` / `git add .`** — forbidden. These leak unrelated working-tree state (debug prints, accidental files, secrets) into commits. Always stage with explicit paths: `git add src/foo.ts src/foo.test.ts`.

### Splitting hunks inside a single file

When one file contains two different purposes (e.g., a real bug fix plus a drive-by typo fix you noticed along the way), you cannot stage "the whole file" for either commit — that would mix them. Use interactive patch mode:

```bash
git add -p src/components/Foo.tsx
# For each hunk git shows, answer:
#   y — stage this hunk (belongs in the current commit's purpose)
#   n — skip this hunk (belongs in a later commit)
#   s — split: git offers smaller sub-hunks when one hunk bundles multiple concerns
#   e — edit: hand-edit the patch if `s` can't split finely enough
```

After the first commit, the remaining hunks are still unstaged; you can then run `git add <file>` (or another `git add -p`) for the second commit's purpose. Confirm with `git diff --staged` before each commit.

### When in doubt

Prefer more commits over fewer. A reviewer can always `git log --oneline` to collapse mentally; they cannot un-mix a mixed commit without `git reset`.

---

## Procedure

1. Run `git status` and `git diff` (and `git diff --staged` if anything is already staged) to see all pending changes.
2. Group hunks by purpose using the rules above. Write down the groups before touching `git add`.
3. For each group:
   1. Stage only that group's files with explicit paths: `git add path/to/file1 path/to/file2`.
   2. Run `git diff --staged` to confirm **only** that group's changes are staged.
   3. Write the commit message (see *Message format* below).
   4. Run `git commit -m "$(cat <<'EOF' ... EOF)"` with a heredoc.
4. After all commits, verify with `git log --oneline -n <count>` and `git status` (should be clean or contain only genuinely out-of-scope work).

If `git status` is not clean after you expected it to be, stop. Something was left behind — figure out whether it belongs in one of the committed groups (amend or add follow-up commit) or was genuinely unrelated.

---

## Message Format (reference)

These rules are conventions, not the point of the skill. Follow them, but don't mistake them for the job.

### Prefixes

| prefix     | Use for                                         | Example                                    |
| ---------- | ----------------------------------------------- | ------------------------------------------ |
| `feat`     | New feature or user-visible behavior change     | `feat: ログインダイアログ追加`             |
| `chore`    | Config, dependencies, CI, non-code housekeeping | `chore: eslint 設定更新`                   |
| `test`     | Adding or fixing tests only                     | `test: ArticleCard テスト追加`             |
| `docs`     | Documentation only                              | `docs: README 更新`                        |
| `refactor` | Internal improvement, no behavior change        | `refactor: formatTimeAgo を共通関数に抽出` |
| `fix`      | Bug fix (unintended prior behavior)             | `fix: ダイアログが閉じない問題`            |

Pick by *intent*. A file move may be `refactor` or `chore` depending on whether it changes the module surface.

### Single-line vs. body

- `feat`, `chore`, `test`, `docs` → **single line** is fine.
- `refactor`, `fix` → **add a reason** on a third line. Explain *why* this was needed, not *what* changed (the diff shows what).

```
refactor: ArticleCard の formatTimeAgo をユーティリティに抽出

複数コンポーネントで同じ日時フォーマットロジックを使う必要が出たため。
```

```
fix: ログインダイアログが閉じない問題を修正

onOpenChange のコールバックが state を更新していなかったため。
```

### Language

Write the body in Japanese. The prefix stays English.

### Trailer

Every commit ends with a `Co-Authored-By:` trailer crediting the current model. Use the heredoc form so the blank line before the trailer is preserved:

```bash
git commit -m "$(cat <<'EOF'
fix: ログインダイアログが閉じない問題を修正

onOpenChange のコールバックが state を更新していなかったため。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Example Workflow

```bash
# 1. Survey
git status
git diff

# Situation: edited Timeline.tsx + ArticleCard.tsx for a grid redesign,
# and edited layout.tsx for an unrelated padding fix.
# These are two purposes → two commits.

# 2. Commit the grid redesign
git add src/.../Timeline.tsx src/.../ArticleCard.tsx
git diff --staged   # sanity check: only grid-related hunks
git commit -m "$(cat <<'EOF'
feat: タイムライン記事一覧を2列グリッドに変更

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# 3. Commit the padding fix
git add src/app/layout.tsx
git diff --staged
git commit -m "$(cat <<'EOF'
fix: layout.tsx の二重パディングを修正

outer div の px-10 と main の px-8 が重なってコンテンツが過剰にインセットされていたため。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# 4. Verify
git log --oneline -n 2
git status   # should be clean
```
