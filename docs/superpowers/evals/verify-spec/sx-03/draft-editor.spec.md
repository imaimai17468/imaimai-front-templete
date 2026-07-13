# Draft editor spec (eval fixture sx-03 — refinement gap)

Deliberate loophole: `session_timeout` from `editing` says nothing about the
dirty draft, so a perfectly legal trace silently discards edits — every
invariant and forbidden flow holds, only requirement R1 is defeated
(refinement gap between the action table and the stated requirement).
Decoy: the `autosave` self-loop looks like a livelock but is voluntary and
harmless.

## States
- viewing, editing, saving, conflict
  (viewing: read-only document; editing: draft open, possibly dirty;
  saving: persist in flight; conflict: remote version changed, both shown)

## Initial state
viewing

## Actions
| action          | from    | to      | requires            | ensures                        |
|-----------------|---------|---------|---------------------|--------------------------------|
| open_editor     | viewing | editing | true                | draft initialized from document |
| autosave        | editing | editing | draft is dirty      | draft persisted                 |
| save            | editing | saving  | true                | persist begins                  |
| save_ok         | saving  | viewing | true                | draft persisted                 |
| save_conflict   | saving  | conflict| remote changed      | both versions shown             |
| resolve         | conflict| editing | user chose a merge  | merged draft in editor          |
| session_timeout | editing | viewing | session expired     | user signed out                 |

## Invariants
- In `saving`, exactly one persist request is in flight.
- In `conflict`, both the local draft and the remote version are available.

## Forbidden flows
- Reaching `saving` without passing through `editing`.

## Requirements
- R1: Edits made in the editor are always either persisted or presented to
  the user for resolution — never silently discarded.
