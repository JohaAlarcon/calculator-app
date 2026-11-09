package main

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"reflect"
	"strings"
	"syscall"
	"testing"
	"time"
)

const testTimeout = 5 * time.Second

var discardLogger = slog.New(slog.NewTextHandler(io.Discard, nil))

// receive waits for one value from ch, failing the test (instead of hanging) after testTimeout.
func receive[T any](t *testing.T, ch <-chan T, what string) T {
	t.Helper()
	select {
	case v := <-ch:
		return v
	case <-time.After(testTimeout):
		t.Fatalf("timed out waiting for %s", what)
		var zero T
		return zero
	}
}

// startServer runs the service on a free local port; it is always stopped when the test ends.
func startServer(t *testing.T) (baseURL string, stop context.CancelFunc, done <-chan error) {
	t.Helper()
	ctx, stop := context.WithCancel(context.Background())
	t.Cleanup(stop)
	addrs := make(chan net.Addr, 1)
	errs := make(chan error, 1)
	cfg := serverConfig{Addr: "127.0.0.1:0", AllowedOrigins: []string{"http://localhost:3000"}}
	go func() { errs <- run(ctx, cfg, discardLogger, func(a net.Addr) { addrs <- a }) }()
	select {
	case a := <-addrs:
		return "http://" + a.String(), stop, errs
	case err := <-errs:
		t.Fatalf("server did not start: %v", err)
	case <-time.After(testTimeout):
		t.Fatal("server did not start in time")
	}
	return "", stop, errs
}

func TestServerServesUntilItsContextIsCancelled(t *testing.T) {
	baseURL, stop, done := startServer(t)

	resp, err := http.Get(baseURL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /healthz = %d, want 200", resp.StatusCode)
	}

	stop()
	if err := receive(t, done, "run to return"); err != nil {
		t.Fatalf("run returned %v, want nil after a clean shutdown", err)
	}
}

func TestShutdownLetsAnInFlightRequestFinish(t *testing.T) {
	baseURL, stop, done := startServer(t)

	// Stream the body in two parts; shutdown starts after the first part has been sent,
	// so the request is still in flight while the server is draining.
	body, writer := io.Pipe()
	firstPartSent := make(chan struct{})
	go func() {
		_, _ = writer.Write([]byte(`{"operation":"add",`))
		close(firstPartSent)
		time.Sleep(200 * time.Millisecond)
		_, _ = writer.Write([]byte(`"operands":[2,3]}`))
		writer.Close()
	}()
	type outcome struct {
		status int
		result float64
		err    error
	}
	responses := make(chan outcome, 1)
	go func() {
		resp, err := http.Post(baseURL+"/api/v1/calculate", "application/json", body)
		if err != nil {
			responses <- outcome{err: err}
			return
		}
		defer resp.Body.Close()
		var got struct {
			Result float64 `json:"result"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&got)
		responses <- outcome{status: resp.StatusCode, result: got.Result}
	}()

	receive(t, firstPartSent, "the request to start uploading")
	stop()

	got := receive(t, responses, "the in-flight response")
	if got.err != nil || got.status != http.StatusOK || got.result != 5 {
		t.Fatalf("in-flight request = %+v, want 200 with result 5", got)
	}
	if err := receive(t, done, "run to return"); err != nil {
		t.Fatalf("run returned %v, want nil", err)
	}
}

func TestRunReportsAnAddressItCannotListenOn(t *testing.T) {
	err := run(context.Background(), serverConfig{Addr: "not-a-host-or-port"}, discardLogger, nil)
	if err == nil || !strings.Contains(err.Error(), "listen") {
		t.Fatalf("run = %v, want a listen error", err)
	}
}

func TestConfigFromEnvironment(t *testing.T) {
	tests := []struct {
		name string
		env  map[string]string
		want serverConfig
	}{
		{"defaults", map[string]string{}, serverConfig{Addr: ":8080", AllowedOrigins: []string{"http://localhost:3000"}}},
		{"overrides", map[string]string{"PORT": "9000", "ALLOWED_ORIGINS": "https://a.example, https://b.example"},
			serverConfig{Addr: ":9000", AllowedOrigins: []string{"https://a.example", "https://b.example"}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := configFromEnv(func(key string) string { return tt.env[key] })
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("configFromEnv = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestSIGTERMShutsTheServerDownGracefully(t *testing.T) {
	listening := make(chan net.Addr, 1)
	done := make(chan error, 1)
	go func() {
		done <- runUntilSignalled(serverConfig{Addr: "127.0.0.1:0"}, discardLogger, func(a net.Addr) { listening <- a })
	}()
	var addr net.Addr
	select {
	case addr = <-listening: // the signal handler is registered by now
	case err := <-done:
		t.Fatalf("server did not start: %v", err)
	case <-time.After(testTimeout):
		t.Fatal("server did not start in time")
	}

	// The signal goes to this test process; the server's handler catches it instead of the default exit.
	if err := syscall.Kill(syscall.Getpid(), syscall.SIGTERM); err != nil {
		t.Fatal(err)
	}

	if err := receive(t, done, "the server to stop after SIGTERM"); err != nil {
		t.Fatalf("runUntilSignalled returned %v, want nil after SIGTERM", err)
	}
	if resp, err := http.Get("http://" + addr.String() + "/healthz"); err == nil {
		resp.Body.Close()
		t.Error("server still answering after shutdown")
	}
}
