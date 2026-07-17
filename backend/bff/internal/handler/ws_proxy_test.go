package handler_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/vm/bff/internal/auth"
	"github.com/vm/bff/internal/handler"
	"github.com/vm/bff/internal/middleware"
)

// buildWSRouter monta /api/ws detrás de RequireAuth, igual que main.go.
// El upstream apunta a localhost:9999 (inalcanzable) — nunca se llega a él
// porque RequireAuth rechaza las peticiones antes del upgrade.
func buildWSRouter(t *testing.T) *chi.Mux {
	t.Helper()
	jwtSvc := auth.NewJWTService(routeSecret)
	wsProxy := handler.NewWSProxy("http://localhost:9999", "test-secret")
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth(jwtSvc))
		r.Get("/api/ws", wsProxy)
	})
	return r
}

// TestWSProxy_NoAuth_Returns401 verifica que una petición sin cookie de sesión
// es rechazada por RequireAuth con 401 antes de intentar el upgrade WS.
// Misma criticidad que TestLogin_NoBody_Returns400 y TestCreate_MissingRole_Returns403.
func TestWSProxy_NoAuth_Returns401(t *testing.T) {
	r := buildWSRouter(t)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/ws", nil) // sin cookie
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("sin cookie WS debe ser 401, got %d", w.Code)
	}
}

// TestWSProxy_InvalidToken_Returns401 verifica que un JWT manipulado
// es rechazado con 401 — la firma no coincide con el secret del servidor.
func TestWSProxy_InvalidToken_Returns401(t *testing.T) {
	r := buildWSRouter(t)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/ws", nil)
	req.Header.Set("Cookie", "session=invalid.tampered.jwt")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("JWT inválido WS debe ser 401, got %d", w.Code)
	}
}
