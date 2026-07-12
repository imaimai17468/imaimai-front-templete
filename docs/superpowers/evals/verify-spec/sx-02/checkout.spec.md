# Checkout flow spec (eval fixture sx-02 — liveness trap + decoy)

Deliberate loophole: `payment_failed` is a dead end (non-terminal state with
no outgoing action). Decoy: the browsing⇄cart cycle looks like a livelock but
always has an escape (`checkout`), so it must NOT be reported.

## States
- browsing, cart, checkout, payment_failed, done
  (browsing: catalog; cart: items held; checkout: paying; payment_failed:
  payment declined; done: order placed — terminal)

## Initial state
browsing

## Actions
| action      | from      | to             | requires          | ensures            |
|-------------|-----------|----------------|-------------------|--------------------|
| add_item    | browsing  | cart           | true              | item in cart       |
| keep_browsing | cart    | browsing       | true              | cart preserved     |
| checkout    | cart      | checkout       | cart not empty    | payment started    |
| pay_ok      | checkout  | done           | payment accepted  | order placed       |
| pay_fail    | checkout  | payment_failed | payment declined  | error shown        |

## Invariants
- An order is placed only after a successful payment.

## Forbidden flows
- Reaching done without passing through checkout.

## Requirements
- R1: A user whose payment fails can always try to pay again.
