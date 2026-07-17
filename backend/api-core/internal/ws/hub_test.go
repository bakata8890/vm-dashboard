package ws_test

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	ws "github.com/vm/api-core/internal/ws"
)

func newTestServer(t *testing.T) (*httptest.Server, *ws.Hub) {
	t.Helper()
	hub := ws.NewHub()
	go hub.Run()
	srv := httptest.NewServer(ws.NewHandler(hub))
	t.Cleanup(srv.Close)
	return srv, hub
}

func dialWS(t *testing.T, srv *httptest.Server) *websocket.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial WS: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func readWithTimeout(t *testing.T, conn *websocket.Conn, label string) string {
	t.Helper()
	if err := conn.SetReadDeadline(time.Now().Add(3 * time.Second)); err != nil {
		t.Fatalf("%s SetReadDeadline: %v", label, err)
	}
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("%s no recibió mensaje en 3s: %v", label, err)
	}
	return string(msg)
}

// TestHub_BroadcastsToAllClients verifica que todos los clientes conectados
// reciben el evento, cumpliendo el requisito central del módulo WS.
func TestHub_BroadcastsToAllClients(t *testing.T) {
	srv, hub := newTestServer(t)

	connA := dialWS(t, srv)
	connB := dialWS(t, srv)

	// Dar tiempo al hub para registrar ambos clientes
	time.Sleep(50 * time.Millisecond)

	hub.Broadcast(ws.Event{Type: "vm_updated", Data: map[string]string{"id": "test-uuid"}})

	type result struct {
		label string
		msg   string
	}
	ch := make(chan result, 2)

	go func() {
		msg := readWithTimeout(t, connA, "cliente A")
		ch <- result{"A", msg}
	}()
	go func() {
		msg := readWithTimeout(t, connB, "cliente B")
		ch <- result{"B", msg}
	}()

	for i := 0; i < 2; i++ {
		r := <-ch
		if !strings.Contains(r.msg, "vm_updated") {
			t.Errorf("cliente %s: mensaje inesperado: %s", r.label, r.msg)
		}
	}
}

// TestHub_ClientDisconnect_NoBlockBroadcast verifica que desconectar un cliente
// no bloquea ni rompe el broadcast a los clientes restantes.
func TestHub_ClientDisconnect_NoBlockBroadcast(t *testing.T) {
	srv, hub := newTestServer(t)

	connA := dialWS(t, srv)
	connB := dialWS(t, srv)

	time.Sleep(50 * time.Millisecond)

	// Desconectar A abruptamente
	connA.Close()
	time.Sleep(20 * time.Millisecond)

	// Broadcast debe llegar a B sin panic ni deadlock
	hub.Broadcast(ws.Event{Type: "vm_updated", Data: map[string]string{"id": "uuid-2"}})

	msg := readWithTimeout(t, connB, "cliente B (tras desconexión de A)")
	if !strings.Contains(msg, "vm_updated") {
		t.Errorf("cliente B: mensaje inesperado: %s", msg)
	}
}

// TestHub_BroadcastPayloadShape verifica que el JSON emitido tiene los campos
// "type" y "data" que el frontend espera.
func TestHub_BroadcastPayloadShape(t *testing.T) {
	srv, hub := newTestServer(t)
	conn := dialWS(t, srv)
	time.Sleep(50 * time.Millisecond)

	hub.Broadcast(ws.Event{
		Type: "vm_deleted",
		Data: map[string]string{"id": "some-uuid"},
	})

	msg := readWithTimeout(t, conn, "cliente")
	if !strings.Contains(msg, `"type":"vm_deleted"`) {
		t.Errorf("payload no contiene type correcto: %s", msg)
	}
	if !strings.Contains(msg, `"data"`) {
		t.Errorf("payload no contiene data: %s", msg)
	}
}
