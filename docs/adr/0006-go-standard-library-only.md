# Go backend uses the standard library only

The backend is built on `net/http` (Go 1.22+ method/path patterns), `encoding/json` and `log/slog`, with hand-written middleware for CORS, request logging, panic recovery and body-size limits. With three routes, a framework would add dependencies and its own abstractions without removing meaningful code; zero third-party modules also means no supply-chain surface and a minimal container image.

## Considered Options

- **Chi** — closest alternative (stdlib-compatible); would be the first pick if routing grows beyond a handful of endpoints.
- **Gin / Echo** — rejected: custom context types and heavier footprint than this service needs.
