package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vm/api-core/internal/handler"
	"github.com/vm/api-core/internal/infrastructure/postgres"
	"github.com/vm/api-core/internal/service"
)

const testSecret = "test-internal-secret"

func newTestRouter(t *testing.T) (chi.Router, *pgxpool.Pool) {
	t.Helper()
	os.Setenv("INTERNAL_PROXY_SECRET", testSecret)

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://vm_user:vm_pass@localhost:5433/vm_db?sslmode=disable"
	}
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Skipf("sin Postgres disponible: %v", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		t.Skipf("sin Postgres disponible: %v", err)
	}

	// Limpia la tabla antes de cada test para aislamiento
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "TRUNCATE TABLE vms RESTART IDENTITY CASCADE")
		pool.Close()
	})
	_, _ = pool.Exec(context.Background(), "TRUNCATE TABLE vms RESTART IDENTITY CASCADE")

	repo := postgres.NewVMRepo(pool)
	svc := service.NewVMService(repo)
	h := handler.NewVMHandler(svc)

	r := chi.NewRouter()
	r.Use(handler.HeaderAuthMiddleware(testSecret))
	h.Routes(r)
	return r, pool
}

func newReq(method, path string, body any) *http.Request {
	var req *http.Request
	if body != nil {
		b, _ := json.Marshal(body)
		req = httptest.NewRequest(method, path, bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	// Simula el BFF inyectando el secret, el user ID y el rol (admin por defecto)
	req.Header.Set("X-Internal-Secret", testSecret)
	req.Header.Set("X-User-Id", "test-user-id")
	req.Header.Set("X-User-Role", "admin")
	return req
}

func postJSON(t *testing.T, r http.Handler, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	r.ServeHTTP(w, newReq(http.MethodPost, path, body))
	return w
}

func TestList_EmptyDB_Returns200AndEmptyArray(t *testing.T) {
	r, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, newReq(http.MethodGet, "/api/vms", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("esperaba 200, got %d", w.Code)
	}
	var result []any
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("response no es JSON array: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("esperaba array vacío, got %d elementos", len(result))
	}
}

func TestCreate_ValidVM_Returns201WithID(t *testing.T) {
	r, _ := newTestRouter(t)
	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "vm-test", "cores": 2, "ram_gb": 4,
		"disk_gb": 50, "os": "Ubuntu 22.04", "status": "apagada",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("esperaba 201, got %d — body: %s", w.Code, w.Body.String())
	}
	var vm map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &vm)
	if vm["id"] == "" || vm["id"] == nil {
		t.Error("esperaba id en respuesta")
	}
}

func TestCreate_InvalidName_Returns400(t *testing.T) {
	r, _ := newTestRouter(t)
	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "-invalido", "cores": 2, "ram_gb": 4,
		"disk_gb": 50, "os": "Ubuntu 22.04", "status": "apagada",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("esperaba 400, got %d", w.Code)
	}
}

func TestCreate_InvalidOS_Returns400(t *testing.T) {
	r, _ := newTestRouter(t)
	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "vm-test", "cores": 2, "ram_gb": 4,
		"disk_gb": 50, "os": "Arch Linux", "status": "apagada",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("esperaba 400, got %d", w.Code)
	}
}

func TestUpdate_ExistingVM_Returns200(t *testing.T) {
	r, _ := newTestRouter(t)

	// Crea una VM primero
	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "vm-original", "cores": 2, "ram_gb": 4,
		"disk_gb": 50, "os": "Ubuntu 22.04", "status": "apagada",
	})
	var created map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	id := created["id"].(string)

	// PUT parcial — solo cambia cores
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, newReq(http.MethodPut, "/api/vms/"+id, map[string]any{"cores": 8}))

	if w2.Code != http.StatusOK {
		t.Fatalf("esperaba 200, got %d — body: %s", w2.Code, w2.Body.String())
	}
	var updated map[string]any
	_ = json.Unmarshal(w2.Body.Bytes(), &updated)
	if updated["cores"].(float64) != 8 {
		t.Errorf("esperaba cores=8, got %v", updated["cores"])
	}
}

func TestUpdate_NonExistentVM_Returns404(t *testing.T) {
	r, _ := newTestRouter(t)
	fakeID := "00000000-0000-0000-0000-000000000001"
	w := httptest.NewRecorder()
	r.ServeHTTP(w, newReq(http.MethodPut, "/api/vms/"+fakeID, map[string]any{"cores": 4}))

	if w.Code != http.StatusNotFound {
		t.Fatalf("esperaba 404, got %d", w.Code)
	}
}

func TestDelete_ExistingVM_Returns204(t *testing.T) {
	r, _ := newTestRouter(t)

	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "vm-a-borrar", "cores": 1, "ram_gb": 1,
		"disk_gb": 10, "os": "Debian 12", "status": "apagada",
	})
	var created map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	id := created["id"].(string)

	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, newReq(http.MethodDelete, "/api/vms/"+id, nil))

	if w2.Code != http.StatusNoContent {
		t.Fatalf("esperaba 204, got %d", w2.Code)
	}
}

func TestDelete_MalformedUUID_Returns400(t *testing.T) {
	r, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, newReq(http.MethodDelete, "/api/vms/no-es-uuid", nil))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("esperaba 400, got %d", w.Code)
	}
}

func TestUpdate_ExplicitZeroCores_Returns400(t *testing.T) {
	r, _ := newTestRouter(t)

	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "vm-test", "cores": 2, "ram_gb": 4,
		"disk_gb": 50, "os": "Ubuntu 22.04", "status": "apagada",
	})
	var created map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	id := created["id"].(string)

	// cores:0 es explícito (puntero no-nil apuntando a 0) → debe ser 400
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, newReq(http.MethodPut, "/api/vms/"+id, map[string]any{"cores": 0}))

	if w2.Code != http.StatusBadRequest {
		t.Fatalf("cores:0 explícito debe retornar 400, got %d — body: %s", w2.Code, w2.Body.String())
	}
}

func TestRequest_WrongInternalSecret_Returns401(t *testing.T) {
	r, _ := newTestRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/api/vms", nil)
	req.Header.Set("X-Internal-Secret", "wrong-secret")
	req.Header.Set("X-User-Id", "any-id")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("secret incorrecto debe retornar 401, got %d", w.Code)
	}
}

func TestRequest_MissingInternalSecret_Returns401(t *testing.T) {
	r, _ := newTestRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/api/vms", nil)
	req.Header.Set("X-User-Id", "any-id")
	// Sin X-Internal-Secret
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("sin secret debe retornar 401, got %d", w.Code)
	}
}

func TestErrorBody_ContainsErrorKey(t *testing.T) {
	r, _ := newTestRouter(t)
	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "x", "cores": 0, "ram_gb": 4,
		"disk_gb": 50, "os": "Ubuntu 22.04", "status": "apagada",
	})
	if !strings.Contains(w.Body.String(), `"error"`) {
		t.Errorf("body de error no contiene clave 'error': %s", w.Body.String())
	}
}

// --- Tests de roles (defensa en profundidad en api-core) ---

func TestCreate_ClienteRole_Returns403(t *testing.T) {
	r, _ := newTestRouter(t)
	req := newReq(http.MethodPost, "/api/vms", map[string]any{
		"name": "vm-test", "cores": 2, "ram_gb": 4,
		"disk_gb": 50, "os": "Ubuntu 22.04", "status": "apagada",
	})
	req.Header.Set("X-User-Role", "cliente")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("cliente no puede crear VMs, esperaba 403, got %d", w.Code)
	}
}

// TestCreate_MissingRole_Returns403 verifica el caso de defensa en profundidad:
// el BFF falló en inyectar X-User-Role (header ausente).
// RequireRoleMiddleware debe fallar cerrado con 403, nunca permitir el paso.
func TestCreate_MissingRole_Returns403(t *testing.T) {
	r, _ := newTestRouter(t)
	req := newReq(http.MethodPost, "/api/vms", map[string]any{
		"name": "vm-test", "cores": 2, "ram_gb": 4,
		"disk_gb": 50, "os": "Ubuntu 22.04", "status": "apagada",
	})
	req.Header.Del("X-User-Role")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("X-User-Role ausente debe ser 403 (fail closed), got %d", w.Code)
	}
}

func TestUpdate_ClienteRole_Returns403(t *testing.T) {
	r, _ := newTestRouter(t)
	// Crea con admin
	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "vm-role-test", "cores": 2, "ram_gb": 4,
		"disk_gb": 50, "os": "Ubuntu 22.04", "status": "apagada",
	})
	var created map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	id := created["id"].(string)

	// Intenta actualizar como cliente
	req := newReq(http.MethodPut, "/api/vms/"+id, map[string]any{"cores": 4})
	req.Header.Set("X-User-Role", "cliente")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req)
	if w2.Code != http.StatusForbidden {
		t.Fatalf("cliente no puede actualizar VMs, esperaba 403, got %d", w2.Code)
	}
}

func TestUpdate_MissingRole_Returns403(t *testing.T) {
	r, _ := newTestRouter(t)
	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "vm-role-test2", "cores": 2, "ram_gb": 4,
		"disk_gb": 50, "os": "Ubuntu 22.04", "status": "apagada",
	})
	var created map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	id := created["id"].(string)

	req := newReq(http.MethodPut, "/api/vms/"+id, map[string]any{"cores": 4})
	req.Header.Del("X-User-Role")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req)
	if w2.Code != http.StatusForbidden {
		t.Fatalf("X-User-Role ausente en PUT debe ser 403, got %d", w2.Code)
	}
}

func TestDelete_ClienteRole_Returns403(t *testing.T) {
	r, _ := newTestRouter(t)
	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "vm-del-role", "cores": 1, "ram_gb": 1,
		"disk_gb": 10, "os": "Debian 12", "status": "apagada",
	})
	var created map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	id := created["id"].(string)

	req := newReq(http.MethodDelete, "/api/vms/"+id, nil)
	req.Header.Set("X-User-Role", "cliente")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req)
	if w2.Code != http.StatusForbidden {
		t.Fatalf("cliente no puede eliminar VMs, esperaba 403, got %d", w2.Code)
	}
}

func TestDelete_MissingRole_Returns403(t *testing.T) {
	r, _ := newTestRouter(t)
	w := postJSON(t, r, "/api/vms", map[string]any{
		"name": "vm-del-role2", "cores": 1, "ram_gb": 1,
		"disk_gb": 10, "os": "Debian 12", "status": "apagada",
	})
	var created map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	id := created["id"].(string)

	req := newReq(http.MethodDelete, "/api/vms/"+id, nil)
	req.Header.Del("X-User-Role")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req)
	if w2.Code != http.StatusForbidden {
		t.Fatalf("X-User-Role ausente en DELETE debe ser 403, got %d", w2.Code)
	}
}

func TestList_ClienteRole_Returns200(t *testing.T) {
	r, _ := newTestRouter(t)
	req := newReq(http.MethodGet, "/api/vms", nil)
	req.Header.Set("X-User-Role", "cliente")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("cliente puede listar VMs, esperaba 200, got %d", w.Code)
	}
}
