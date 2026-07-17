package middleware

import (
	"net/http"
)

// RequireRole verifica que el rol en los JWT claims coincida con el requerido.
//
// Siempre corre después de RequireAuth — si los claims están ausentes aquí,
// indica un bug de orden de middlewares (RequireAuth no fue aplicado).
// Responde 403 (no 401) en ese caso porque:
//   - 401 implica "envía credenciales", pero no hay credenciales que corregir:
//     el error está en la configuración del servidor, no en el cliente.
//   - 403 falla cerrado sin revelar el mecanismo interno de auth.
func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromCtx(r.Context())
			if !ok || claims.Role != role {
				writeForbidden(w)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func writeForbidden(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_, _ = w.Write([]byte(`{"error":"forbidden"}`))
}
