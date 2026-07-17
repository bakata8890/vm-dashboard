package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/vm/bff/internal/auth"
)

func injectClaims(r *http.Request, role string) *http.Request {
	claims := &auth.Claims{Sub: "uid-1", Email: "a@b.com", Role: role}
	ctx := context.WithValue(r.Context(), claimsKey{}, claims)
	return r.WithContext(ctx)
}

func ok200(_ http.ResponseWriter, _ *http.Request) {}

func TestRequireRole_Admin_Passes(t *testing.T) {
	h := RequireRole("admin")(http.HandlerFunc(ok200))
	req := injectClaims(httptest.NewRequest(http.MethodPost, "/", nil), "admin")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("admin debe pasar, got %d", w.Code)
	}
}

func TestRequireRole_Cliente_Returns403(t *testing.T) {
	h := RequireRole("admin")(http.HandlerFunc(ok200))
	req := injectClaims(httptest.NewRequest(http.MethodPost, "/", nil), "cliente")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("cliente debe recibir 403, got %d", w.Code)
	}
}

func TestRequireRole_WrongRole_Returns403(t *testing.T) {
	h := RequireRole("admin")(http.HandlerFunc(ok200))
	req := injectClaims(httptest.NewRequest(http.MethodPost, "/", nil), "superadmin")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("rol incorrecto debe ser 403, got %d", w.Code)
	}
}

// TestRequireRole_MissingClaims_Returns403 verifica que RequireRole falla cerrado
// cuando no hay claims en contexto — escenario imposible en operación normal
// (RequireAuth siempre corre primero), pero posible si alguien alambra las rutas
// en el orden incorrecto. Devuelve 403, no 401: ver comentario en require_role.go.
func TestRequireRole_MissingClaims_Returns403(t *testing.T) {
	h := RequireRole("admin")(http.HandlerFunc(ok200))
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("sin claims debe retornar 403 (fail closed), got %d", w.Code)
	}
}
