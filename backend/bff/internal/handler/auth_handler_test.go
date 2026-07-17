package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/vm/bff/internal/auth"
	"github.com/vm/bff/internal/handler"
	"github.com/vm/bff/internal/infrastructure/postgres"
	"github.com/vm/bff/internal/middleware"
)

const secret = "test-jwt-secret"

// mockUserRepo implementa solo GetByEmail sin DB.
type mockUserRepo struct {
	user postgres.User
	err  error
}

func (m *mockUserRepo) GetByEmail(_ context.Context, _ string) (postgres.User, error) {
	return m.user, m.err
}

func newRouter(repo interface {
	GetByEmail(context.Context, string) (postgres.User, error)
}) *chi.Mux {
	jwtSvc := auth.NewJWTService(secret)
	authH := handler.NewAuthHandlerWithRepo(repo, jwtSvc)

	r := chi.NewRouter()
	r.Post("/api/login", authH.Login)
	r.Post("/api/logout", authH.Logout)
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth(jwtSvc))
		r.Get("/api/me", authH.Me)
	})
	return r
}

func hashPassword(t *testing.T, pw string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	return string(h)
}

func postLogin(r http.Handler, email, password string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	req := httptest.NewRequest(http.MethodPost, "/api/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestLogin_ValidCredentials_Returns200AndSetsCookie(t *testing.T) {
	hash := hashPassword(t, "secret123")
	repo := &mockUserRepo{user: postgres.User{ID: "u1", Email: "a@b.com", PasswordHash: hash, Role: "admin"}}
	r := newRouter(repo)

	w := postLogin(r, "a@b.com", "secret123")
	if w.Code != http.StatusOK {
		t.Fatalf("esperaba 200, got %d — %s", w.Code, w.Body.String())
	}
	cookie := w.Header().Get("Set-Cookie")
	if !strings.Contains(cookie, "session=") {
		t.Error("cookie 'session' no encontrada en Set-Cookie")
	}
	if !strings.Contains(cookie, "HttpOnly") {
		t.Error("cookie debe ser HttpOnly")
	}
	if !strings.Contains(cookie, "SameSite=Strict") {
		t.Error("cookie debe ser SameSite=Strict")
	}
	// JWT no debe aparecer en el body
	if strings.Contains(w.Body.String(), "eyJ") {
		t.Error("JWT no debe aparecer en el body de respuesta")
	}
}

func TestLogin_WrongPassword_Returns401(t *testing.T) {
	hash := hashPassword(t, "correct")
	repo := &mockUserRepo{user: postgres.User{ID: "u1", Email: "a@b.com", PasswordHash: hash, Role: "admin"}}
	r := newRouter(repo)

	w := postLogin(r, "a@b.com", "wrong")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("esperaba 401, got %d", w.Code)
	}
	if w.Header().Get("Set-Cookie") != "" {
		t.Error("no debe haber cookie en respuesta de login fallido")
	}
}

func TestLogin_UserNotFound_Returns401(t *testing.T) {
	repo := &mockUserRepo{err: postgres.ErrUserNotFound}
	r := newRouter(repo)

	w := postLogin(r, "noexiste@b.com", "any")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("esperaba 401, got %d", w.Code)
	}
}

func TestLogout_ClearsCookie(t *testing.T) {
	repo := &mockUserRepo{}
	r := newRouter(repo)

	req := httptest.NewRequest(http.MethodPost, "/api/logout", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	cookie := w.Header().Get("Set-Cookie")
	// Go serializa MaxAge<0 como Max-Age=0 en el header (ambos eliminan la cookie)
	if !strings.Contains(cookie, "Max-Age=0") {
		t.Errorf("logout debe limpiar cookie con Max-Age=0, got: %s", cookie)
	}
}

func TestMe_ValidCookie_Returns200WithClaims(t *testing.T) {
	hash := hashPassword(t, "pass")
	repo := &mockUserRepo{user: postgres.User{ID: "u1", Email: "a@b.com", PasswordHash: hash, Role: "admin"}}
	r := newRouter(repo)

	// Login para obtener la cookie
	loginResp := postLogin(r, "a@b.com", "pass")
	cookieHeader := loginResp.Header().Get("Set-Cookie")

	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.Header.Set("Cookie", cookieHeader)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("esperaba 200, got %d — %s", w.Code, w.Body.String())
	}
	var body map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body["role"] != "admin" || body["email"] != "a@b.com" {
		t.Errorf("claims incorrectos: %v", body)
	}
}

func TestMe_NoCookie_Returns401(t *testing.T) {
	r := newRouter(&mockUserRepo{})
	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("esperaba 401, got %d", w.Code)
	}
}

func TestMe_TamperedToken_Returns401(t *testing.T) {
	hash := hashPassword(t, "pass")
	repo := &mockUserRepo{user: postgres.User{ID: "u1", Email: "a@b.com", PasswordHash: hash, Role: "admin"}}
	r := newRouter(repo)

	loginResp := postLogin(r, "a@b.com", "pass")
	cookieHeader := loginResp.Header().Get("Set-Cookie")

	// Extrae el token y manipula su firma
	parts := strings.Split(cookieHeader, ";")
	tokenPart := strings.TrimPrefix(strings.TrimSpace(parts[0]), "session=")
	jwtParts := strings.Split(tokenPart, ".")
	if len(jwtParts) == 3 {
		sig := []byte(jwtParts[2])
		sig[len(sig)-1] ^= 0xFF
		tampered := jwtParts[0] + "." + jwtParts[1] + "." + string(sig)
		cookieHeader = "session=" + tampered
	}

	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.Header.Set("Cookie", cookieHeader)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("firma manipulada debe retornar 401, got %d", w.Code)
	}
}
