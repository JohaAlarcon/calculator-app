# Calculator

A full-stack calculator: a **React + TypeScript** web app that behaves like a pocket/phone calculator, backed by a **stateless Go REST microservice** that performs every Operation.

- `+ − × ÷`, power `xʸ`, square root `√` and percentage `%` (phone-calculator convention)
- Left-to-right Chain with immediate execution, repeat `=`, decimal / sign / backspace keys
- Clear errors for maths with no answer (`÷ 0`, `√ −4`, overflow) and for an unreachable service
- Full keyboard control, screen-reader support, light/dark themes, works on a 375 px phone
- ≥ 90 % backend statement coverage (enforced in CI); HTML reports for both layers committed under [`coverage/`](coverage/), numbers in [Tests & coverage](#tests--coverage)

## Quick start

Requires [Docker](https://docs.docker.com/get-docker/) with Compose.

```bash
docker compose up -d --build
```

- UI: <http://localhost:3000>
- API: <http://localhost:8080> (also reachable from the UI at `/api`)

Stop it with `docker compose down`.

## Prerequisites

| Task | Needs |
|---|---|
| Run the stack | Docker + Docker Compose |
| Backend tests / coverage via `make` | Docker only — Go runs in a `golang:1.23-alpine` container |
| Frontend dev / tests | Node.js 22 + npm |
| Backend dev without Docker (optional) | Go 1.23 |

## Local development

**Backend** (port 8080):

```bash
docker compose up -d backend
```

or, with Go installed: `cd backend && go run ./cmd/server`.

**Frontend** (Vite dev server on <http://localhost:5173>, proxying `/api` to the backend on 8080):

```bash
cd frontend && npm ci && npm run dev
```

Point the proxy elsewhere with `API_PROXY_TARGET=http://host:port npm run dev`.

Useful frontend scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Make targets

| Target | What it does |
|---|---|
| `make test` | `go vet` + `go test` (in a Go container), then frontend `npm ci`, typecheck and tests |
| `make test-backend` / `make test-frontend` | One layer only |
| `make coverage` | Regenerates both HTML reports in `coverage/` |
| `make up` / `make down` / `make logs` | `docker compose up -d --build` / `down` / `logs -f` |

## Configuration

| Variable | Used by | Default | Meaning |
|---|---|---|---|
| `PORT` | backend | `8080` | Port the service listens on |
| `ALLOWED_ORIGINS` | backend | `http://localhost:3000` | Comma-separated browser origins allowed to call the API directly (CORS). Exact match only — `*` is never a wildcard |
| `UI_PORT` | compose | `3000` | Host port for the UI |
| `API_PORT` | compose | `8080` | Host port for the API |

Copy [`.env.example`](.env.example) to `.env` to override the Compose values.

## API

All responses are JSON. Every error has the shape `{"error":{"code","message"}}`: the `code` is stable (part of the contract), the `message` is for people.

### `POST /api/v1/calculate`

Evaluates one Operation. Operators and their Operand count: `add`, `subtract`, `multiply`, `divide`, `power`, `percentage` (2) and `sqrt` (1). `percentage(a, b)` is "a percent of b".

```bash
curl -X POST localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","operands":[2,3]}'
```

```json
{"operation":"add","operands":[2,3],"result":5}
```

### `GET /api/v1/operations`

Lists the supported Operators (the UI uses it to disable keys the service doesn't support).

```bash
curl localhost:8080/api/v1/operations
```

```json
{"operations":[{"name":"add","arity":2},{"name":"divide","arity":2},{"name":"multiply","arity":2},{"name":"percentage","arity":2},{"name":"power","arity":2},{"name":"sqrt","arity":1},{"name":"subtract","arity":2}]}
```

### `GET /healthz`

```bash
curl localhost:8080/healthz
```

```json
{"status":"ok"}
```

### Errors

Each command below is copy-pasteable; the response shown is what the service returns.

```bash
calc() { curl -s -X POST localhost:8080/api/v1/calculate -H 'Content-Type: application/json' -d "$1"; echo; }
```

**422: Math Error** (a well-formed Operation with no finite real Result):

```bash
calc '{"operation":"divide","operands":[5,0]}'
# {"error":{"code":"DIVISION_BY_ZERO","message":"Cannot divide by zero"}}
calc '{"operation":"power","operands":[0,-1]}'
# {"error":{"code":"DIVISION_BY_ZERO","message":"Cannot divide by zero"}}
calc '{"operation":"sqrt","operands":[-4]}'
# {"error":{"code":"INVALID_OPERAND","message":"Result is not a real number"}}
calc '{"operation":"power","operands":[-8,0.5]}'
# {"error":{"code":"INVALID_OPERAND","message":"Result is not a real number"}}
calc '{"operation":"power","operands":[10,400]}'
# {"error":{"code":"OVERFLOW","message":"Result is too large"}}
```

**400: Invalid Request:**

```bash
calc '{"operation":'                                       # malformed JSON
calc '{"operation":"add","operands":[1,2],"precision":2}'  # unknown field
calc '{"operation":"add","operands":["1",2]}'              # non-numeric Operand
calc '{"operation":"add","operands":[1,2]}{}'              # trailing data
# all four: {"error":{"code":"INVALID_JSON","message":"Request body must be one JSON object like {\"operation\":\"add\",\"operands\":[2,3]}"}}

printf '{"operation":"add","operands":[1,2]%2000s}' '' | \
  curl -s -X POST localhost:8080/api/v1/calculate --data-binary @-   # body over 1 KB
# {"error":{"code":"INVALID_JSON","message":"Request body must not exceed 1 KB"}}

calc '{"operation":"modulo","operands":[7,2]}'
# {"error":{"code":"UNKNOWN_OPERATION","message":"Unknown operator \"modulo\""}}
calc '{"operation":"add","operands":[1]}'
# {"error":{"code":"INVALID_OPERAND_COUNT","message":"Operator \"add\" takes 2 operands, got 1"}}
```

**404 / 405:**

```bash
curl -i localhost:8080/api/v1/calculate   # GET on a POST endpoint
```

```
HTTP/1.1 405 Method Not Allowed
Allow: POST
{"error":{"code":"METHOD_NOT_ALLOWED","message":"Method GET is not allowed on /api/v1/calculate; use POST"}}
```

```bash
curl localhost:8080/api/v1/nope
```

```json
{"error":{"code":"NOT_FOUND","message":"No such endpoint"}}
```

### CORS

```bash
curl -i -X OPTIONS localhost:8080/api/v1/calculate \
  -H 'Origin: http://localhost:3000' -H 'Access-Control-Request-Method: POST'
```

```
HTTP/1.1 204 No Content
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Max-Age: 600
```

A preflight from an origin not in `ALLOWED_ORIGINS` gets `403` and no `Access-Control-Allow-*` headers.

**500**: an unexpected server failure (for example a panic) returns `{"error":{"code":"INTERNAL_ERROR","message":"Internal server error"}}`; details are logged, never sent. The full code table is in [ADR-0004](docs/adr/0004-math-errors-are-422.md).

## Using the calculator

| Keys | Shows | Why |
|---|---|---|
| `2 + 3 × 4 =` | 20 | left to right, no precedence ([ADR-0003](docs/adr/0003-immediate-execution-no-precedence.md)) |
| `50 + 10 % =` · `50 × 10 % =` | 55 · 5 | phone-calculator percentage ([ADR-0002](docs/adr/0002-percentage-follows-phone-convention.md)) |
| `2 + 3 = = =` | 11 | repeated `=` re-applies the Last Operation |
| `5 + =` | 10 | a missing right Operand reuses the left one |
| `0.1 + 0.2 =` | 0.3 | Results shown with ≤ 12 significant digits; the Chain keeps full precision |
| `5 ÷ 0 =` | Error | the banner explains it; type a digit to continue, or `C` |

**Keyboard:**
- Numbers: `0`–`9` and `.`.
- Operators: `+ - * / ^ %`.
- Commands: `Enter` or `=` for equals, `Backspace`, and `Escape` to clear.
- Keys typed while a request is in flight are queued, not lost.

## Tests & coverage

| Layer | Statements | Branches | Functions | Report |
|---|---|---|---|---|
| Backend (Go, whole module incl. `cmd/server`) | **90.9 %** | — | — | [`coverage/backend.html`](coverage/backend.html) · [per function](coverage/backend.txt) |
| Frontend (Vitest + V8) | **99.58 %** | 99.10 % | 100 % | [`coverage/frontend/index.html`](coverage/frontend/index.html) |

Regenerate with `make coverage`; CI fails if backend coverage drops below 90 %. Open the HTML files locally in a browser (GitHub shows their source). The committed reports are a snapshot of this commit.

**What's tested, and where:** tests sit at a few public seams and check behaviour, not internals.

- **Backend HTTP:** the full router, middleware included, driven in-process with `httptest`. It covers every Operator and every error code, CORS, logging and panic recovery.
- **Backend process:** `run`/`runUntilSignalled` started on a free port. Tests cover serving, graceful shutdown with a request still in flight, and a real `SIGTERM`.
- **Frontend:** the whole `App` rendered with Testing Library, driven by key presses and the keyboard. The service is faked at the `fetch` boundary, with Results taken from a known-answer table so the fake never re-does the arithmetic.

The domain package (`internal/calculator`) has no test file of its own: every Operator and Math Error is exercised through the HTTP seam, and `-coverpkg` attributes that coverage to it.

**What isn't covered:**
- **Backend:** `main()`'s own few lines (`os.Exit` wiring), and two defensive fallbacks that no current Operator can reach (a non-encodable Result, an unclassified error).
- **Frontend:** layout and font sizing can't be measured in jsdom, so they were checked in a real browser at 1024 px and 375 px.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs both suites with coverage on every push and pull request.

## Design rationale

The vocabulary is defined in [`CONTEXT.md`](CONTEXT.md) (Operation, Operator, Operand, Result, Chain, Pending Operation, Last Operation, Math Error, Invalid Request) and used throughout the code. The decisions that shaped it are recorded as ADRs:

| ADR | Decision |
|---|---|
| [0001](docs/adr/0001-stateless-api-frontend-owns-chain.md) | Stateless API; the frontend owns the Chain |
| [0002](docs/adr/0002-percentage-follows-phone-convention.md) | `%` follows the phone-calculator convention; the service keeps one context-free `percentage` |
| [0003](docs/adr/0003-immediate-execution-no-precedence.md) | Immediate execution, no operator precedence (`2 + 3 × 4 = 20`) |
| [0004](docs/adr/0004-math-errors-are-422.md) | Math Errors are 422 with stable codes, separate from 400 Invalid Requests (full code table) |
| [0005](docs/adr/0005-same-origin-proxy-with-cors-allowlist.md) | The UI calls a same-origin `/api` proxy; direct clients get a CORS allowlist, never `*` |
| [0006](docs/adr/0006-go-standard-library-only.md) | Go standard library only — `net/http`, `log/slog`, hand-written middleware |

Other choices:
- **float64 with display rounding.** The service returns raw float64 values. The UI rounds only what it shows, to 12 significant digits, and caps typed Operands at 15, the most float64 represents exactly.
- **Operator registry.** In the Go domain, adding an Operator is one registry entry: `/operations` and validation follow automatically.
- **A failure never loses input.** The Chain before a failed Operation is kept. The keypad locks while a request is in flight, and a 10 s timeout ends hung requests. nginx resolves the backend per request, so the UI still loads when the API is down.
- **Accessibility.**
  - Unavailable keys use `aria-disabled`, not `disabled`, so they stay focusable and explain themselves.
  - Colours were measured against WCAG: key symbols are at least 5:1, and the focus ring at least 6.7:1 against the card.

## Project layout

```
backend/
  cmd/server/              process: config from env, graceful shutdown
  internal/calculator/     domain: Operator registry, Evaluate, Math Errors (no HTTP)
  internal/api/            HTTP: routes, JSON errors, CORS / logging / panic-recovery middleware
frontend/
  src/calculator/          Chain reducer, number formatting, service + keyboard hooks
  src/components/          Display, ErrorBanner, Keypad
  src/api/client.ts        typed fetch client (Result / rejected / unavailable)
  nginx.conf               serves the app, proxies /api to the backend
coverage/                  committed HTML coverage reports
docs/adr/                  architecture decision records
CONTEXT.md                 domain glossary
docker-compose.yml, Makefile, .github/workflows/ci.yml
```
