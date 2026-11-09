# Percentage key follows the phone-calculator convention

The `%` key is context-dependent in the UI: with `+` or `−` pending it means "b percent of a" (`50 + 10 % =` → 55), while with `×`, `÷` or nothing pending it simply divides by 100 (`50 × 10 % =` → 5, `10 %` → 0.1). This matches what iPhone and Google calculators do and what users mean by "add 10%". The backend keeps a single, context-free `percentage(a, b) = a% of b` Operator; the frontend picks the Operands (`percentage(10, 50)` or `percentage(10, 1)`), keeping the context-dependence where the Chain lives (see ADR-0001).

## Considered Options

- **Always "% of left Operand"** — rejected: `50 × 10 %` would yield 250.
- **Always divide by 100** — rejected: `50 + 10 %` would yield 50.1.
