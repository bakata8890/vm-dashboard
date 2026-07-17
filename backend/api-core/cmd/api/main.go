package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vm/api-core/internal/handler"
	"github.com/vm/api-core/internal/infrastructure/postgres"
	"github.com/vm/api-core/internal/service"
	"github.com/vm/api-core/internal/ws"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://vm_user:vm_pass@localhost:5433/vm_db?sslmode=disable"
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("conectar DB: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("ping DB: %v", err)
	}

	hub := ws.NewHub()
	go hub.Run()

	vmRepo := postgres.NewVMRepo(pool)
	vmSvc := service.NewVMService(vmRepo)
	vmH := handler.NewVMHandlerWithHub(vmSvc, hub)

	// En prod, Cloud Run valida el ID Token del BFF antes de que la request
	// llegue al container — INTERNAL_PROXY_SECRET no aplica.
	var internalSecret string
	if os.Getenv("APP_ENV") != "prod" {
		internalSecret = handler.GetEnvOrFatal("INTERNAL_PROXY_SECRET")
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Público — usado por docker-compose healthcheck y load balancers, sin auth
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Protegido — X-Internal-Secret (dev) o IAM token (prod)
	r.Group(func(r chi.Router) {
		r.Use(handler.HeaderAuthMiddleware(internalSecret))
		vmH.Routes(r)
		r.Get("/api/ws", ws.NewHandler(hub))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf("api-core escuchando en %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("servidor: %v", err)
	}
}
