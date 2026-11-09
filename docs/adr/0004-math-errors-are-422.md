# Math Errors are HTTP 422 with specific codes, separate from 400

The API distinguishes an Invalid Request (HTTP 400: malformed JSON, unknown Operator, wrong Operand count) from a Math Error (HTTP 422: a well-formed Operation with no finite real Result). Math Errors carry one of three stable codes — `DIVISION_BY_ZERO`, `INVALID_OPERAND`, `OVERFLOW` — and the service never returns NaN or Infinity (JSON cannot encode them). The split lets clients tell "you called me wrong" from "the maths has no answer", and the codes are part of the public contract, so they are recorded here.

## Considered Options

- **Single generic `MATH_ERROR` code** — rejected: clients would have to parse messages to react differently.
- **Return Infinity as a Result** — rejected: needs a non-standard JSON encoding and pushes the edge case onto every client.

## Error codes (public contract)

Every error body is `{"error":{"code","message"}}`. Messages are for people and may change; codes may not.

| HTTP | Code | When |
|---|---|---|
| 422 | `DIVISION_BY_ZERO` | Math Error: the Operation divides by zero |
| 422 | `INVALID_OPERAND` | Math Error: an Operand is outside the Operator's domain (Result not a real number) |
| 422 | `OVERFLOW` | Math Error: the Result is too large to represent |
| 400 | `INVALID_JSON` | Invalid Request: unreadable body — malformed JSON, unknown fields, non-numeric Operands, trailing data, or over 1 KB |
| 400 | `UNKNOWN_OPERATION` | Invalid Request: unknown Operator (the name follows the request's `operation` field) |
| 400 | `INVALID_OPERAND_COUNT` | Invalid Request: wrong number of Operands for the Operator |
| 404 | `NOT_FOUND` | No such endpoint |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP method; the `Allow` header names the right one |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |
