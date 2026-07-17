package ws

import (
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

// Event es el envelope JSON que viaja por el WS a todos los clientes.
type Event struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

// Client representa una conexión WS activa.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

// Hub gestiona el conjunto de clientes conectados y el broadcast de eventos.
// Toda la mutación del mapa clients ocurre dentro del goroutine de Run()
// mediante canales — sin mutex necesario.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run debe correr en su propio goroutine (go hub.Run()).
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.clients[c] = true
		case c := <-h.unregister:
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}
		case msg := <-h.broadcast:
			for c := range h.clients {
				select {
				case c.send <- msg:
				default:
					// Cliente lento — desconectar para no bloquear el hub
					delete(h.clients, c)
					close(c.send)
				}
			}
		}
	}
}

// Broadcast serializa el evento y lo envía a todos los clientes conectados.
// Seguro para llamar desde cualquier goroutine.
func (h *Hub) Broadcast(event Event) {
	b, err := json.Marshal(event)
	if err != nil {
		log.Printf("ws hub marshal: %v", err)
		return
	}
	h.broadcast <- b
}

func (c *Client) writePump() {
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			break
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	for {
		// No procesamos mensajes cliente→servidor en esta versión.
		// ReadMessage es necesario para detectar desconexión y mensajes de control (ping/pong).
		if _, _, err := c.conn.ReadMessage(); err != nil {
			break
		}
	}
}
