package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/JohaAlarcon/calculator-app/backend/internal/api"
)

func TestCalculateAddOperation(t *testing.T) {
	router := api.NewRouter()
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

func TestListOperationsReturnsEveryOperatorWithArity(t *testing.T) {
	rec := httptest.NewRecorder()
	api.NewRouter().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/operations", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	var got struct {
		Operations []struct {
			Name  string `json:"name"`
			Arity int    `json:"arity"`
		} `json:"operations"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("invalid JSON body %q: %v", rec.Body, err)
	}
	foundAdd := false
	for i, operator := range got.Operations {
		if operator.Name == "add" {
			foundAdd = operator.Arity == 2
		}
		if i > 0 && got.Operations[i-1].Name >= operator.Name {
			t.Errorf("operations not sorted by name: %+v", got.Operations)
		}
	}
	if !foundAdd {
		t.Errorf("operations = %+v, want it to include {add 2}", got.Operations)
	}
}

func TestHealthzReportsOK(t *testing.T) {
	rec := httptest.NewRecorder()
	api.NewRouter().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if body := strings.TrimSpace(rec.Body.String()); body != `{"status":"ok"}` {
		t.Errorf("body = %s, want {\"status\":\"ok\"}", body)
	}
}
