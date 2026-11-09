package api_test

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/JohaAlarcon/calculator-app/backend/internal/api"
	"github.com/JohaAlarcon/calculator-app/backend/internal/calculator"
)

func TestCalculateEvaluatesEachBasicOperator(t *testing.T) {
	tests := []struct {
		name      string
		operation string
		operands  []float64
		result    float64
	}{
		{"add", "add", []float64{2, 3}, 5},
		{"add decimals and negatives", "add", []float64{-1.5, 0.25}, -1.25},
		{"subtract", "subtract", []float64{10, 4}, 6},
		{"subtract below zero", "subtract", []float64{3, 5}, -2},
		{"multiply", "multiply", []float64{3, 4}, 12},
		{"multiply negative decimal", "multiply", []float64{-2.5, 4}, -10},
		{"divide", "divide", []float64{12, 4}, 3},
		{"divide to a fraction", "divide", []float64{1, 4}, 0.25},
		{"divide by a negative", "divide", []float64{7, -2}, -3.5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, err := json.Marshal(map[string]any{"operation": tt.operation, "operands": tt.operands})
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()

			newTestRouter().ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}
			var got struct {
				Operation string    `json:"operation"`
				Operands  []float64 `json:"operands"`
				Result    float64   `json:"result"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatalf("invalid JSON body %q: %v", rec.Body, err)
			}
			if got.Operation != tt.operation || !slices.Equal(got.Operands, tt.operands) || got.Result != tt.result {
				t.Errorf("body = %+v, want {%s %v %v}", got, tt.operation, tt.operands, tt.result)
			}
		})
	}
}

func TestListOperatorsPublishesTheOperatorRegistry(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestRouter().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/operations", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	var got struct {
		Operators []calculator.OperatorInfo `json:"operations"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("invalid JSON body %q: %v", rec.Body, err)
	}
	if !slices.Contains(got.Operators, calculator.OperatorInfo{Name: "add", Arity: 2}) {
		t.Errorf("operators = %+v, want it to include {add 2}", got.Operators)
	}
	if want := calculator.Operators(); !reflect.DeepEqual(got.Operators, want) {
		t.Errorf("operators = %+v, want exactly the registry's %+v", got.Operators, want)
	}
}

func TestHealthzReportsOK(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestRouter().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	if body := strings.TrimSpace(rec.Body.String()); body != `{"status":"ok"}` {
		t.Errorf("body = %s, want {\"status\":\"ok\"}", body)
	}
}

// newTestRouter builds the full router, middleware included, with request logs discarded.
func newTestRouter() http.Handler {
	return api.NewRouter(api.Config{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
}
