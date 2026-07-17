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

const routeSecret = "route-test-jwt-secret"

// buildRouteRouter construye el mismo árbol de rutas que main.go pero con un
// upstream mock en lugar de api-core real. Permite verificar que RequireRole
// está alambrado a los métodos correctos sin necesitar DB ni red.
func buildRouteRouter(t *testing.T, upstreamURL string) *chi.Mux {
	t.Helper()
	jwtSvc := auth.NewJWTService(routeSecret)
	vmProxy := handler.NewVMProxy(upstreamURL, "test-secret")

	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth(jwtSvc))
		r.Get("/api/vms", vmProxy.ServeHTTP)
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireRole("admin"))
			r.Post("/api/vms", vmProxy.ServeHTTP)
			r.Put("/api/vms/{id}", vmProxy.ServeHTTP)
			r.Delete("/api/vms/{id}", vmProxy.ServeHTTP)
		})
	})
	return r
}

func cookieWithRole(t *testing.T, role string) string {
	t.Helper()
	jwtSvc := auth.NewJWTService(routeSecret)
	token, err := jwtSvc.Sign("uid-1", "a@b.com", role)
	if err != nil {
		t.Fatal(err)
	}
	return "session=" + token
}

func routeReq(method, path, cookie string) *http.Request {
	req := httptest.NewRequest(method, path, nil)
	req.Header.Set("Cookie", cookie)
	return req
}

func TestBFFRoute_Cliente_POST_Returns403(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	r := buildRouteRouter(t, upstream.URL)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, routeReq(http.MethodPost, "/api/vms", cookieWithRole(t, "cliente")))
	if w.Code != http.StatusForbidden {
		t.Fatalf("cliente POST /api/vms debe ser 403, got %d", w.Code)
	}
}

func TestBFFRoute_Admin_POST_Passes(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	defer upstream.Close()

	r := buildRouteRouter(t, upstream.URL)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, routeReq(http.MethodPost, "/api/vms", cookieWithRole(t, "admin")))
	if w.Code == http.StatusForbidden {
		t.Fatalf("admin POST /api/vms no debe ser 403, got %d", w.Code)
	}
}

func TestBFFRoute_Cliente_PUT_Returns403(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	r := buildRouteRouter(t, upstream.URL)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, routeReq(http.MethodPut, "/api/vms/some-uuid", cookieWithRole(t, "cliente")))
	if w.Code != http.StatusForbidden {
		t.Fatalf("cliente PUT /api/vms/:id debe ser 403, got %d", w.Code)
	}
}

func TestBFFRoute_Cliente_DELETE_Returns403(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()

	r := buildRouteRouter(t, upstream.URL)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, routeReq(http.MethodDelete, "/api/vms/some-uuid", cookieWithRole(t, "cliente")))
	if w.Code != http.StatusForbidden {
		t.Fatalf("cliente DELETE /api/vms/:id debe ser 403, got %d", w.Code)
	}
}

func TestBFFRoute_Cliente_GET_Returns200(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	defer upstream.Close()

	r := buildRouteRouter(t, upstream.URL)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, routeReq(http.MethodGet, "/api/vms", cookieWithRole(t, "cliente")))
	if w.Code == http.StatusForbidden {
		t.Fatalf("cliente GET /api/vms no debe ser 403, got %d", w.Code)
	}
}

func TestBFFRoute_Admin_GET_Returns200(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	defer upstream.Close()

	r := buildRouteRouter(t, upstream.URL)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, routeReq(http.MethodGet, "/api/vms", cookieWithRole(t, "admin")))
	if w.Code == http.StatusForbidden {
		t.Fatalf("admin GET /api/vms no debe ser 403, got %d", w.Code)
	}
}
