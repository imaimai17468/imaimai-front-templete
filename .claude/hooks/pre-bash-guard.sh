#!/usr/bin/env bash
# PreToolUse(Bash) combined guard:
# 1. .env protection — block any command referencing the protected env files.
#    permissions.deny stops Read/Write/Edit, but allowed Bash readers (cat,
#    grep, head, tail, redirections) could walk around it.
# 2. find gate — prompt for the `find` shapes that reach past the deny list or
#    run/delete, while leaving scoped path discovery unattended.
# 3. git add gate — refuse a `git add` (or its `git stage` synonym) whose
#    operands are not explicit paths, because a blanket stage puts files in the
#    commit that nobody chose.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

# Two harnesses invoke this file. Claude Code sends tool_name "Bash"; Cursor's
# third-party hook loader runs the same registration but delivers its own
# payload, where the terminal tool is named "Shell" (payload captured in this
# repository on 2026-08-07, Cursor 3.14.27 — the event name arrives as
# "preToolUse" and CLAUDE_PROJECT_DIR is provided as a compatibility alias).
# Anything else (Read, Task, MCP tools) passes through.
case "$TOOL" in
  Bash|Shell) ;;
  *) exit 0 ;;
esac

# Emit a deny in both dialects at once: Claude Code reads the legacy
# decision/reason pair (scripts/test-bash-guard.ts keys on the literal
# "block"), Cursor reads hookSpecificOutput.permissionDecision. Cursor was
# observed honoring exactly this combined output (a guard in this file blocked a
# live command in a Cursor session, 2026-08-07). Claude Code has NOT been observed
# parsing the combined shape — both fields agree on the outcome, so the
# accepted risk is a parser that rejects the coexistence outright, not a
# divergent decision; one live Claude Code smoke test of any deny site would
# settle it.
deny() { # $1 = reason
  jq -n --arg reason "$1" '{
    decision: "block",
    reason: $reason,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
}

# Drop a heredoc body, keeping the operator line, the terminator's own line and
# everything after it: text a command receives on stdin is data rather than a
# filename or a nested command, while a command chained after the terminator is
# a command. Dropping only when the body ran to the end of the input instead
# read the body as commands whenever anything followed, so
# `git commit -F - <<'MSG'` / `git add -A was refused` / `MSG` / `git push`
# was refused for a command nobody wrote. With no terminator the body cannot be
# told from the rest, so every line is kept. A redirect belongs to the operator
# line, which is kept either way. Guards 1, 2 and 3 all read the result.
drop_heredoc_body() {
  awk '
    BEGIN { q = sprintf("%c", 39); op = 0; term = 0 }
    { lines[NR] = $0 }
    op == 0 && /<<-?[ \t]*[^ \t]/ {
      op = NR
      d = $0
      sub(/^.*<<-?[ \t]*/, "", d)
      gsub(/["]/, "", d)
      gsub(q, "", d)
      sub(/[ \t].*$/, "", d)
      next
    }
    op > 0 && term == 0 && d != "" {
      trimmed = $0
      sub(/^[ \t]+/, "", trimmed)
      sub(/[ \t]+$/, "", trimmed)
      if (trimmed == d) { term = NR }
    }
    END {
      for (i = 1; i <= NR; i++) {
        if (term > 0 && i > op && i <= term) { continue }
        print lines[i]
      }
    }
  '
}

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

# --- Guard 1: .env protection (applies to parent and sidechains alike) ---
# Scrub the committed example files, then look for a token that *starts* with
# `.env` (optionally `.env.local` / `.env.development` / `.env.production`).
# For `git` and `gh` commands only, the quoted bodies of the inline-text flags
# selected below are also scrubbed first: prose about env files in a commit
# message, a pull request body or a review body is not file access. The scrub
# is deliberately NOT applied to other commands — a quoted message flag can be
# repurposed as a file argument elsewhere (e.g. `sort -m ".env"`).
SCRUBBED=$(printf '%s' "$CMD" | sed 's/\.env[.A-Za-z]*\.example//g')
# NR==1 with an exit: awk would otherwise print the first field of every line,
# and a multi-line command (a heredoc body) then matched no first word at all.
FIRST_WORD=$(printf '%s' "$SCRUBBED" | awk 'NR == 1 { print $1; exit }')
# gh takes inline text through --body, --title and --subject, and reads a file
# through -F/--body-file and -T/--template (gh 2.86.0). gsub runs over the
# whole command rather than over the leading gh alone, so the short -b/-t stay
# out: with `-b` in the pattern the scrub took the operand of a chained
# `cat -b '.env'`, which the grep below then never saw. The pattern follows the
# command's first word, so a gh body behind a leading command is left alone.
case "$FIRST_WORD" in
  git) TEXT_FLAG_PATTERN='--?m(essage)?' ;;
  gh) TEXT_FLAG_PATTERN='--(body|title|subject)' ;;
  *) TEXT_FLAG_PATTERN='' ;;
esac
if [ -n "$TEXT_FLAG_PATTERN" ]; then
  # The whole command is one awk record, so a body spanning lines is still one
  # match. sed cannot do this portably here: its `N` loop quits WITHOUT printing
  # when there is no next line on BSD sed, which emptied every single-line
  # command. The patterns also avoid `\|` and `{1,2}` — BRE alternation is a GNU
  # extension and awk intervals are not universal — so `--?m(essage)?` carries
  # both git spellings instead.
  scrub_message_body() { # $1 = the quote character delimiting the body
    awk -v q="$1" -v flags="$TEXT_FLAG_PATTERN" '
      BEGIN { RS = "\034" }
      { gsub(flags "[= ]?" q "[^" q "]*" q, "", $0); printf "%s", $0 }
    '
  }
  # Single-quoted bodies are always inert (no expansion inside single quotes).
  SCRUBBED=$(printf '%s' "$SCRUBBED" | scrub_message_body "'")
  # Double-quoted bodies expand $(...) / ${...} / backticks, so scrub them
  # only when the command contains no substitution opener at all. A bare `$`
  # (e.g. "$5/mo") is inert and still scrubs; any backtick is conservatively
  # treated as a potential pair (= execution) and blocks scrubbing.
  case "$SCRUBBED" in
    *'$('*|*'${'*|*'`'*) ;;
    *) SCRUBBED=$(printf '%s' "$SCRUBBED" | scrub_message_body '"') ;;
  esac
  # A `-F -` / `--body-file -` body arrives as a heredoc instead, by a route the
  # flag scrub above does not cover.
  SCRUBBED=$(printf '%s' "$SCRUBBED" | drop_heredoc_body)
fi
# `.env` is one of several spellings the shell turns into the same filename: it
# drops a backslash and a quote pair from a word, so `.e\nv`, `.en"v"` and
# `.e''nv` all reach the file (each printed `.env` on 2026-09-08). The grep gets
# the command text and both undecorated forms as three lines, and matching any
# one of them refuses the command, so no spelling this normalizes can cost a
# block that the raw text already earned. Replacing the text with the
# undecorated form instead would have cost one: `"` and `'` are members of the
# character classes below, and dropping them turns `cat -b'.env'` into
# `cat -b.env`, whose `b` those classes do not list.
UNESCAPED=${SCRUBBED//\\/}
UNQUOTED=${UNESCAPED//[\"\']/}
# The set before `.env` decides which tokens count as the filename. `@` joined
# it because `gh api -F key=@FILE` reads the file named after the `@` (gh
# 2.86.0), and `curl -d @FILE` and `curl -F name=@FILE` read it too.
if printf '%s\n%s\n%s' "$SCRUBBED" "$UNESCAPED" "$UNQUOTED" | grep -qE '(^|[[:space:]"'\''`=@{}:,;&|<>(/-])\.env(\.(local|development|production))?([[:space:]"'\''`{}:,;&|<>)*]|$)'; then
  deny "PreToolUse(Bash): this command references a protected env file (.env / .env.local / .env.development / .env.production). Reading or writing these is denied regardless of tool. Use .env.local.example for documented placeholders. To write the filename as prose, put it in a quoted body of \`git\` -m/--message or of \`gh\` --body/--title/--subject: a single-quoted body is read as prose, a double-quoted one only when the command contains no \$(, \${ or backtick."
  exit 0
fi

# Whitespace-normalized command for Guard 2, its only reader: the segment
# filter below matches the literal " find ", so irregular spacing (`find  .`,
# tabs, newlines) must not slip past it.
NORM=$(printf '%s' "$CMD" | drop_heredoc_body | tr -s '[:space:]' ' ')

# --- Guard 2: find with broad reach, or an action that runs or deletes ---
# `find` itself is allow-listed: path discovery is
# routine agent work and prompting for every `find node_modules/...` bought
# nothing. Two shapes are not routine, and this guard prompts for them instead of
# letting the allow rule through:
#
#   - A broad search root. `find . -type f | xargs cat` reads every file in the
#     repository — including the local env file, which under the standing
#     drizzle-kit exception can hold a real D1 API token — using only allow-listed commands.
#     Guard 1 never sees it because the command text contains no `.env` literal.
#     So the reach has to be judged from the root, not from the action.
#   - `-exec` / `-delete` and relatives. These reach past the `rm -rf` prefixes in
#     `deny` and can run an arbitrary command per match.
#
# Over-matching is the safe direction here: an unnecessary prompt costs a
# keystroke, a missed one costs the boundary.
#
# This walks tokens instead of matching one regex, because the first draft did
# the latter and a reviewer defeated it twice: anchoring on the character after
# `find ` meant `find "." -type f` slipped through (the quote shifts it), and
# `find` takes MORE THAN ONE starting path, so `find src / -type f` hid a broad
# root behind a narrow one. Quotes are stripped and every leading operand is
# checked.
FIND_ASK=""
# A heredoc body is data, not a command — a commit message describing
# `find . | xargs cat` must not trip this. Guard 1 scrubs `-m` bodies for the
# same reason; this is the heredoc case, found when the first version of this
# guard refused the commit that introduced it. NORM's `drop_heredoc_body` drops
# the body by reading the terminator. Truncating from the first `<<` instead
# left `cat <<EOF` / `x` / `EOF` / `find / -type f` allowed, because everything
# after the terminator went with the body.
NORM_FIND=$(printf '%s' "$NORM" | tr -d "'\"\`")
while IFS= read -r SEG; do
  [ -n "$FIND_ASK" ] && break
  case " $SEG " in
    *' find '*) ;;
    *) continue ;;
  esac
  SAW_FIND=0
  ROOT_COUNT=0
  IN_PREDICATES=0
  for TOK in $SEG; do
    if [ "$SAW_FIND" -eq 0 ]; then
      [ "$TOK" = find ] && SAW_FIND=1
      continue
    fi
    case "$TOK" in
      # An action that runs a command or deletes, wherever it appears.
      -exec|-execdir|-ok|-okdir|-delete|-fprint|-fprintf|-fls)
        FIND_ASK="it carries an action that runs a command or deletes files"
        break
        ;;
      # Any other flag ends the operand list; the rest are predicate values.
      -*) IN_PREDICATES=1 ;;
      *)
        [ "$IN_PREDICATES" -eq 1 ] && continue
        ROOT_COUNT=$((ROOT_COUNT + 1))
        case "$TOK" in
          . | ./ | .. | ../ | /* | '~'* | '$'* | *'..'*)
            FIND_ASK="a search root reaches the whole repository (or outside it), so it can read files the deny list protects"
            break
            ;;
        esac
        ;;
    esac
  done
  # `find -name x` with no operand searches the working directory implicitly.
  if [ -z "$FIND_ASK" ] && [ "$SAW_FIND" -eq 1 ] && [ "$ROOT_COUNT" -eq 0 ]; then
    FIND_ASK="it names no search root, so it searches the working directory"
  fi
done <<EOF
$(printf '%s' "$NORM_FIND" | tr ';|&' '\n')
EOF
if [ -n "$FIND_ASK" ]; then
  # Blocks rather than prompts. A hook's `permissionDecision: "ask"` is a valid
  # value, but the documented precedence only settles that a *blocking* hook
  # overrides an `allow` rule — which this file's Guard 1 proves in practice by
  # stopping allow-listed `cat .env.local`. Whether a hook's `ask` prompts for an
  # already-allowed command is unstated, and a guard that silently does nothing
  # is worse than a strict one. Revisit if that behaviour is ever confirmed.
  deny "PreToolUse(Bash): this \`find\` is refused because ${FIND_ASK}. A find scoped to a subdirectory, without -exec/-execdir/-ok/-okdir/-delete/-fprint/-fls, runs unattended — narrow it if that is enough. If the broad form is genuinely needed, ask the user to run it."
  exit 0
fi

# --- Guard 3: a git add whose operands are not explicit paths ---
# `-A`, `--all` and `--no-ignore-removal` stage every change in the worktree and
# `-u`/`--update` every tracked one; `.`, `./`, `..`, `/` and a bare `*` name no
# file of their own; a glob in an operand's first component reaches the whole
# tree, so `git add '*.ts'` from the root staged every `.ts` in the scratch
# repository; `:/` and `:(top)` each staged all of it from a subdirectory; and
# `git stage` ran the same builtin (git 2.50.1, 2026-09-08). `git add -p` keeps
# working: it selects hunks instead of sweeping the tree.
#
# The text is Guard 1's SCRUBBED, so a `git`/`gh` message body quoting a refused
# shape stays prose, plus one more heredoc drop so a body written under any other
# command is prose too. The command is then split on `;|&()` and on newlines,
# because the shapes a reviewer used against Guard 2 reach this guard as well:
# `git add "."`, `git  add  -A`, `git status && git add -A`, and
# `GIT_DIR=x git add .`.
#
# `git` has to open the segment, behind nothing but assignments and a wrapper
# such as `env`, `sh -c` or `xargs`. That anchor is what leaves
# `rg 'git add .' src` unattended instead of refusing a search for the text it
# looks for. Two routes stay out of reach: a shell function or a script file,
# which no token walk sees, and an operand that only the shell can resolve, so
# `git add "$FILE"` and `git add $(git diff --name-only)` pass as named paths.
# This binds the habit rather than a deliberate bypass.
#
# The shell drops a quote pair and a backslash from a word, so `g""it`, `\-A`
# and `\*` all reach git undecorated; Guard 1 normalizes the same two
# decorations at UNQUOTED for the same reason. Both run as parameter
# expansions, so neither forks a `tr`, and both run before the early-out below,
# which otherwise let `g""it add -A` past with no literal `git` in its text.
ADD_PLAIN=${SCRUBBED//[\"\'\`]/}
ADD_PLAIN=${ADD_PLAIN//\\/}
# Only a segment a literal `git` opens can be refused, so a command whose text
# holds no `git` leaves before the awk fork below. This hook runs on every Bash
# call, and on `ls -la` over two rounds of 60 interleaved runs it took 173 ms
# and 184 ms with this case against 181 ms and 203 ms without it (a machine
# under parallel load, 2026-09-08). Guard 3 is the last guard, so exiting here
# and reaching the end of the file do the same thing.
case "$ADD_PLAIN" in
  *git*) ;;
  *) exit 0 ;;
esac
ADD_REFUSED=""
# A line of the split that reads `EOF` does not end the heredoc below, because
# bash finds that delimiter in the script text before expanding anything into
# the body.
ADD_TEXT=$(printf '%s' "$ADD_PLAIN" | drop_heredoc_body)
ADD_SEGMENTS=${ADD_TEXT//[;|\&()]/$'\n'}
# A bare `*` operand has to survive word splitting as itself rather than
# expanding to the working directory's entries.
set -f
while IFS= read -r SEG; do
  STATE=prefix
  SKIP_VALUE=0
  SUB=""
  HAS_SELECTION=0
  for TOK in $SEG; do
    if [ "$SKIP_VALUE" -eq 1 ]; then
      SKIP_VALUE=0
      continue
    fi
    case "$STATE" in
      prefix)
        case "$TOK" in
          git) STATE=subcommand ;;
          # An assignment, a redirect, a command that runs another command, or
          # such a command's own flag or count (`timeout 5`) stands between the
          # start of the segment and the git it runs.
          *=* | -* | *'>'* | *'<'* | [0-9]* | env | command | exec | eval | xargs | sh | bash | zsh | sudo | time | timeout | nohup) ;;
          *) break ;;
        esac
        ;;
      subcommand)
        case "$TOK" in
          # git's own options that take the following token as their value
          # (`git --help`, git 2.50.1). Skipping the value keeps a value that
          # happens to read like a subcommand from ending the walk.
          -C | -c | --git-dir | --work-tree | --namespace | --exec-path | --config-env)
            SKIP_VALUE=1
            ;;
          -*) ;;
          add | stage)
            SUB=$TOK
            STATE=operands
            ;;
          *) break ;;
        esac
        ;;
      operands)
        case "$TOK" in
          --all | --no-ignore-removal)
            ADD_REFUSED="\`${TOK}\` stages every change in the worktree instead of the paths you name"
            break
            ;;
          --update)
            ADD_REFUSED="\`--update\` stages every tracked change in the worktree instead of the paths you name"
            break
            ;;
          --patch | --interactive | --edit) HAS_SELECTION=1 ;;
          --*) ;;
          -*)
            # git clusters its short options (`git add -Av` staged the whole
            # scratch repository), so the letters are read one by one.
            case "${TOK#-}" in
              *A*)
                ADD_REFUSED="the short option -A stages every change in the worktree instead of the paths you name"
                break
                ;;
              *u*)
                ADD_REFUSED="the short option -u stages every tracked change in the worktree instead of the paths you name"
                break
                ;;
              *[pie]*) HAS_SELECTION=1 ;;
            esac
            ;;
          :*)
            ADD_REFUSED="an operand begins with \`:\`, so it is pathspec magic rather than a path: \`:\` is the working directory, and \`:/\` and \`:(top)\` are the repository root"
            break
            ;;
          *)
            # Strip the punctuation a path is built from. An operand left empty
            # spells the working directory, a parent, a root or a glob, and
            # names no file of its own.
            if [ -z "${TOK//[.*?~\/]/}" ]; then
              ADD_REFUSED="\`${TOK}\` names no file or directory of its own"
              break
            fi
            # A glob in the first path component starts its match at the top:
            # `git add '*.ts'` from the repository root staged every `.ts` in
            # the tree, including the ones nobody listed. A glob further down
            # (`src/components/ui/*.tsx`) is bounded by the directory named
            # ahead of it.
            case "${TOK%%/*}" in
              *[*?]*)
                ADD_REFUSED="the first path component of \`${TOK}\` is a glob, so it matches names you did not list"
                break
                ;;
            esac
            HAS_SELECTION=1
            ;;
        esac
        ;;
    esac
  done
  # An allowed invocation either names a path or selects hunks. This branch is
  # what makes that the rule rather than a list of bad flags, and it is the only
  # refusal that `--pathspec-from-file=paths.txt` and
  # `git diff --name-only | xargs git add` reach: both take their operands from
  # somewhere the command text does not show. A bare `git add` stages nothing by
  # itself and prints `hint: Maybe you wanted to say 'git add .'?`
  # (git 2.50.1), so the refusal names the right form before the hint names the
  # wrong one.
  if [ -z "$ADD_REFUSED" ] && [ -n "$SUB" ] && [ "$HAS_SELECTION" -eq 0 ]; then
    ADD_REFUSED="it names no path to stage"
  fi
  # The loop body runs in this shell, so SUB survives the break and names the
  # subcommand the refusal came from.
  if [ -n "$ADD_REFUSED" ]; then
    break
  fi
done <<EOF
$ADD_SEGMENTS
EOF
set +f
if [ -n "$ADD_REFUSED" ]; then
  deny "PreToolUse(Bash): this \`git ${SUB}\` is refused because ${ADD_REFUSED}. Name the files this commit needs (\`git add src/foo.ts src/bar.ts\`), and take part of a file with \`git add -p\`. \`git status --short\` lists what changed."
  exit 0
fi

exit 0
