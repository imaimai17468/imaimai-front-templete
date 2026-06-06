# Commit Conventions

## Split Discipline

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

## Message Format

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

### Language

Write the body in Japanese. The prefix stays English.

### Trailer

Every commit ends with a `Co-Authored-By:` trailer crediting the current model.
