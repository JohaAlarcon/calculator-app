package api

import (
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"
)

// DefaultAllowedOrigin is the UI's origin when ALLOWED_ORIGINS is not set.
const DefaultAllowedOrigin = "http://localhost:3000"

// Config holds the HTTP layer's settings.
type Config struct {
	// AllowedOrigins are the exact browser origins allowed to call the service
	// directly (ADR-0005). "*" is never treated as a wildcard.
	AllowedOrigins []string
	// Logger receives one structured entry per request; nil means slog.Default().
	Logger *slog.Logger
}

// ParseAllowedOrigins turns a comma-separated ALLOWED_ORIGINS value into a list,
// trimming blanks; an empty value yields DefaultAllowedOrigin.
func ParseAllowedOrigins(raw string) []string {
	var origins []string
	for _, origin := range strings.Split(raw, ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			origins = append(origins, origin)
		}
	}
	if len(origins) == 0 {
		return []string{DefaultAllowedOrigin}
	}
	return origins
}

// ServiceMiddleware wraps a handler with the service's cross-cutting behaviour:
// request logging, panic recovery and CORS (outermost first).
func ServiceMiddleware(cfg Config) func(http.Handler) http.Handler {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return func(next http.Handler) http.Handler {
		return logRequests(logger, recoverPanics(logger, cors(cfg.AllowedOrigins, next)))
	}
}

// cors answers preflight requests and adds CORS headers for allowed origins only.
func cors(allowedOrigins []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := origin != "" && slices.Contains(allowedOrigins, origin)
		if origin != "" {
			w.Header().Add("Vary", "Origin")
		}
		if allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}

		isPreflight := r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != ""
		if isPreflight {
			if !allowed {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			// GET is a CORS-safelisted method and never needs a preflight, so only POST is listed.
			w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// recoverPanics turns a panicking handler into a 500 JSON error and keeps the service up.
// The panic value is logged, never sent to the client. If the handler had already started
// the response, it is too late for a clean error, so the connection is aborted instead.
func recoverPanics(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		defer func() {
			v := recover()
			if v == nil {
				return
			}
			if v == http.ErrAbortHandler {
				panic(v)
			}
			logger.Error("panic serving request", "method", r.Method, "path", r.URL.Path, "panic", v)
			if rec.wroteHeader {
				panic(http.ErrAbortHandler)
			}
			writeInternalError(w)
		}()
		next.ServeHTTP(rec, r)
	})
}

// logRequests writes one structured log entry per request once it completes.
func logRequests(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration_ms", float64(time.Since(start).Microseconds())/1000,
		)
	})
}

// statusRecorder remembers the status code a handler wrote and whether it started the response.
type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (r *statusRecorder) WriteHeader(status int) {
	if !r.wroteHeader {
		r.status = status
		r.wroteHeader = true
	}
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	r.wroteHeader = true
	return r.ResponseWriter.Write(b)
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}
