// Command server runs the calculator HTTP service.
package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/JohaAlarcon/calculator-app/backend/internal/api"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           api.NewRouter(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("calculator service listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}
