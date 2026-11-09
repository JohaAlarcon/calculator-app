package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type errorCase struct {
	name    string
	method  string
	path    string
	body    string
	status  int
	code    string
	message string // checked only when set
}

func runErrorCases(t *testing.T, cases []errorCase) {
	t.Helper()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			method := tc.method
			if method == "" {
				method = http.MethodPost
			}
			path := tc.path
			if path == "" {
				path = "/api/v1/calculate"
			}
			req := httptest.NewRequest(method, path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()

			newTestRouter().ServeHTTP(rec, req)

			if rec.Code != tc.status {
				t.Errorf("status = %d, want %d; body: %s", rec.Code, tc.status, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}
			var got struct {
				Error struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatalf("error body is not JSON: %q", rec.Body)
			}
			if got.Error.Code != tc.code {
				t.Errorf("code = %q, want %q", got.Error.Code, tc.code)
			}
			if got.Error.Message == "" {
				t.Errorf("error has no message")
			}
			if tc.message != "" && got.Error.Message != tc.message {
				t.Errorf("message = %q, want %q", got.Error.Message, tc.message)
			}
			if strings.Contains(rec.Body.String(), "NaN") || strings.Contains(rec.Body.String(), "Inf") {
				t.Errorf("body leaks a non-finite number: %s", rec.Body)
			}
		})
	}
}

func TestMathErrorsAre422WithStableCodes(t *testing.T) {
	runErrorCases(t, []errorCase{
		{name: "divide by zero", body: `{"operation":"divide","operands":[5,0]}`,
			status: 422, code: "DIVISION_BY_ZERO", message: "Cannot divide by zero"},
		{name: "zero divided by zero", body: `{"operation":"divide","operands":[0,0]}`,
			status: 422, code: "DIVISION_BY_ZERO", message: "Cannot divide by zero"},
		{name: "multiply overflows", body: `{"operation":"multiply","operands":[1e308,10]}`,
			status: 422, code: "OVERFLOW", message: "Result is too large"},
		{name: "add overflows", body: `{"operation":"add","operands":[1e308,1e308]}`,
			status: 422, code: "OVERFLOW", message: "Result is too large"},
		{name: "subtract overflows negatively", body: `{"operation":"subtract","operands":[-1e308,1e308]}`,
			status: 422, code: "OVERFLOW", message: "Result is too large"},
	})
}

func TestInvalidRequestsAre400WithStableCodes(t *testing.T) {
	oversized := `{"operation":"add","operands":[1,2]}` + strings.Repeat(" ", 1024)
	runErrorCases(t, []errorCase{
		{name: "malformed JSON", body: `{"operation":`, status: 400, code: "INVALID_JSON"},
		{name: "empty body", body: ``, status: 400, code: "INVALID_JSON"},
		{name: "unknown field", body: `{"operation":"add","operands":[1,2],"precision":2}`, status: 400, code: "INVALID_JSON"},
		{name: "non-numeric Operand", body: `{"operation":"add","operands":["1",2]}`, status: 400, code: "INVALID_JSON"},
		{name: "trailing data", body: `{"operation":"add","operands":[1,2]}{}`, status: 400, code: "INVALID_JSON"},
		{name: "body over 1 KB", body: oversized, status: 400, code: "INVALID_JSON",
			message: "Request body must not exceed 1 KB"},
		{name: "unknown Operator", body: `{"operation":"modulo","operands":[7,2]}`, status: 400, code: "UNKNOWN_OPERATION",
			message: `Unknown operator "modulo"`},
		{name: "missing Operator", body: `{"operands":[7,2]}`, status: 400, code: "UNKNOWN_OPERATION"},
		{name: "too few Operands", body: `{"operation":"add","operands":[1]}`, status: 400, code: "INVALID_OPERAND_COUNT",
			message: `Operator "add" takes 2 operands, got 1`},
		{name: "too many Operands", body: `{"operation":"divide","operands":[1,2,3]}`, status: 400, code: "INVALID_OPERAND_COUNT"},
		{name: "missing Operands", body: `{"operation":"add"}`, status: 400, code: "INVALID_OPERAND_COUNT"},
	})
}

func TestRoutingErrorsAreJSON(t *testing.T) {
	runErrorCases(t, []errorCase{
		{name: "GET on calculate", method: http.MethodGet, status: 405, code: "METHOD_NOT_ALLOWED"},
		{name: "PUT on calculate", method: http.MethodPut, body: `{}`, status: 405, code: "METHOD_NOT_ALLOWED"},
		{name: "POST on operations", path: "/api/v1/operations", status: 405, code: "METHOD_NOT_ALLOWED"},
		{name: "unknown path", method: http.MethodGet, path: "/api/v1/nope", status: 404, code: "NOT_FOUND"},
	})
}

func TestMethodNotAllowedListsTheAllowedMethod(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestRouter().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/calculate", nil))

	if got := rec.Header().Get("Allow"); got != "POST" {
		t.Errorf("Allow = %q, want POST", got)
	}
}
