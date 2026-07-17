package handler

import (
	"context"
	"log"
	"net/http"
	"os"
)

type contextKey string

const (
	ctxUserID   contextKey = "userID"
	ctxUserRole contextKey = "userRole"
)

// HeaderAuthMiddleware valida X-Internal-Secret antes de confiar en X-User-Id y X-User-Role.
//
// En prod (APP_ENV=prod), Cloud Run valida el ID Token del BFF antes de que la
// request llegue al container — la plataforma garantiza el caller, por lo que
// X-Internal-Secret no aplica. En dev, el secreto compartido es el mecanismo.
func HeaderAuthMiddleware(secret string) func(http.Handler) http.Handler {
	isProd := os.Getenv("APP_ENV") == "prod"
	if !isProd && secret == "" {
		log.Fatal("INTERNAL_PROXY_SECRET no puede estar vacío en APP_ENV!=prod")
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !isProd {
				if r.Header.Get("X-Internal-Secret") != secret {
					http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
					return
				}
			}
			userID := r.Header.Get("X-User-Id")
			if userID == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), ctxUserID, userID)
			ctx = context.WithValue(ctx, ctxUserRole, r.Header.Get("X-User-Role"))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRoleMiddleware es defensa en profundidad: verifica el rol aunque el BFF
// ya lo haya hecho. Falla cerrado (403) si el rol está ausente o no coincide —
// cubriendo el escenario donde el BFF falla en inyectar X-User-Role.
func RequireRoleMiddleware(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole, _ := r.Context().Value(ctxUserRole).(string)
			if userRole != role {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func GetEnvOrFatal(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s no puede estar vacío", key)
	}
	return v
}
