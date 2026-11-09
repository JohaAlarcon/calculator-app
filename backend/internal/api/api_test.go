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
	router := api.NewRouter(api.Config{})
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
