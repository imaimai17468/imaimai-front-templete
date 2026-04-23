---
name: pr
description: GitHub pull request skill. Use when the user asks to open a PR. Produces a short English summary of what changed, and auto-attaches a demo GIF of the new UI by recording screenshots via chrome-devtools MCP.
user_invocable: true
---

# PR Skill

Open a GitHub pull request with a concise English summary of what changed and, when the PR introduces new UI, attach a demo GIF recorded via chrome-devtools MCP.

---

## Rules

1. **Title**: short and descriptive, under 70 characters. Use a conventional prefix (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`) that reflects the dominant change.
2. **Body**: a `## What changed` section listing concrete changes as bullets, and an optional `## Demo` section embedding a GIF. Nothing else. No test plans, no checklists, no motivation.
3. **Language**: English.
4. **Demo GIF is mandatory** whenever the PR adds or modifies a page / component (anything under `src/app/**` or `src/components/**`). Skip only when the PR is pure config / docs / non-UI code.
5. **Do not push** to remote unless the branch is unpushed — then push the current branch with `-u` first.
6. **Do not create** the PR if the branch has no commits ahead of the base branch.

---

## Body Format

```markdown
## What changed

- <concrete change 1>
- <concrete change 2>
- <concrete change 3>

## Demo

![demo](https://raw.githubusercontent.com/<owner>/<repo>/<branch-slug>/docs/screenshots/<branch-slug>.gif)
```

Use an absolute `raw.githubusercontent.com` URL — relative paths like `docs/screenshots/...` do **not** render in GitHub PR descriptions. Resolve `<owner>/<repo>` from `git remote get-url origin`, and `<branch-slug>` from `git branch --show-current | tr '/' '-'`.

Each `## What changed` bullet describes **what was changed in the code**, not why. One fact per bullet.

Drop the `## Demo` section entirely if no UI change exists (rule 4).

---

## Recording the Demo GIF

Required tools: `chrome-devtools` MCP, `ffmpeg` (already installed at `/opt/homebrew/bin/ffmpeg`), a running dev server at `http://localhost:3000`.

### Procedure

1. **Decide target pages**: look at the diff and determine which route(s) exercise the UI change. Pick the one page that best demonstrates the feature. If multiple pages are affected, pick the primary one.
2. **Ensure dev server is up**: `curl -sf http://localhost:3000 > /dev/null || { echo "start dev server first"; exit 1; }`. If down, tell the user to run `bun run dev` and stop — do not create the PR without a demo.
3. **Set up the capture directory**:
   ```bash
   BRANCH_SLUG=$(git branch --show-current | tr '/' '-')
   CAPTURE_DIR=$(mktemp -d)
   ```
4. **Record frames via chrome-devtools MCP**:
   - `mcp__chrome-devtools__navigate_page` to the target URL
   - Wait briefly for hydration (a couple of seconds via `mcp__chrome-devtools__wait_for` if needed)
   - Capture 10–20 frames spaced ~0.5s apart using `mcp__chrome-devtools__take_screenshot` with `format: "png"`. Base64 decode each response and save as `$CAPTURE_DIR/frame-NN.png`.
   - If the component has interactive behavior (button, input, etc.) that is relevant to demonstrate, interleave `click` / `fill` / `hover` actions between captures.
5. **Build the GIF**:
   ```bash
   mkdir -p docs/screenshots
   ffmpeg -y -framerate 2 -i "$CAPTURE_DIR/frame-%02d.png" \
     -vf "scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
     -loop 0 "docs/screenshots/${BRANCH_SLUG}.gif"
   ```
   Target output size: under 2 MB. If larger, reduce `scale` to `480:-1` or drop framerate.
6. **Commit the GIF** on the current feature branch:
   ```bash
   git add "docs/screenshots/${BRANCH_SLUG}.gif"
   git commit -m "docs: add PR demo GIF for ${BRANCH_SLUG}"
   ```
7. **Push** if needed.

---

## Procedure (overall)

1. Determine the base branch (usually `main`) and confirm the current branch has commits ahead.
2. Run `git log <base>..HEAD --oneline` and `git diff <base>...HEAD --stat` to survey the scope.
3. Decide whether a demo GIF is required (rule 4). If yes, follow the *Recording the Demo GIF* section and commit the GIF before creating the PR.
4. Draft the title and the `## What changed` body based on the actual diff — not on commit messages alone.
5. Push the branch to origin with `-u` if it hasn't been pushed yet.
6. Create the PR with `gh pr create` using a heredoc for the body.
7. Return the PR URL to the user.

---

## Example

```bash
# 1. Check branch state
git log main..HEAD --oneline
git diff main...HEAD --stat

# 2. Record demo GIF (UI change present)
#    — performed by Claude via chrome-devtools MCP + ffmpeg, producing
#    docs/screenshots/feature-add-clock.gif

# 3. Push if needed
git push -u origin feature/add-clock

# 4. Create the PR
gh pr create --title "feat: add Clock component to home page" --body "$(cat <<'EOF'
## What changed

- Add `Clock/Clock.tsx` Presenter that renders `HH:MM:SS`
- Add `Clock/Clock.container.tsx` that updates time every second via `setInterval`
- Wire `ClockContainer` into `src/app/page.tsx`
- Add `Clock.test.tsx` covering rendering variations

## Demo

![demo](https://raw.githubusercontent.com/imaimai17468/imaimai-front-templete/feature-add-clock/docs/screenshots/feature-add-clock.gif)

EOF
)"
```
