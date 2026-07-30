#!/usr/bin/env bash
# Sourced helper (not a hook): "does this Bash command land a git commit?"
#
# Two hooks need the same answer and must not disagree:
#   pre-bash-guard.sh          — refuses the command when the review gate is unstamped
#   post-bash-stamp-consume.sh — consumes the stamp once the reviewed batch has landed
#
# They used to carry two hand-written regexes with a comment telling the next
# editor to "keep the two patterns in step". That is an instruction, and this
# repository has concluded three times that instructions are not mechanisms
# (ADR-0001, ADR-0013, ADR-0019). They drifted, and the drift was a hole: the
# consume side required whitespace after `commit` while the gate accepted any
# `\bcommit\b`, so `git commit;true` was refused-until-stamped on the way in and
# then NOT recognised as a landed commit on the way out — leaving a live stamp to
# authorise the next, unreviewed change. One definition removes the possibility.
#
# WHY SEPARATORS BECOME NEWLINES. Both old patterns required the character before
# `git` to be start-of-string or one of `;&| `. A shell metacharacter sitting
# directly against the command word satisfies none of those, so these all escaped
# the gate completely — no stamp required, verified 2026-07-30:
#
#     (git commit -m x)        $(git commit -m x)        `git commit -m x`
#
# whereas `(cd sub && git commit)` was caught, because the space after `&&`
# happened to match. Translating every statement-boundary character to a newline
# and testing line by line removes that accident: `git` is always at the start of
# its own statement or preceded by whitespace.
#
# It also preserves the property the old `[^;&|]*` was there for — a separator
# must not be crossed. `git status; echo commit` becomes two lines and matches
# neither, so the gate does not fire on prose after a semicolon.
#
# The caller decides what to feed this. `pre-bash-guard.sh` passes the command
# with heredoc bodies intact (over-matching there only runs a check that then
# passes), which is why this helper does not strip them itself.

# True when the command contains a statement that runs `git … commit`.
#
# `commit` must be a whitespace-delimited word, so `git log --grep=commit` and
# `git checkout -b feature/commit-fix` are not commits — that precision is
# required on the consume side, where a false positive deletes a stamp the review
# had legitimately earned.
# Order matters, and each step below is here because a specific shape got past an
# earlier version of this function. All were reproduced under bash 3.2.57.
#
# 1. Backslash-newline is REMOVED, not replaced with a space. It is a line
#    continuation, and bash joins the halves with nothing between them, so
#    `git com\<newline>mit -m x` really runs `git commit`. An earlier version
#    substituted a space and split the keyword into `com` and `mit`, missing it
#    entirely — a bypass introduced by the very fix that added continuation
#    handling. The space before a `\` survives, so `git \<newline>commit` still
#    reads as two words.
# 2. Quotes are dropped, because bash removes them before dispatch:
#    `git 'commit' -m x` really commits. Cost, accepted knowingly: a git subcommand
#    whose quoted argument is literally `commit` — `git show 'commit'` for a ref of
#    that name — now reads as a commit. On the gate side that only re-runs a check
#    that passes; on the consume side it costs one unnecessary review. Both are
#    cheaper than a bypass.
# 3. A literal `${IFS}` becomes a space, because unquoted it performs real word
#    splitting: `git${IFS}commit` commits. Only the braced form is handled — bash
#    parses `$IFScommit` as a single (undefined) variable name, so that spelling
#    does not run a commit and needs no handling.
# 4. Separators become newlines, and only THEN is horizontal whitespace squeezed.
#    Squeezing `[:space:]` would fold those newlines back into spaces and rejoin the
#    statements just split, making `git status; echo commit` match.
command_lands_a_commit() { # $1 = the Bash command string
  local joined=${1//\\$'\n'/}
  joined=${joined//\$\{IFS\}/ }
  printf '%s' "$joined" \
    | tr -d "'\"" \
    | tr '();&|`{}<>\n' '\n' \
    | tr -s ' \t' ' ' \
    | grep -qE '(^| )git( [^ ]+)* commit( |$)'
}
