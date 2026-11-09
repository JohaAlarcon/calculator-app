# Immediate execution, no operator precedence

The Chain evaluates left to right: pressing an Operator immediately resolves the pending Operation and shows its Result, so `2 + 3 × 4 =` yields 20, not 14. This is how basic pocket calculators behave, it keeps the Chain to one left Operand plus one pending Operator (no stack), and the running Result on the display makes the behaviour visible to the user. This is deliberate — not a bug to be "fixed" with precedence.

## Considered Options

- **Standard precedence (iPhone/Google style, `2 + 3 × 4 = 14`)** — rejected: requires an operand/operator stack in the frontend and more edge cases, for a calculator that already shows intermediate Results.
