// Package api is the HTTP adapter over the calculator domain.
package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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

// NewRouter returns the service's HTTP handler: all routes, wrapped in ServiceMiddleware.
func NewRouter(cfg Config) http.Handler {
	mux := http.NewServeMux()
	route(mux, http.MethodPost, "/api/v1/calculate", handleCalculate)
	route(mux, http.MethodGet, "/api/v1/operations", handleListOperators)
	route(mux, http.MethodGet, "/healthz", handleHealthz)
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, codeNotFound, "No such endpoint")
	})
	return ServiceMiddleware(cfg)(mux)
}

// route registers a handler for one method on a path, and a JSON 405 (with an
// Allow header) for every other method on that path — the standard library's
// own 405 and 404 replies are plain text, but every error body must be JSON.
func route(mux *http.ServeMux, method, path string, handler http.HandlerFunc) {
	mux.HandleFunc(method+" "+path, handler)
	mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Allow", method)
		writeError(w, http.StatusMethodNotAllowed, codeMethodNotAllowed,
			fmt.Sprintf("Method %s is not allowed on %s; use %s", r.Method, path, method))
	})
}

// maxRequestBodyBytes bounds the calculate request body (1 KB).
const maxRequestBodyBytes = 1024

func handleCalculate(w http.ResponseWriter, r *http.Request) {
	req, err := decodeCalculateRequest(w, r)
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidJSON, err.Error())
		return
	}
	result, err := calculator.Evaluate(req.Operation, req.Operands)
	if err != nil {
		writeOperationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, calculateResponse{calculateRequest: req, Result: result})
}

// decodeCalculateRequest reads exactly one JSON object with only the known fields,
// within the body-size limit. Its errors are user-facing messages.
func decodeCalculateRequest(w http.ResponseWriter, r *http.Request) (calculateRequest, error) {
	var req calculateRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRequestBodyBytes))
	dec.DisallowUnknownFields()
	err := dec.Decode(&req)
	if err == nil {
		// Exactly one object: the next read must hit the end of the body.
		switch next := dec.Decode(&struct{}{}); {
		case next == nil:
			err = errors.New("trailing data after the JSON object")
		case next != io.EOF:
			err = next // malformed trailing data, or the body-size limit
		}
	}
	if err == nil {
		return req, nil
	}
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return req, fmt.Errorf("Request body must not exceed %d KB", maxRequestBodyBytes/1024)
	}
	return req, errors.New(`Request body must be one JSON object like {"operation":"add","operands":[2,3]}`)
}

// operatorsResponse is the body of GET /api/v1/operations; the path and the
// "operations" key are fixed by the API contract (spec #1).
type operatorsResponse struct {
	Operators []calculator.OperatorInfo `json:"operations"`
}

func handleListOperators(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, operatorsResponse{Operators: calculator.Operators()})
}

func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
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

const (
	codeInternalError    errorCode = "INTERNAL_ERROR"
	codeNotFound         errorCode = "NOT_FOUND"
	codeMethodNotAllowed errorCode = "METHOD_NOT_ALLOWED"

	// Invalid Requests (HTTP 400).
	codeInvalidJSON         errorCode = "INVALID_JSON"
	codeUnknownOperation    errorCode = "UNKNOWN_OPERATION"
	codeInvalidOperandCount errorCode = "INVALID_OPERAND_COUNT"

	// Math Errors (HTTP 422).
	codeDivisionByZero errorCode = "DIVISION_BY_ZERO"
	codeInvalidOperand errorCode = "INVALID_OPERAND"
	codeOverflow       errorCode = "OVERFLOW"
)

// errorResponse is the JSON shape of every error (spec #1): {"error":{"code","message"}}.
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

// mathErrors maps each domain Math Error to its public code and message (ADR-0004).
var mathErrors = []struct {
	err     error
	code    errorCode
	message string
}{
	{calculator.ErrDivisionByZero, codeDivisionByZero, "Cannot divide by zero"},
	{calculator.ErrInvalidOperand, codeInvalidOperand, "Result is not a real number"},
	{calculator.ErrOverflow, codeOverflow, "Result is too large"},
}

// writeOperationError answers a failed Evaluate: an Invalid Request is 400,
// a Math Error is 422 (ADR-0004).
func writeOperationError(w http.ResponseWriter, err error) {
	var unknown *calculator.UnknownOperatorError
	if errors.As(err, &unknown) {
		writeError(w, http.StatusBadRequest, codeUnknownOperation, fmt.Sprintf("Unknown operator %q", unknown.Operator))
		return
	}
	var count *calculator.OperandCountError
	if errors.As(err, &count) {
		writeError(w, http.StatusBadRequest, codeInvalidOperandCount,
			fmt.Sprintf("Operator %q takes %d operands, got %d", count.Operator, count.Want, count.Got))
		return
	}
	for _, m := range mathErrors {
		if errors.Is(err, m.err) {
			writeError(w, http.StatusUnprocessableEntity, m.code, m.message)
			return
		}
	}
	slog.Error("unclassified Operation error", "error", err)
	writeInternalError(w)
}
