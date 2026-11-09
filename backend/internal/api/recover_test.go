package api_test

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/JohaAlarcon/calculator-app/backend/internal/api"
)

func TestPanicBecomesJSON500AndServiceKeepsServing(t *testing.T) {
	var logs bytes.Buffer
	handler := api.ServiceMiddleware(api.Config{Logger: slog.New(slog.NewJSONHandler(&logs, nil))})(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/boom" {
				panic("something went badly wrong")
			}
			w.WriteHeader(http.StatusOK)
		}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/boom", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body is not JSON: %q", rec.Body)
	}
	if body.Error.Code != "INTERNAL_ERROR" || body.Error.Message == "" {
		t.Errorf("error = %+v, want code INTERNAL_ERROR with a message", body.Error)
	}
	if strings.Contains(rec.Body.String(), "badly wrong") {
		t.Errorf("panic value leaked to the client: %s", rec.Body)
	}
	if !strings.Contains(logs.String(), `"status":500`) {
		t.Errorf("panicking request not logged with status 500:\n%s", logs.String())
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/fine", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("after a panic, status = %d, want 200", rec.Code)
	}
}

func TestPanicAfterResponseStartedAbortsInsteadOfAppendingJSON(t *testing.T) {
	handler := api.ServiceMiddleware(api.Config{Logger: slog.New(slog.NewJSONHandler(io.Discard, nil))})(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("partial"))
			panic("late failure")
		}))

	defer func() {
		if v := recover(); v != http.ErrAbortHandler {
			t.Errorf("recovered %v, want http.ErrAbortHandler so net/http aborts the connection", v)
		}
	}()
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
}
