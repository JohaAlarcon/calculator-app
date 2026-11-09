# Math Errors are HTTP 422 with specific codes, separate from 400

The API distinguishes an Invalid Request (HTTP 400: malformed JSON, unknown Operator, wrong Operand count) from a Math Error (HTTP 422: a well-formed Operation with no finite real Result). Math Errors carry one of three stable codes — `DIVISION_BY_ZERO`, `INVALID_OPERAND`, `OVERFLOW` — and the service never returns NaN or Infinity (JSON cannot encode them). The split lets clients tell "you called me wrong" from "the maths has no answer", and the codes are part of the public contract, so they are recorded here.

## Considered Options

- **Single generic `MATH_ERROR` code** — rejected: clients would have to parse messages to react differently.
- **Return Infinity as a Result** — rejected: needs a non-standard JSON encoding and pushes the edge case onto every client.
