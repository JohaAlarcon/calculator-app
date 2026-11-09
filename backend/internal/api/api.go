// Package api is the HTTP adapter over the calculator domain.
package api

import (
	"bytes"
	"encoding/json"
	"log"
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

// NewRouter returns the service's HTTP handler with all routes registered.
func NewRouter() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/calculate", handleCalculate)
	return mux
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
		log.Printf("encode response: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(buf.Bytes())
}
