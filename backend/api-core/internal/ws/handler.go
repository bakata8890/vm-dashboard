package ws

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// CheckOrigin: el BFF es el único caller en producción (pasa por HeaderAuthMiddleware).
	// En dev, el BFF también lo llama directamente. Permitimos todos los orígenes
	// porque la autenticación ya fue validada por HeaderAuthMiddleware antes de llegar aquí.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// NewHandler devuelve el http.HandlerFunc que acepta upgrades WS y registra clientes en el hub.
// Debe montarse detrás de HeaderAuthMiddleware — la autenticación ya está validada al llegar aquí.
func NewHandler(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("ws upgrade: %v", err)
			return
		}
		client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
		hub.register <- client
		go client.writePump()
		go client.readPump()
	}
}
