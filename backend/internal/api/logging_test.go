package api_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/JohaAlarcon/calculator-app/backend/internal/api"
)

func TestEveryRequestIsLoggedAsStructuredJSON(t *testing.T) {
	var logs bytes.Buffer
	router := api.NewRouter(api.Config{Logger: slog.New(slog.NewJSONHandler(&logs, nil))})

	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/v1/calculate",
		strings.NewReader(`{"operation":"add","operands":[2,3]}`)))
	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/nope", nil))

	lines := strings.Split(strings.TrimSpace(logs.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("got %d log lines, want 2:\n%s", len(lines), logs.String())
	}
	wantStatus := []float64{200, 404}
	wantPath := []string{"/api/v1/calculate", "/nope"}
	wantMethod := []string{"POST", "GET"}
	for i, line := range lines {
		var entry map[string]any
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			t.Fatalf("log line %d is not JSON: %q", i, line)
		}
		if entry["msg"] != "request" || entry["method"] != wantMethod[i] || entry["path"] != wantPath[i] || entry["status"] != wantStatus[i] {
			t.Errorf("log line %d = %v, want msg=request method=%s path=%s status=%v", i, entry, wantMethod[i], wantPath[i], wantStatus[i])
		}
		if _, ok := entry["duration_ms"].(float64); !ok {
			t.Errorf("log line %d has no numeric duration_ms: %v", i, entry)
		}
	}
}
