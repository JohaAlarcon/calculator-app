package api_test

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/JohaAlarcon/calculator-app/backend/internal/api"
)

const allowedOrigin = "http://localhost:3000"

func corsRouter() http.Handler {
	return api.NewRouter(api.Config{AllowedOrigins: []string{allowedOrigin}})
}

func operationRequestFrom(origin string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate",
		strings.NewReader(`{"operation":"add","operands":[2,3]}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", origin)
	return req
}

func preflightFrom(origin string) *http.Request {
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/calculate", nil)
	req.Header.Set("Origin", origin)
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "content-type")
	return req
}

func TestCORSAllowsListedOrigin(t *testing.T) {
	rec := httptest.NewRecorder()
	corsRouter().ServeHTTP(rec, operationRequestFrom(allowedOrigin))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != allowedOrigin {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, allowedOrigin)
	}
	if got := rec.Header().Values("Vary"); !slices.Contains(got, "Origin") {
		t.Errorf("Vary = %q, want it to include Origin", got)
	}
}

func TestCORSRefusesUnlistedOrigin(t *testing.T) {
	rec := httptest.NewRecorder()
	corsRouter().ServeHTTP(rec, operationRequestFrom("https://evil.example"))

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want none", got)
	}
}

func TestCORSPreflightFromListedOrigin(t *testing.T) {
	rec := httptest.NewRecorder()
	corsRouter().ServeHTTP(rec, preflightFrom(allowedOrigin))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	want := map[string]string{
		"Access-Control-Allow-Origin":  allowedOrigin,
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
	}
	for header, value := range want {
		if got := rec.Header().Get(header); got != value {
			t.Errorf("%s = %q, want %q", header, got, value)
		}
	}
}

func TestCORSPreflightFromUnlistedOriginIsRefused(t *testing.T) {
	rec := httptest.NewRecorder()
	corsRouter().ServeHTTP(rec, preflightFrom("https://evil.example"))

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}

	for _, header := range []string{"Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers"} {
		if got := rec.Header().Get(header); got != "" {
			t.Errorf("%s = %q, want none", header, got)
		}
	}
}

func TestCORSNeverTreatsStarAsWildcard(t *testing.T) {
	router := api.NewRouter(api.Config{AllowedOrigins: []string{"*"}})
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, operationRequestFrom("https://evil.example"))

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want none", got)
	}
}

func TestParseAllowedOrigins(t *testing.T) {
	tests := []struct {
		raw  string
		want []string
	}{
		{"", []string{"http://localhost:3000"}},
		{"https://a.example", []string{"https://a.example"}},
		{" https://a.example , http://b.example:8000 ,", []string{"https://a.example", "http://b.example:8000"}},
	}
	for _, tt := range tests {
		if got := api.ParseAllowedOrigins(tt.raw); !reflect.DeepEqual(got, tt.want) {
			t.Errorf("ParseAllowedOrigins(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
}
