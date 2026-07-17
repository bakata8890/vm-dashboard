package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"golang.org/x/crypto/bcrypt"

	"github.com/vm/bff/internal/auth"
	"github.com/vm/bff/internal/infrastructure/postgres"
	"github.com/vm/bff/internal/middleware"
)

type UserLookup interface {
	GetByEmail(ctx context.Context, email string) (postgres.User, error)
}

type AuthHandler struct {
	userRepo UserLookup
	jwtSvc   *auth.JWTService
}

func NewAuthHandler(userRepo *postgres.UserRepo, jwtSvc *auth.JWTService) *AuthHandler {
	return &AuthHandler{userRepo: userRepo, jwtSvc: jwtSvc}
}

func NewAuthHandlerWithRepo(repo UserLookup, jwtSvc *auth.JWTService) *AuthHandler {
	return &AuthHandler{userRepo: repo, jwtSvc: jwtSvc}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email y password requeridos"})
		return
	}

	user, err := h.userRepo.GetByEmail(context.Background(), req.Email)
	if errors.Is(err, postgres.ErrUserNotFound) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "credenciales inválidas"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "credenciales inválidas"})
		return
	}

	token, err := h.jwtSvc.Sign(user.ID, user.Email, user.Role)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}

	auth.SetAuthCookie(w, token)
	// JWT nunca en el body — solo confirma OK
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	auth.ClearAuthCookie(w)
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromCtx(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"id":    claims.Sub,
		"email": claims.Email,
		"role":  claims.Role,
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
