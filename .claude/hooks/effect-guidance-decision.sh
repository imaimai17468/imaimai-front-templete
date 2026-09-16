# shellcheck shell=bash
# What the Effect guidance reminder says, and the three judgments behind it:
# which tools write a file, which paths hold Effect code, and which text counts
# as importing Effect. Reading the payload, finding the text an edit produces,
# suppressing the second reminder of a session and encoding the JSON stay in
# effect-guidance-reminder.sh, which sources this file, so
# effect-guidance-decision.test.ts reaches every branch below in one bash
# process without a payload or a marker file.
#
# effect-guidance-reminder.sh sets these options too, and they are here as well
# so the test driver judges under the same ones.
set -uo pipefail

# The tools that hand a file new text. A tool outside this list reaches no
# further, so Read, Bash and every MCP tool pass through untouched. MultiEdit
# is here because it writes a file the same way Edit does, and the entry reads
# its `edits` array for the text.
writes_a_file() { # $1 = tool_name
  case "$1" in
    Edit | MultiEdit | Write) return 0 ;;
    *) return 1 ;;
  esac
}

# Effect is imported from TypeScript only. A `.json`, `.css` or `.md` path
# carrying the word `effect` reaches no further.
holds_typescript_suffix() { # $1 = file path
  case "$1" in
    *.ts | *.tsx) return 0 ;;
    *) return 1 ;;
  esac
}

# An import of the library itself or of one of its subpaths, in either quote
# style. The name has to sit immediately after `from "`, which
# `oxlint-plugin-effect` does not, and it has to close right after `effect` or
# continue with `/`, which `./oxlint.effect.ts` does not.
imports_effect() { # $1 = text
  case "$1" in
    *'from "effect"'* | *"from 'effect'"*) return 0 ;;
    *'from "effect/'* | *"from 'effect/"*) return 0 ;;
    *) return 1 ;;
  esac
}

# The reminder, or nothing. It names the action to take rather than the rule it
# comes from, because a reader who has to go find AGENTS.md's Knowledge
# Currency section to learn what to do has already paid the cost the reminder
# exists to save.
guidance_reminder() { # $1 = tool_name, $2 = file path, $3 = the text the edit produces
  if ! writes_a_file "$1"; then
    return 0
  fi
  if ! holds_typescript_suffix "$2"; then
    return 0
  fi
  if ! imports_effect "$3"; then
    return 0
  fi
  printf '%s' 'This file imports Effect. Read node_modules/effect/AGENTS.md completely and follow the links it names before writing or changing Effect code here. That file is the pinned version'"'"'s own guidance, and AGENTS.md (Knowledge Currency) ranks it above your training data and above a web search. For an API or a concept it leaves out, search node_modules/effect/src, which is that version'"'"'s source.'
}
