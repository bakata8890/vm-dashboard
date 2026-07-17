package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vm/bff/internal/auth"
	"github.com/vm/bff/internal/handler"
	pgstore "github.com/vm/bff/internal/infrastructure/postgres"
	"github.com/vm/bff/internal/middleware"
)

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s no puede estar vacío", key)
	}
	return v
}

func main() {
	jwtSecret := mustEnv("JWT_SECRET")
	apiCoreURL := mustEnv("API_CORE_URL")
	internalSecret := os.Getenv("INTERNAL_PROXY_SECRET")
	if os.Getenv("APP_ENV") != "prod" && internalSecret == "" {
		log.Fatal("INTERNAL_PROXY_SECRET no puede estar vacío en APP_ENV!=prod")
	}

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

	jwtSvc := auth.NewJWTService(jwtSecret)
	userRepo := pgstore.NewUserRepo(pool)
	authH := handler.NewAuthHandler(userRepo, jwtSvc)
	vmProxy := handler.NewVMProxy(apiCoreURL, internalSecret)
	wsProxy := handler.NewWSProxy(apiCoreURL, internalSecret)

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)

	// Rutas públicas
	r.Post("/api/login", authH.Login)
	r.Post("/api/logout", authH.Logout)

	// Rutas protegidas
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth(jwtSvc))
		r.Get("/api/me", authH.Me)

		// WebSocket: ambos roles reciben eventos de dominio en tiempo real
		r.Get("/api/ws", wsProxy)

		// GET: ambos roles (admin y cliente)
		r.Get("/api/vms", vmProxy.ServeHTTP)

		// Escritura: solo admin — verificado en BFF antes de proxyear (SDD §7)
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireRole("admin"))
			r.Post("/api/vms", vmProxy.ServeHTTP)
			r.Put("/api/vms/{id}", vmProxy.ServeHTTP)
			r.Delete("/api/vms/{id}", vmProxy.ServeHTTP)
		})
	})

	// Archivos estáticos del frontend (SPA fallback a index.html)
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "/static"
	}
	if info, err := os.Stat(staticDir); err == nil && info.IsDir() {
		fs := http.FileServer(http.Dir(staticDir))
		r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
			path := staticDir + req.URL.Path
			if _, err := os.Stat(path); os.IsNotExist(err) {
				http.ServeFile(w, req, staticDir+"/index.html")
				return
			}
			fs.ServeHTTP(w, req)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	addr := ":" + port
	log.Printf("bff escuchando en %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("servidor: %v", err)
	}
}
