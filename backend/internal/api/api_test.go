package api_test

import (
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

func TestCalculateAddOperation(t *testing.T) {
	router := newTestRouter()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate",
		strings.NewReader(`{"operation":"add","operands":[2,3]}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

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
	if got.Operation != "add" || len(got.Operands) != 2 || got.Operands[0] != 2 || got.Operands[1] != 3 || got.Result != 5 {
		t.Errorf("body = %+v, want {add [2 3] 5}", got)
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
