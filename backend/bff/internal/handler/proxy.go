package handler

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"

	"github.com/vm/bff/internal/middleware"
)

func NewVMProxy(apiCoreURL, internalSecret string) http.Handler {
	target, err := url.Parse(apiCoreURL)
	if err != nil {
		panic("API_CORE_URL inválida: " + err.Error())
	}

	isProd := os.Getenv("APP_ENV") == "prod"

	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(r *http.Request) {
		originalDirector(r)
		// Inyecta identidad del usuario desde los JWT claims (validados por RequireAuth)
		if claims, ok := middleware.ClaimsFromCtx(r.Context()); ok {
			r.Header.Set("X-User-Id", claims.Sub)
			r.Header.Set("X-User-Role", claims.Role)
		}
		r.Header.Del("Cookie")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isProd {
			// En GCP: api-core tiene --no-allow-unauthenticated.
			// Obtenemos un ID Token con audience=API_CORE_URL desde el metadata server.
			// La plataforma Cloud Run valida el token antes de que llegue al container;
			// api-core no necesita validar X-Internal-Secret en prod.
			token, err := fetchIDToken(r.Context(), apiCoreURL)
			if err != nil {
				log.Printf("IAM fetchIDToken error: %v", err)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"error":"internal error"}`))
				return
			}
			r.Header.Set("Authorization", "Bearer "+token)
		} else {
			r.Header.Set("X-Internal-Secret", internalSecret)
		}
		proxy.ServeHTTP(w, r)
	})
}
