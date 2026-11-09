# Go runs inside a container, so no local Go toolchain is needed.
GO_IMAGE := golang:1.23-alpine
GO := docker run --rm -v $(CURDIR)/backend:/app -v calc-gomod:/go/pkg/mod -v calc-gocache:/root/.cache/go-build -w /app $(GO_IMAGE) go

.PHONY: test test-backend test-frontend coverage coverage-backend coverage-frontend up down logs

test: test-backend test-frontend ## Run both test suites

test-backend:
	$(GO) vet ./...
	$(GO) test ./...

test-frontend:
	cd frontend && npm ci && npm run typecheck && npm test

coverage: coverage-backend coverage-frontend ## Generate coverage reports in ./coverage

coverage-backend: ## Whole-module statement coverage (incl. cmd/server) → coverage/backend.html + backend.txt
	mkdir -p coverage
	$(GO) test ./... -coverpkg=./... -coverprofile=coverage.out
	$(GO) tool cover -func=coverage.out > coverage/backend.txt
	$(GO) tool cover -html=coverage.out -o coverage.html
	mv backend/coverage.html coverage/backend.html
	rm -f backend/coverage.out
	tail -1 coverage/backend.txt

coverage-frontend: ## Vitest V8 coverage → coverage/frontend/index.html + coverage-summary.json
	cd frontend && npm run test:coverage

up: ## Build and start the stack: UI http://localhost:3000, API http://localhost:8080
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f
