// Package api is the HTTP adapter over the calculator domain.
package api

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/JohaAlarcon/calculator-app/backend/internal/calculator"
)

type calculateRequest struct {
	Operation string    `json:"operation"`
	Operands  []float64 `json:"operands"`
}

type calculateResponse struct {
	calculateRequest
	Result float64 `json:"result"`
}

// NewRouter returns the service's HTTP handler: all routes, wrapped in Middleware.
func NewRouter(cfg Config) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/calculate", handleCalculate)
	return ServiceMiddleware(cfg)(mux)
}

func handleCalculate(w http.ResponseWriter, r *http.Request) {
	var req calculateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	result, err := calculator.Evaluate(req.Operation, req.Operands)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, calculateResponse{calculateRequest: req, Result: result})
}

// writeJSON encodes before writing the status, so an unencodable body
// (e.g. a non-finite float) becomes a 500 instead of a 200 with an empty body.
func writeJSON(w http.ResponseWriter, status int, body any) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		slog.Error("encode response", "error", err)
		writeInternalError(w) // re-enters writeJSON with a body that always encodes
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(buf.Bytes())
}

// errorCode is a stable, machine-readable error identifier; part of the public API contract (ADR-0004).
type errorCode string

const codeInternalError errorCode = "INTERNAL_ERROR"

// errorResponse is the JSON error shape from spec #1: {"error":{"code","message"}}.
// handleCalculate's validation errors still use plain text until the Math Errors ticket (#6).
type errorResponse struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    errorCode `json:"code"`
	Message string    `json:"message"`
}

func writeError(w http.ResponseWriter, status int, code errorCode, message string) {
	writeJSON(w, status, errorResponse{Error: errorBody{Code: code, Message: message}})
}

func writeInternalError(w http.ResponseWriter) {
	writeError(w, http.StatusInternalServerError, codeInternalError, "Internal server error")
}
