# shellcheck shell=bash
# The decision behind the PreToolUse(Bash) guard: given one command's text,
# `guard_refusal` prints the sentence that refuses it, and prints nothing for a
# command the three guards below allow. Reading the hook payload off stdin and
# printing the refusal in each harness's dialect stay in pre-bash-guard.sh,
# which sources this file.
#
# Nothing here starts a process. Every text pass below runs as parameter
# expansion, `[[ =~ ]]` or `case` in the shell that sources this file. One
# PreToolUse call end to end through pre-bash-guard.sh, on a payload carrying
# `git commit -m 'feat: add the thing'`, took 174 ms, 175 ms and 158 ms over
# three rounds of 20 calls, where an entry that reads the same payload and
# sources this file without calling a guard took 141 ms, 202 ms and 148 ms over
# three rounds of its own: the same range, so the three guards now cost less
# than the noise between rounds (macOS under parallel load, 2026-09-09). The 294
# cases of pre-bash-guard-decision.test.ts answer in 0.41 s of that file's load.
#
# pre-bash-guard.sh sets these options too, and they are here as well so the
# test driver runs the guards under the same ones.
set -euo pipefail

# The newline that joins and separates the lines of a command's text.
NEWLINE=$'\n'

# Each function below hands its answer back by assigning the variable its own
# signature comment names, and its caller declares that name `local`. Printing
# the answer for a `$(...)` read-back forks a subshell instead, and these run
# per command, per segment and per token on a hook that every Bash tool call
# waits for.

# Cut the text at each newline. A text ending in a newline yields a last line
# that is empty, and a text holding none yields itself as the only line.
split_lines() { # $1 = text; sets LINES
  local REST=$1
  LINES=()
  while [[ $REST == *"$NEWLINE"* ]]; do
    LINES+=("${REST%%"$NEWLINE"*}")
    REST=${REST#*"$NEWLINE"}
  done
  LINES+=("$REST")
}

# Take the next word off WORDS_REST, the way the shell splits a line into words
# but without the pathname expansion `for TOK in $TEXT` also performs: a
# `git add '*'` reaching a walk below has already lost its quotes, and expanding
# it against the working directory would hand the walk that directory's entries
# instead of the glob the agent wrote. A walk sets WORDS_REST to the text and
# breaks out of the loop on the token it refuses.
next_word() { # reads and shortens WORDS_REST; sets WORD
  WORDS_REST=${WORDS_REST#"${WORDS_REST%%[![:blank:]]*}"}
  if [ -z "$WORDS_REST" ]; then
    WORD=""
    return 1
  fi
  WORD=${WORDS_REST%%[[:blank:]]*}
  WORDS_REST=${WORDS_REST#"$WORD"}
}

# A line that opens a heredoc: `<<` or `<<-`, blanks, then the delimiter.
HEREDOC_OPERATOR_RE='<<-?[[:blank:]]*[^[:blank:]]'

# Drop a heredoc body and the terminator line that closes it, keeping the
# operator line and everything after the terminator: text a command receives on
# stdin is data rather than a filename or a nested command, while a command
# chained after the terminator is a command. Dropping only when the body ran to
# the end of the input instead read the body as commands whenever anything
# followed, so
# `git commit -F - <<'MSG'` / `git add -A was refused` / `MSG` / `git push`
# was refused for a command nobody wrote. With no terminator the body cannot be
# told from the rest, so every line is kept. A redirect belongs to the operator
# line, which is kept either way. Guards 1, 2 and 3 all read the result.
#
# Only the first operator line on the text counts, and the delimiter is read
# from the last `<<` on it, because that terminator closes the last of the
# bodies the line opens and everything the line opened lies above it. Fed
# `cat <<A <<B` / `bodyA` / `A` / `git add -A` / `B` / `echo done`, the walk
# below scans to `B` and drops both bodies; reading the delimiter from `A`
# would have stopped at `A` and handed the `git add -A` inside B's body to
# Guard 3 as a command.
drop_heredoc_body() { # $1 = text; sets HEREDOC_DROPPED
  local -a LINES
  local KEPT="" BODY="" DELIM="" LINE TRIMMED OPENED=0 CLOSED=0
  split_lines "$1"
  for LINE in "${LINES[@]}"; do
    if [ "$OPENED" -eq 0 ]; then
      if [[ $LINE =~ $HEREDOC_OPERATOR_RE ]]; then
        OPENED=1
        DELIM=${LINE##*<<}
        DELIM=${DELIM#-}
        DELIM=${DELIM#"${DELIM%%[![:blank:]]*}"}
        DELIM=${DELIM//\"/}
        DELIM=${DELIM//\'/}
        DELIM=${DELIM%%[[:blank:]]*}
      fi
      KEPT=$KEPT$NEWLINE$LINE
      continue
    fi
    if [ "$CLOSED" -eq 0 ] && [ -n "$DELIM" ]; then
      TRIMMED=${LINE#"${LINE%%[![:blank:]]*}"}
      TRIMMED=${TRIMMED%"${TRIMMED##*[![:blank:]]}"}
      if [ "$TRIMMED" = "$DELIM" ]; then
        CLOSED=1
        BODY=""
        continue
      fi
      BODY=$BODY$NEWLINE$LINE
      continue
    fi
    KEPT=$KEPT$NEWLINE$LINE
  done
  if [ "$CLOSED" -eq 0 ]; then
    KEPT=$KEPT$BODY
  fi
  HEREDOC_DROPPED=${KEPT#"$NEWLINE"}
}

# Delete the quoted body of an inline-text flag. The whole command is matched at
# once, so a body spanning lines is still one match. The patterns callers pass
# avoid `\|` and `{1,2}` — BRE alternation is a GNU extension — so
# `--?m(essage)?` carries both git spellings instead. Guard 1 reads the result
# to tell prose from file access, Guard 3 to tell a commit message from a
# pathspec.
#
# The loop below carries the parity of quote characters already emitted, and
# deletes a body only where that parity is even, because a single pass over the
# whole text cannot see quote state and matched a `-m` sitting INSIDE a quoted
# argument. Its `[^q]*` then ran from that argument's closing quote to the real
# message's opening quote, so `echo 'use -m' && git commit -a -m 'x'` had
# `-m' && git commit -a -m '` deleted and reached Guard 3 as `echo 'usex'`.
# `echo 'x -m' && git add -A && git commit -m 'y'` walked around the `git add`
# refusal the same way. On odd parity the matched span is emitted unchanged up
# to the quote that closes that argument, and scanning resumes after it.
#
# The regex is leftmost-longest, so the text before the match holds no earlier
# copy of the match, and `%%` finds the match where the regex found it.
scrub_message_body() { # $1 = quote character, $2 = flag pattern, $3 = text; sets MESSAGE_SCRUBBED
  local QUOTE=$1 BODY_RE="$2[= ]?$1[^$1]*$1" REST=$3
  local KEPT="" MATCH BEFORE UNQUOTED FROM_FLAG UP_TO_CLOSE
  while [[ $REST =~ $BODY_RE ]]; do
    MATCH=${BASH_REMATCH[0]}
    BEFORE=${REST%%"$MATCH"*}
    UNQUOTED=${BEFORE//"$QUOTE"/}
    if (( (${#BEFORE} - ${#UNQUOTED}) % 2 == 0 )); then
      KEPT=$KEPT$BEFORE
      REST=${REST#*"$MATCH"}
    else
      FROM_FLAG=${REST#"$BEFORE"}
      UP_TO_CLOSE=${FROM_FLAG%%"$QUOTE"*}
      KEPT=$KEPT$BEFORE$UP_TO_CLOSE$QUOTE
      REST=${FROM_FLAG#*"$QUOTE"}
    fi
  done
  MESSAGE_SCRUBBED=$KEPT$REST
}

# git's two spellings of the inline-message flag, as one ERE.
GIT_MESSAGE_FLAG='--?m(essage)?'

# --- Guard 1: .env protection (applies to parent and sidechains alike) ---
# Scrub the committed example files, then look for a token that *starts* with
# `.env` (optionally `.env.local` / `.env.development` / `.env.production`).
# For `git` and `gh` commands only, the quoted bodies of the inline-text flags
# selected below are also scrubbed first: prose about env files in a commit
# message, a pull request body or a review body is not file access. The scrub
# is deliberately NOT applied to other commands — a quoted message flag can be
# repurposed as a file argument elsewhere (e.g. `sort -m ".env"`).
#
# GUARD_SCRUBBED carries the result to `refuse_protected_env_file` and
# `refuse_unnamed_changes`, which both read it.

# Every spelling of the committed example file, which is documentation rather
# than a secret.
ENV_EXAMPLE_RE='\.env[.A-Za-z]*\.example'

scrub_command_text() { # $1 = the Bash tool's command text; sets GUARD_SCRUBBED
  local SCRUBBED="" REST=$1 MATCH FIRST_WORD TEXT_FLAG_PATTERN
  local HEREDOC_DROPPED MESSAGE_SCRUBBED
  while [[ $REST =~ $ENV_EXAMPLE_RE ]]; do
    MATCH=${BASH_REMATCH[0]}
    SCRUBBED=$SCRUBBED${REST%%"$MATCH"*}
    REST=${REST#*"$MATCH"}
  done
  SCRUBBED=$SCRUBBED$REST
  # The first word of the FIRST line: a multi-line command (a heredoc body)
  # names its command on the line the operator sits on.
  FIRST_WORD=${SCRUBBED%%"$NEWLINE"*}
  FIRST_WORD=${FIRST_WORD#"${FIRST_WORD%%[![:blank:]]*}"}
  FIRST_WORD=${FIRST_WORD%%[[:blank:]]*}
  # gh takes inline text through --body, --title and --subject, and reads a file
  # through -F/--body-file and -T/--template (gh 2.86.0). The scrub runs over the
  # whole command rather than over the leading gh alone, so the short -b/-t stay
  # out: with `-b` in the pattern the scrub took the operand of a chained
  # `cat -b '.env'`, which the search below then never saw. The pattern follows
  # the command's first word, so a gh body behind a leading command is left alone.
  case "$FIRST_WORD" in
    git) TEXT_FLAG_PATTERN=$GIT_MESSAGE_FLAG ;;
    gh) TEXT_FLAG_PATTERN='--(body|title|subject)' ;;
    *) TEXT_FLAG_PATTERN='' ;;
  esac
  if [ -n "$TEXT_FLAG_PATTERN" ]; then
    # Single-quoted bodies are always inert (no expansion inside single quotes).
    scrub_message_body "'" "$TEXT_FLAG_PATTERN" "$SCRUBBED"
    SCRUBBED=$MESSAGE_SCRUBBED
    # Double-quoted bodies expand $(...) / ${...} / backticks, so scrub them
    # only when the command contains no substitution opener at all. A bare `$`
    # (e.g. "$5/mo") is inert and still scrubs; any backtick is conservatively
    # treated as a potential pair (= execution) and blocks scrubbing.
    # shellcheck disable=SC2016 # the openers are matched as literal text here
    case "$SCRUBBED" in
      *'$('* | *'${'* | *'`'*) ;;
      *)
        scrub_message_body '"' "$TEXT_FLAG_PATTERN" "$SCRUBBED"
        SCRUBBED=$MESSAGE_SCRUBBED
        ;;
    esac
    # A `-F -` / `--body-file -` body arrives as a heredoc instead, by a route the
    # flag scrub above does not cover.
    drop_heredoc_body "$SCRUBBED"
    SCRUBBED=$HEREDOC_DROPPED
  fi
  GUARD_SCRUBBED=$SCRUBBED
}

# The set before `.env` decides which tokens count as the filename. `@` joined
# it because `gh api -F key=@FILE` reads the file named after the `@` (gh
# 2.86.0), and `curl -d @FILE` and `curl -F name=@FILE` read it too. The set
# after it closes the token. A newline is a member of `[[:space:]]` on both
# sides, so a line of a multi-line command is bounded the way `^` and `$` bound
# the whole text.
ENV_FILE_RE='(^|[[:space:]"'\''`=@{}:,;&|<>(/-])\.env(\.(local|development|production))?([[:space:]"'\''`{}:,;&|<>)*]|$)'

refuse_protected_env_file() { # reads GUARD_SCRUBBED; sets GUARD_REFUSAL
  local UNESCAPED UNQUOTED
  # `.env` is one of several spellings the shell turns into the same filename: it
  # drops a backslash and a quote pair from a word, so `.e\nv`, `.en"v"` and
  # `.e''nv` all reach the file (each printed `.env` on 2026-09-08). The command
  # text and both undecorated forms are searched, and matching any one of them
  # refuses the command, so no spelling this normalizes can cost a block that the
  # raw text already earned. Replacing the text with the undecorated form instead
  # would have cost one: `"` and `'` are members of the character classes above,
  # and dropping them turns `cat -b'.env'` into `cat -b.env`, whose `b` those
  # classes do not list.
  UNESCAPED=${GUARD_SCRUBBED//\\/}
  UNQUOTED=${UNESCAPED//[\"\']/}
  if [[ $GUARD_SCRUBBED =~ $ENV_FILE_RE || $UNESCAPED =~ $ENV_FILE_RE || $UNQUOTED =~ $ENV_FILE_RE ]]; then
    GUARD_REFUSAL="PreToolUse(Bash): this command references a protected env file (.env / .env.local / .env.development / .env.production). Reading or writing these is denied regardless of tool. Use .env.local.example for documented placeholders. To write the filename as prose, put it in a quoted body of \`git\` -m/--message or of \`gh\` --body/--title/--subject: a single-quoted body is read as prose, a double-quoted one only when the command contains no \$(, \${ or backtick."
  fi
}

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
refuse_broad_find() { # $1 = the Bash tool's command text; sets GUARD_REFUSAL
  local -a LINES
  local NORM NORM_FIND FIND_ASK SEG WORDS_REST WORD SAW_FIND ROOT_COUNT
  local IN_PREDICATES HEREDOC_DROPPED
  # A heredoc body is data, not a command — a commit message describing
  # `find . | xargs cat` must not trip this. Guard 1 scrubs `-m` bodies for the
  # same reason; this is the heredoc case, found when the first version of this
  # guard refused the commit that introduced it. Truncating from the first `<<`
  # instead left `cat <<EOF` / `x` / `EOF` / `find / -type f` allowed, because
  # everything after the terminator went with the body.
  drop_heredoc_body "$1"
  # Whitespace-normalized command for Guard 2, its only reader: the segment
  # filter below matches the literal " find ", so a tab or a newline ahead of
  # `find` must not slip past it. A run of blanks survives the replacement and
  # neither reader minds: the filter needs one blank on each side of the word,
  # and `next_word` skips a run of them.
  NORM=${HEREDOC_DROPPED//[[:space:]]/ }
  FIND_ASK=""
  NORM_FIND=${NORM//[\'\"\`]/}
  split_lines "${NORM_FIND//[;|&]/$NEWLINE}"
  for SEG in "${LINES[@]}"; do
    [ -n "$FIND_ASK" ] && break
    case " $SEG " in
      *' find '*) ;;
      *) continue ;;
    esac
    SAW_FIND=0
    ROOT_COUNT=0
    IN_PREDICATES=0
    WORDS_REST=$SEG
    while next_word; do
      if [ "$SAW_FIND" -eq 0 ]; then
        [ "$WORD" = find ] && SAW_FIND=1
        continue
      fi
      case "$WORD" in
        # An action that runs a command or deletes, wherever it appears.
        -exec | -execdir | -ok | -okdir | -delete | -fprint | -fprintf | -fls)
          FIND_ASK="it carries an action that runs a command or deletes files"
          break
          ;;
        # Any other flag ends the operand list; the rest are predicate values.
        -*) IN_PREDICATES=1 ;;
        *)
          [ "$IN_PREDICATES" -eq 1 ] && continue
          ROOT_COUNT=$((ROOT_COUNT + 1))
          case "$WORD" in
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
  done
  if [ -n "$FIND_ASK" ]; then
    # Blocks rather than prompts. A hook's `permissionDecision: "ask"` is a valid
    # value, but the documented precedence only settles that a *blocking* hook
    # overrides an `allow` rule — which this file's Guard 1 proves in practice by
    # stopping allow-listed `cat .env.local`. Whether a hook's `ask` prompts for an
    # already-allowed command is unstated, and a guard that silently does nothing
    # is worse than a strict one. Revisit if that behaviour is ever confirmed.
    GUARD_REFUSAL="PreToolUse(Bash): this \`find\` is refused because ${FIND_ASK}. A find scoped to a subdirectory, without -exec/-execdir/-ok/-okdir/-delete/-fprint/-fls, runs unattended — narrow it if that is enough. If the broad form is genuinely needed, ask the user to run it."
  fi
}

# --- Guard 3: a git add or git commit that takes changes nobody named ---
# For `git add`, `-A`, `--all` and `--no-ignore-removal` stage every change in
# the worktree and `-u`/`--update` every tracked one; `.`, `./`, `..`, `/` and a
# bare `*` name no file of their own; a glob in an operand's first component
# reaches the whole tree, so `git add '*.ts'` from the root staged every `.ts`
# in the scratch repository; `:/` and `:(top)` each staged all of it from a
# subdirectory; and `git stage` ran the same builtin (git 2.50.1, 2026-09-08).
# `git add -p` keeps working: it selects hunks instead of sweeping the tree.
#
# `git commit` reaches that same set in one step, so it is walked too. `-a`,
# `--all` and a cluster carrying `a` each committed both modified files of the
# scratch repository, and so did a blanket pathspec with no flag at all
# (`git commit -m x .`, `-- .`, `'*.txt'` and `':/'` each committed both),
# because git reads a pathspec as `--only` when neither `--include` nor
# `--only` is given. commit's `-u` is `--untracked-files`, a display mode that
# staged nothing, so that letter is refused for `git add` and allowed here
# (git 2.50.1, 2026-09-09). `--include`/`--only` with no pathspec needs no
# branch of its own: git answered
# `fatal: No paths with --include/--only does not make sense.`
#
# `git rm` reads its operands as a pathspec too, and reaches the whole tree the
# same way. Run as `git rm -n` against a scratch repository holding `a.txt`,
# `sub/b.txt` and `old-dir/c.txt`, each of `-r .`, `-r -- .`, `-rf .`,
# `--cached -r .`, `-r ./`, `-r :/`, `-r :(top)`, `-r '*'` and `'*.txt'` listed
# all three, where `-r old-dir` listed that directory's file alone and a bare
# `git rm` answered `fatal: No pathspec was given. Which files should I
# remove?` (git 2.50.1, 2026-09-09). Every option `git rm -h` lists apart from
# `--pathspec-from-file` (dry-run, quiet, cached, force, `-r`, ignore-unmatch,
# sparse, pathspec-file-nul) changes how it removes rather than which paths, so
# its operands decide the refusal and its walk carries no flag branch of its
# own.
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
# which no token walk sees, and an operand whose value only the shell holds, so
# `git add "$FILE"` and `git add $(git diff --name-only)` pass as named paths.
# `$PWD` and `pwd` are the exception, and the rewrite below spells them `.`.
# This binds the habit rather than a deliberate bypass.
#
# The shell drops a quote pair and a backslash from a word, so `g""it`, `\-A`
# and `\*` all reach git undecorated; Guard 1 normalizes the same two
# decorations at UNQUOTED for the same reason.

# Set REFUSED to the reason one operand takes more than it names, and leave it
# alone when the operand names a path of its own. `git add`, `git rm` and
# `git commit` all read their operands as a pathspec, so all three call this.
refuse_unnamed_operand() { # $1 = one operand token; sets REFUSED
  case "$1" in
    :*)
      REFUSED="an operand begins with \`:\`, so it is pathspec magic rather than a path: \`:\` is the working directory, and \`:/\` and \`:(top)\` are the repository root"
      return
      ;;
  esac
  # Strip the punctuation a path is built from. An operand left empty spells
  # the working directory, a parent, a root or a glob, and names no file of its
  # own.
  if [ -z "${1//[.*?~\/]/}" ]; then
    REFUSED="\`${1}\` names no file or directory of its own"
    return
  fi
  # An operand that ends at `..` climbs back out of the directory it names:
  # `git rm -n -r sub/..`, `sub/../` and `sub/../.` each listed all three
  # tracked files of the scratch repository, where `sub` listed one
  # (git 2.50.1, 2026-09-09). Trailing `/` and `/.` come off first so all three
  # spellings meet the same test, and only where `..` is the last component,
  # which leaves `git add ../sibling/foo.ts` naming its own file.
  local CLIMBS_OUT=$1
  while :; do
    case "$CLIMBS_OUT" in
      */) CLIMBS_OUT=${CLIMBS_OUT%/} ;;
      */.) CLIMBS_OUT=${CLIMBS_OUT%/.} ;;
      *) break ;;
    esac
  done
  case "$CLIMBS_OUT" in
    .. | */..)
      REFUSED="\`${1}\` ends at \`..\`, so it reaches the directory above the one it names"
      return
      ;;
  esac
  # A glob in the first path component starts its match at the top:
  # `git add '*.ts'` from the repository root staged every `.ts` in the tree,
  # including the ones nobody listed, and `git commit -m x '[ab].txt'` reported
  # both modified files of the scratch repository as changes to be committed,
  # so `[` counts with `*` and `?`. A glob further down
  # (`src/components/ui/*.tsx`) is bounded by the directory named ahead of it.
  case "${1%%/*}" in
    *[*?[]*)
      REFUSED="the first path component of \`${1}\` is a glob (\`*\`, \`?\` or a \`[\` class), so it matches names you did not list"
      ;;
  esac
}

refuse_unnamed_changes() { # reads GUARD_SCRUBBED; sets GUARD_REFUSAL
  local -a LINES
  local CMD_PLAIN WALK_PLAIN WALK_BEFORE_PWD PWD_NOTE CMD_SEGMENTS SEG
  local WORDS_REST WORD
  local STATE SKIP_VALUE SUB HAS_SELECTION REFUSED CLUSTER BEFORE_VALUE
  local NEXT_STEP HEREDOC_DROPPED MESSAGE_SCRUBBED
  CMD_PLAIN=${GUARD_SCRUBBED//[\"\'\`]/}
  CMD_PLAIN=${CMD_PLAIN//\\/}
  # Only a segment a literal `git` opens can be refused, so a command whose text
  # holds no `git` leaves before the scrubs and the walk below. Nothing this
  # function does after the early-out below can refuse a command with no `git`
  # in its text. On `ls -la`, 5000 calls took 0.327 ms each with this case and
  # 0.378 ms each with both early-outs removed (macOS, 2026-09-09).
  case "$CMD_PLAIN" in
    *git*) ;;
    *) return 0 ;;
  esac
  # A refusal needs a segment whose token is `add`, `stage`, `commit` or `rm`,
  # and the heredoc drop below only removes whole lines, so a command whose text
  # holds none of those four names cannot reach one. `git status`, `git log` and
  # `git push` all leave here instead of walking, where `git diff --staged`
  # walks on because its flag carries `stage`. On `git status --short`, 5000
  # calls took 0.376 ms each with this case and 0.433 ms each with both
  # early-outs removed (macOS, 2026-09-09).
  #
  # `rm` is two letters and needs its own token boundaries, where the other three
  # do not. Over 3300 Bash commands taken from this project's session
  # transcripts, the three-name form admitted 429, a bare `*rm*` 580, and the
  # four patterns below 471; `format`, `permission`, `nrm` and `rmtree` are what
  # the extra 151 hold. The four spell "the token `rm`, at either end of the text
  # or with a separator on each side", and the class lists the characters a
  # separator is not. None of the 109 they drop holds a `git rm`, and this guard
  # decides each of those 109 the way it did before `rm` joined the case.
  case "$CMD_PLAIN" in
    *add* | *stage* | *commit*) ;;
    rm | rm[!A-Za-z0-9_.-]* | *[!A-Za-z0-9_.-]rm | *[!A-Za-z0-9_.-]rm[!A-Za-z0-9_.-]*) ;;
    *) return 0 ;;
  esac
  REFUSED=""
  # The words of a `-m` body are the message rather than operands, and Guard 1
  # leaves them in the text whenever the command's first word is neither `git`
  # nor `gh`, or a double-quoted body holds `$(`, `${` or a backtick. So
  # `git commit -m "docs: \`x\` **強調** を直した"` reached this walk with
  # `**強調**` reading as a first-component glob, and `cd sub && git commit -m
  # 'test: *.ts covered'` with `*.ts`. Both quote styles are scrubbed here with
  # no such condition, because a quoted body is one argument: a flag or pathspec
  # written outside it survives the scrub, so `-m "msg" .` and `-m "msg" -a` are
  # still refused. An ANSI-C-quoted body is not scrubbed, so `-m $'fix .'` is
  # refused. The `*-m*` test keeps the two scrubs off a command with no message
  # flag at all, `--message` included, because that spelling holds `-m`.
  WALK_PLAIN=$GUARD_SCRUBBED
  case "$GUARD_SCRUBBED" in
    *-m*)
      scrub_message_body "'" "$GIT_MESSAGE_FLAG" "$GUARD_SCRUBBED"
      scrub_message_body '"' "$GIT_MESSAGE_FLAG" "$MESSAGE_SCRUBBED"
      WALK_PLAIN=$MESSAGE_SCRUBBED
      ;;
  esac
  # The heredoc drop reads the raw text, ahead of the strips below, because the
  # backslash strip turns `echo a \<\< MARK` into a heredoc opener the shell
  # never saw: bash ran the next line of `echo a \<\< MARK` / `echo LINE2_RAN` /
  # `MARK` and printed `a << MARK` and `LINE2_RAN`, where the drop read `MARK` as
  # a delimiter and dropped both lines after it. Written as `echo "a << MARK"`
  # the two `<` are adjacent in the raw text as well, and the drop has no quote
  # state to tell that pair from an opener, so that spelling still drops them.
  drop_heredoc_body "$WALK_PLAIN"
  WALK_PLAIN=$HEREDOC_DROPPED
  # `$'x'` and `$"x"` hand git the same argument `'x'` does, and the quote strip
  # below leaves their `$` behind: `git rm -r $'.'` and `git rm -r .$''` each
  # listed all three tracked files of the scratch repository, where the walk saw
  # the operand `$.` and read it as a name (git 2.50.1, 2026-09-09). Dropping the
  # `$` puts them back on the plain spelling. This runs after the message scrub
  # above rather than before it, so an ANSI-C body stays outside what the scrub
  # takes and `git commit -m $'fix .'` is still refused.
  WALK_PLAIN=${WALK_PLAIN//\$\'/\'}
  WALK_PLAIN=${WALK_PLAIN//\$\"/\"}
  # `$PWD`, `${PWD}`, `$(pwd)` and a backticked `pwd` each expand to the working
  # directory. `git rm -r` given each of those four spellings, and given
  # `"$PWD"/.`, took all three tracked files of the scratch repository out of the
  # index and off disk, the set `git rm -r .` took, and `--cached` left all three
  # on disk for `"$PWD"` as it did for `.` (git 2.50.1, 2026-09-09). Rewriting
  # them to `.` puts them through the operand tests the plain spelling already
  # meets, and leaves `git add "$PWD/src/foo.ts"` naming its own file. This runs
  # ahead of the quote strip below so the backticked form is still a pair, and
  # ahead of the segment split so `$(pwd)`'s parentheses do not cut the segment
  # in two. The four patterns are literal, so a spelling one character off prints
  # the same directory and is left alone: this guard allowed `git rm -r` given
  # `${PWD:-.}`, `$(pwd -P)` and `$(pwd )`, and `-n` listed all three tracked
  # files of the scratch repository for each of them (2026-09-09).
  WALK_BEFORE_PWD=$WALK_PLAIN
  WALK_PLAIN=${WALK_PLAIN//\$\{PWD\}/.}
  WALK_PLAIN=${WALK_PLAIN//\$\(pwd\)/.}
  WALK_PLAIN=${WALK_PLAIN//\`pwd\`/.}
  WALK_PLAIN=${WALK_PLAIN//\$PWD/.}
  # The rewrite runs before `refuse_unnamed_operand` reads an operand, so
  # `git rm -r "$PWD"` is refused for a `.` the command does not contain. This
  # note joins that refusal wherever the rewrite changed the text, so the agent
  # reads a verdict on the token it wrote.
  PWD_NOTE=""
  if [ "$WALK_PLAIN" != "$WALK_BEFORE_PWD" ]; then
    PWD_NOTE=" \`\$PWD\` and \`pwd\` expand to the working directory, so this guard reads the operand you spelled with one of them as \`.\`."
  fi
  WALK_PLAIN=${WALK_PLAIN//[\"\'\`]/}
  # A backslash before a newline is a line continuation the shell splices away,
  # so `git \` on one line and `rm -r .` on the next is one command running
  # `git rm -r .`. The blanket backslash strip below leaves the newline behind,
  # and the segment split reads a newline as a separator, so the walk got `git`
  # and `rm -r .` as two segments and neither is a refusable shape. Joining the
  # pair into a space puts the subcommand back beside its `git`.
  WALK_PLAIN=${WALK_PLAIN//\\$NEWLINE/ }
  WALK_PLAIN=${WALK_PLAIN//\\/}
  CMD_SEGMENTS=${WALK_PLAIN//[;|\&()]/$NEWLINE}
  split_lines "$CMD_SEGMENTS"
  for SEG in "${LINES[@]}"; do
    STATE=prefix
    SKIP_VALUE=0
    SUB=""
    HAS_SELECTION=0
    WORDS_REST=$SEG
    while next_word; do
      if [ "$SKIP_VALUE" -eq 1 ]; then
        SKIP_VALUE=0
        continue
      fi
      case "$STATE" in
        prefix)
          case "$WORD" in
            git) STATE=subcommand ;;
            # An assignment, a redirect, a command that runs another command, or
            # such a command's own flag or count (`timeout 5`) stands between the
            # start of the segment and the git it runs.
            *=* | -* | *'>'* | *'<'* | [0-9]* | env | command | exec | eval | xargs | sh | bash | zsh | sudo | time | timeout | nohup) ;;
            *) break ;;
          esac
          ;;
        subcommand)
          case "$WORD" in
            # git's own options that take the following token as their value
            # (`git --help`, git 2.50.1). Skipping the value keeps a value that
            # happens to read like a subcommand from ending the walk.
            -C | -c | --git-dir | --work-tree | --namespace | --exec-path | --config-env)
              SKIP_VALUE=1
              ;;
            -*) ;;
            add | stage)
              SUB=$WORD
              STATE=operands
              ;;
            commit)
              SUB=$WORD
              STATE=commit
              ;;
            rm)
              SUB=$WORD
              STATE=remove
              ;;
            *) break ;;
          esac
          ;;
        operands)
          case "$WORD" in
            # `git add`'s long options that take the following token as their
            # value. Without this, `git add --pathspec-from-file paths.txt`
            # counted `paths.txt` as a named path and staged both files that file
            # listed, where `--pathspec-from-file=paths.txt` was refused;
            # `git add --chmod +x a.txt` took `+x` as the value and staged
            # `a.txt`. The `-f*` tail is there because git's parse-options takes
            # any unambiguous prefix, and `git add --pathspec-from-f paths.txt`
            # staged both files the same way (git 2.50.1, 2026-09-09).
            --pathspec-f* | --chmod)
              SKIP_VALUE=1
              ;;
            --all | --no-ignore-removal)
              REFUSED="\`${WORD}\` stages every change in the worktree instead of the paths you name"
              break
              ;;
            --update)
              REFUSED="\`--update\` stages every tracked change in the worktree instead of the paths you name"
              break
              ;;
            --patch | --interactive | --edit) HAS_SELECTION=1 ;;
            --*) ;;
            -*)
              # git clusters its short options (`git add -Av` staged the whole
              # scratch repository), so the letters are read one by one.
              case "${WORD#-}" in
                *A*)
                  REFUSED="the short option -A stages every change in the worktree instead of the paths you name"
                  break
                  ;;
                *u*)
                  REFUSED="the short option -u stages every tracked change in the worktree instead of the paths you name"
                  break
                  ;;
                *[pie]*) HAS_SELECTION=1 ;;
              esac
              ;;
            *)
              refuse_unnamed_operand "$WORD"
              if [ -n "$REFUSED" ]; then
                break
              fi
              HAS_SELECTION=1
              ;;
          esac
          ;;
        remove)
          case "$WORD" in
            # With a file holding `.`, both
            # `git rm -n -r --pathspec-from-file=ps.txt` and the prefix spelling
            # `git rm -n -r --pathspec-from-f ps.txt` listed all three tracked
            # files of the scratch repository (git 2.50.1, 2026-09-09). The `-f*`
            # tail matches both, because git's parse-options takes any
            # unambiguous prefix. It also matches `--pathspec-file-nul`, which
            # this refusal does not name: git answers that flag on its own with
            # `fatal: the option '--pathspec-file-nul' requires
            # '--pathspec-from-file'`, so the over-match costs no working command.
            # The `git add` and `git commit` walks carry the same pattern.
            --pathspec-f*)
              REFUSED="\`--pathspec-from-file\` takes its pathspec from a file the command text does not show"
              break
              ;;
            -*) ;;
            *)
              refuse_unnamed_operand "$WORD"
              if [ -n "$REFUSED" ]; then
                break
              fi
              HAS_SELECTION=1
              ;;
          esac
          ;;
        commit)
          case "$WORD" in
            # commit's long options that take the following token as their value.
            # Each was run as `git commit --dry-run <option> ZZZ` against a
            # staged change in a scratch repository (git 2.50.1, 2026-09-09) and
            # consumed ZZZ, where `--gpg-sign` and `--untracked-files` left it as
            # a pathspec because their own value has to be attached. Their short
            # spellings reach the cluster branch below, which reads the same
            # letters. Skipping the value keeps `--message 'fix .'` from reading
            # as a blanket pathspec.
            --message | --file | --reedit-message | --reuse-message | --template | --fixup | --squash | --author | --date | --cleanup | --trailer)
              SKIP_VALUE=1
              ;;
            # A file holding `.` reached the same sweep: `--pathspec-from-file`,
            # `--pathspec-from-file=`, and the prefix `--pathspec-from-f` that
            # git's parse-options also accepts, each reported both modified files
            # of the scratch repository as changes to be committed (git 2.50.1,
            # 2026-09-09). The `git add` walk refuses the option for the same
            # reason, by way of its `it names no path to stage` branch.
            --pathspec-f*)
              REFUSED="\`--pathspec-from-file\` takes its pathspec from a file the command text does not show"
              break
              ;;
            --all)
              REFUSED="\`--all\` commits every tracked change in the worktree instead of the ones you staged"
              break
              ;;
            --*) ;;
            -*)
              # git's parse-options takes the rest of a cluster as the value of
              # the first value-taking letter it meets, so `a` sweeps the worktree
              # only ahead of that letter: `git commit -ma` committed the staged
              # file under the subject `a` and `-mall` under `all`. Which letters
              # end the cluster is one set, and which of those then take the
              # following token is a smaller one: `-qm x` committed under `x`,
              # where `-uall` committed only the staged file (its `-u` is
              # `--untracked-files`) and `-u -a -m x` and `-S -a -m x` each
              # committed both modified files, because `-u` and `-S` take an
              # attached value or none (git 2.50.1, 2026-09-09).
              CLUSTER=${WORD#-}
              BEFORE_VALUE=${CLUSTER%%[mFcCtuS]*}
              case "$BEFORE_VALUE" in
                *a*)
                  REFUSED="the short option -a commits every tracked change in the worktree instead of the ones you staged"
                  break
                  ;;
              esac
              case "${CLUSTER#"$BEFORE_VALUE"}" in
                [mFcCt]) SKIP_VALUE=1 ;;
              esac
              ;;
            *)
              refuse_unnamed_operand "$WORD"
              if [ -n "$REFUSED" ]; then
                break
              fi
              ;;
          esac
          ;;
      esac
    done
    # An allowed `git add` either names a path or selects hunks, and an allowed
    # `git rm` names a path. This branch is what makes that the rule rather than a
    # list of bad flags, and it is the only refusal that
    # `--pathspec-from-file=paths.txt` and `git diff --name-only | xargs git add`
    # reach: both take their operands from somewhere the command text does not
    # show. A bare `git add` stages nothing by itself and prints
    # `hint: Maybe you wanted to say 'git add .'?`, and a bare `git rm` answers
    # `fatal: No pathspec was given. Which files should I remove?`
    # (git 2.50.1), so the refusal names the right form before git names the
    # wrong one or gives up. A bare `git commit` takes the set that was already
    # staged, so it stays out of the branch.
    if [ -z "$REFUSED" ] && [ "$HAS_SELECTION" -eq 0 ]; then
      case "$SUB" in
        add | stage) REFUSED="it names no path to stage" ;;
        rm) REFUSED="it names no path to remove" ;;
      esac
    fi
    # The loop body runs in this shell, so SUB survives the break and names the
    # subcommand the refusal came from.
    if [ -n "$REFUSED" ]; then
      break
    fi
  done
  if [ -n "$REFUSED" ]; then
    case "$SUB" in
      commit)
        NEXT_STEP="Stage the files this commit needs (\`git add src/foo.ts src/bar.ts\`, or \`git add -p\` for part of a file), then commit that staged set with \`git commit -m\`. \`git status --short\` lists what changed."
        ;;
      rm)
        NEXT_STEP="Name the paths to delete (\`git rm src/foo.ts src/bar.ts\`, or \`git rm -r src/old-dir\` for one directory). \`git ls-files\` lists the tracked paths."
        ;;
      *)
        NEXT_STEP="Name the files this commit needs (\`git add src/foo.ts src/bar.ts\`), and take part of a file with \`git add -p\`. \`git status --short\` lists what changed."
        ;;
    esac
    GUARD_REFUSAL="PreToolUse(Bash): this \`git ${SUB}\` is refused because ${REFUSED}.${PWD_NOTE} ${NEXT_STEP}"
  fi
}

# The three guards in the order the hook applies them, each leaving
# GUARD_REFUSAL alone where it allows the command. That name stays inside this
# file: the answer leaves as this function's own output, which one command
# substitution reads.
guard_refusal() { # $1 = the Bash tool's command text
  local GUARD_REFUSAL="" GUARD_SCRUBBED=""
  scrub_command_text "$1"
  refuse_protected_env_file
  if [ -z "$GUARD_REFUSAL" ]; then
    refuse_broad_find "$1"
  fi
  if [ -z "$GUARD_REFUSAL" ]; then
    refuse_unnamed_changes
  fi
  printf '%s' "$GUARD_REFUSAL"
}
