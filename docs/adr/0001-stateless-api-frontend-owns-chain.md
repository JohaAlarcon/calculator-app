# Stateless API; the frontend owns the Chain

The calculator behaves like a pocket calculator (chained binary operations), so something must remember the pending operator and left operand between key presses. We decided the React frontend owns the entire Chain and the Go service stays stateless: each request carries one self-contained Operation (operator + operands) and returns its Result. This keeps the backend free of sessions and storage, trivially testable and horizontally scalable; the accepted cost is that an in-progress Chain is lost on page refresh, as on a physical calculator.

## Considered Options

- **Backend sessions** (`/sessions/{id}/keys`) — rejected: adds storage, expiry and concurrency concerns for no user-visible benefit.
- **Persist the Chain in browser storage** — rejected for now: easy to add later without changing the API.
