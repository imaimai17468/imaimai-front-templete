---
name: commit
description: Git commit skill. Use when the user asks to commit changes. The core job is to split the working tree into one commit per feature / purpose — never mix unrelated changes into a single commit. Message format rules are secondary and act as a reference only.
user_invocable: true
---

# Commit Skill

Conventions (split discipline, message format) are in `.claude/rules/commit.md`. This skill defines the procedure only.

## Procedure

1. Run `git status` and `git diff` (and `git diff --staged` if anything is already staged) to see all pending changes.
2. Group hunks by purpose using the split discipline rules. Write down the groups before touching `git add`.
3. For each group:
   1. Stage only that group's files with explicit paths: `git add path/to/file1 path/to/file2`.
   2. Run `git diff --staged` to confirm **only** that group's changes are staged.
   3. Write the commit message following the message format rules.
   4. Run `git commit -m "$(cat <<'EOF' ... EOF)"` with a heredoc.
4. After all commits, verify with `git log --oneline -n <count>` and `git status` (should be clean or contain only genuinely out-of-scope work).

If `git status` is not clean after you expected it to be, stop. Something was left behind — figure out whether it belongs in one of the committed groups (amend or add follow-up commit) or was genuinely unrelated.

## Example

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
