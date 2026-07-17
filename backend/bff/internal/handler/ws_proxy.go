package handler

import (
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/gorilla/websocket"
	"github.com/vm/bff/internal/middleware"
)

var browserUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// CheckOrigin: el browser conecta desde el mismo dominio (Load Balancer en prod,
	// Vite proxy en dev). RequireAuth ya verificó la cookie antes de llegar aquí.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// NewWSProxy devuelve un handler que autentica la conexión WS del browser y la
// proxea de forma transparente al hub de api-core.
//
// Flujo:
//  1. RequireAuth (middleware externo) ya verificó el JWT de la cookie — claims en contexto.
//  2. Dializamos api-core con X-Internal-Secret + X-User-Id + X-User-Role.
//  3. Upgradeamos la conexión con el browser.
//  4. Pipe bidireccional: api-core → browser (eventos) y browser → api-core (ignorados por ahora).
func NewWSProxy(apiCoreURL, internalSecret string) http.HandlerFunc {
	upstreamWS := toWSURL(apiCoreURL) + "/api/ws"
	isProd := os.Getenv("APP_ENV") == "prod"

	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := middleware.ClaimsFromCtx(r.Context())
		if !ok {
			// Defensa extra: RequireAuth debería haber rechazado antes, pero falla cerrado.
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		// Construye headers para el dial a api-core
		upstreamHeaders := http.Header{}
		if isProd {
			token, err := fetchIDToken(r.Context(), apiCoreURL)
			if err != nil {
				log.Printf("ws proxy IAM error: %v", err)
				http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
				return
			}
			upstreamHeaders.Set("Authorization", "Bearer "+token)
		} else {
			upstreamHeaders.Set("X-Internal-Secret", internalSecret)
		}
		upstreamHeaders.Set("X-User-Id", claims.Sub)
		upstreamHeaders.Set("X-User-Role", claims.Role)

		// Dial api-core WS
		upstream, _, err := websocket.DefaultDialer.DialContext(r.Context(), upstreamWS, upstreamHeaders)
		if err != nil {
			log.Printf("ws dial api-core (%s): %v", upstreamWS, err)
			http.Error(w, `{"error":"upstream unavailable"}`, http.StatusBadGateway)
			return
		}
		defer upstream.Close()

		// Upgrade conexión con el browser
		browser, err := browserUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("ws upgrade browser: %v", err)
			return
		}
		defer browser.Close()

		// Pipe bidireccional — cerramos en cuanto cualquier lado falla
		errc := make(chan error, 2)

		go func() { // api-core → browser (eventos de dominio)
			for {
				mt, msg, err := upstream.ReadMessage()
				if err != nil {
					errc <- err
					return
				}
				if err := browser.WriteMessage(mt, msg); err != nil {
					errc <- err
					return
				}
			}
		}()
		go func() { // browser → api-core (mensajes de control, ignorados)
			for {
				mt, msg, err := browser.ReadMessage()
				if err != nil {
					errc <- err
					return
				}
				if err := upstream.WriteMessage(mt, msg); err != nil {
					errc <- err
					return
				}
			}
		}()

		<-errc // bloquea hasta que un lado cierre
	}
}

// toWSURL convierte http:// → ws:// y https:// → wss://.
func toWSURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	switch u.Scheme {
	case "http":
		u.Scheme = "ws"
	case "https":
		u.Scheme = "wss"
	}
	return u.String()
}
