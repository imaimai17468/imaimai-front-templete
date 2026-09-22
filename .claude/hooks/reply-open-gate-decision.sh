# shellcheck shell=bash
# What the reply-open gate judges: which line of the reply is its first visible
# one, whether that line opens with something the reader runs, whether the user
# turned .claude/rules/replies.md off for the session, and the refusal the gate
# prints. Reading the Stop payload, reading the transcript and choosing the exit
# status stay in reply-open-gate.sh, which sources this file, so the cases in
# reply-open-gate.test.ts reach every judgment below in one bash process,
# without a payload and without a transcript.
#
# reply-open-gate.sh sets these options too, and they are here as well so the
# test driver judges under the same ones. `-e` is absent from both: a predicate
# answering "no" returns 1, and its caller reads that answer.
set -uo pipefail

# One leading list marker, dropped before the line is judged, so a numbered
# procedure whose first step is the command reads as opening on that command.
REPLY_OPEN_LIST_MARKER='^([-*+]|[0-9]+[.)])[[:space:]]+'

# The two phrases .claude/rules/replies.md hands the user for turning itself off
# for the session. Both are matched anywhere in what the user typed, because
# they arrive as a message of their own or inside a longer one.
REPLY_OPEN_MODE_STOP_PHRASES="stop adhd mode
normal mode"

# Whether this Stop is already continuing from a stop hook, which is the state
# in which the gate judges nothing: Claude Code sets `stop_hook_active` while it
# continues from one, and Cursor counts its auto-followups in `loop_count`. A
# payload jq cannot read answers "yes" as well, because a gate with no reader
# for its own payload ends the turn rather than blocking on a reason nobody
# could act on.
already_continuing() { # $1 = the Stop payload; prints yes or no
  printf '%s' "$1" | jq -j \
    'if .stop_hook_active == true or (.loop_count // 0) > 0 then "yes" else "no" end' \
    2>/dev/null || printf 'yes'
}

# The reply's first line carrying anything other than whitespace. Prints
# nothing and returns 1 for a reply that is blank or whitespace alone, which is
# the one case where the gate has no line to judge.
first_visible_line() { # $1 = the whole reply
  local line
  while IFS= read -r line; do
    case $line in
      *[![:space:]]*)
        printf '%s' "$line"
        return 0
        ;;
    esac
  done <<<"$1"
  return 1
}

# A line with the whitespace at both of its ends removed.
trimmed() { # $1 = a line
  local line=$1
  line=${line#"${line%%[![:space:]]*}"}
  line=${line%"${line##*[![:space:]]}"}
  printf '%s' "$line"
}

# The line with its leading whitespace and one list marker removed, which is
# what the two shape predicates below read.
without_list_marker() { # $1 = a line
  local line
  line=$(trimmed "$1")
  if [[ $line =~ $REPLY_OPEN_LIST_MARKER ]]; then
    line=${line#"${BASH_REMATCH[0]}"}
  fi
  printf '%s' "$line"
}

# A backtick opens inline code and a fence alike, so one pattern covers a
# command, a snippet and a code block.
starts_with_code() { # $1 = a line the list marker is already off
  case $1 in
    '`'*) return 0 ;;
  esac
  return 1
}

# The characters a path is spelled out of. The run of them the line opens with
# is what the two tests below read, and a line opening on anything else has no
# path to judge. Splitting on the first space instead would hand those tests
# the whole of `結果は README.md に書いた` written without spaces, which holds a
# file name and opens on prose.
REPLY_OPEN_PATH_RUN='^[A-Za-z0-9._~@/+-]+'

# A path either carries a slash or ends in an extension that starts with a
# letter. The letter is what keeps `3.5 秒かかった` opening on a number and
# `Done. Here is what changed` opening on a word whose dot ended a sentence.
starts_with_path() { # $1 = a line the list marker is already off
  local first
  if [[ $1 =~ $REPLY_OPEN_PATH_RUN ]]; then
    first=${BASH_REMATCH[0]}
  else
    return 1
  fi
  case $first in
    */*) return 0 ;;
  esac
  local extension=${first##*.}
  if [ "$extension" = "$first" ]; then
    return 1
  fi
  case $extension in
    [A-Za-z]*) return 0 ;;
  esac
  return 1
}

opens_with_runnable_form() { # $1 = the reply's first visible line
  local line
  line=$(without_list_marker "$1")
  starts_with_code "$line" && return 0
  starts_with_path "$line" && return 0
  return 1
}

# Whether the user typed one of the phrases that stop the shape rule. A line
# has to be the phrase and nothing else, so that `ビルドを normal mode で確認して`
# and a session spent discussing this gate leave it judging. The comparison
# runs in a subshell so that `nocasematch`, which is what lets the user type the
# phrase in capitals, reaches it alone and neither the two regexes above nor a
# path the caller judges afterwards.
holds_mode_stop_phrase() { # $1 = everything the user typed this session
  (
    shopt -s nocasematch
    local line phrase
    while IFS= read -r line; do
      line=$(trimmed "$line")
      while IFS= read -r phrase; do
        if [[ $line == "$phrase" ]]; then
          exit 0
        fi
      done <<<"$REPLY_OPEN_MODE_STOP_PHRASES"
    done <<<"$1"
    exit 1
  )
}

# The refusal, which Claude Code shows to the agent as the reason its turn did
# not end. It carries the rejected line so the agent reads what the gate read,
# and it names the two turns the shape rule gives way for, because no gate can
# tell either of them from a turn that simply opened with prose. Naming them
# inside the instruction rather than after it is what keeps the cheapest way
# out of the block from being a path prepended to a reply that has nothing for
# the reader to open.
refusal_message() { # $1 = the first visible line the reply opened with
  printf '%s\n%s\n\n    %s\n\n%s\n' \
    "⛔ Stop block: this reply opens with prose." \
    ".claude/rules/replies.md puts what the reader runs on the first line: a command or a snippet in backticks, or a path. The line this reply opened with was:" \
    "$1" \
    "Send the reply again with that first line replaced by the command, the path or the snippet it is about, and the reasoning under it. Where the reader asked to be walked through something, or where this turn leaves them nothing to run or open, say that in the reply and send it as it stands: this gate judges a turn once, so the next reply ends the turn whatever it opens with."
}
