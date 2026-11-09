// Command server runs the calculator HTTP service.
//
// Configuration (environment):
//
//	PORT             listen port (default 8080)
//	ALLOWED_ORIGINS  comma-separated browser origins allowed via CORS (default http://localhost:3000)
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/JohaAlarcon/calculator-app/backend/internal/api"
)

// shutdownTimeout bounds how long in-flight requests may take to finish on SIGINT/SIGTERM.
const shutdownTimeout = 10 * time.Second

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	if err := runUntilSignalled(configFromEnv(os.Getenv), logger, nil); err != nil {
		logger.Error("server stopped with error", "error", err)
		os.Exit(1)
	}
}

// runUntilSignalled runs the service until the process receives SIGINT or SIGTERM, then
// shuts down gracefully (see run).
func runUntilSignalled(cfg serverConfig, logger *slog.Logger, onListening func(net.Addr)) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return run(ctx, cfg, logger, onListening)
}

// serverConfig is everything the service reads from its environment.
type serverConfig struct {
	Addr           string
	AllowedOrigins []string
}

// configFromEnv reads PORT and ALLOWED_ORIGINS, applying their defaults.
func configFromEnv(getenv func(string) string) serverConfig {
	port := getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return serverConfig{Addr: ":" + port, AllowedOrigins: api.ParseAllowedOrigins(getenv("ALLOWED_ORIGINS"))}
}

// run serves the API on cfg.Addr until ctx is done, then shuts down gracefully, letting
// in-flight requests finish (up to shutdownTimeout). onListening, if set, receives the
// address actually listened on (useful with port 0).
func run(ctx context.Context, cfg serverConfig, logger *slog.Logger, onListening func(net.Addr)) error {
	listener, err := net.Listen("tcp", cfg.Addr)
	if err != nil {
		return fmt.Errorf("listen on %q: %w", cfg.Addr, err)
	}
	srv := &http.Server{
		Handler:           api.NewRouter(api.Config{AllowedOrigins: cfg.AllowedOrigins, Logger: logger}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}

	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(listener) }()
	logger.Info("calculator service listening", "addr", listener.Addr().String(), "allowed_origins", cfg.AllowedOrigins)
	if onListening != nil {
		onListening(listener.Addr())
	}

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}

	logger.Info("shutting down: draining in-flight requests", "timeout", shutdownTimeout.String())
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	logger.Info("shutdown complete")
	return nil
}
