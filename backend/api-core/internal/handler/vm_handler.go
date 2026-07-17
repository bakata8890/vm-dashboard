package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/vm/api-core/internal/domain"
	"github.com/vm/api-core/internal/service"
	"github.com/vm/api-core/internal/ws"
)

type VMHandler struct {
	svc *service.VMService
	hub *ws.Hub // nil → no broadcast (tests sin hub)
}

func NewVMHandler(svc *service.VMService) *VMHandler {
	return &VMHandler{svc: svc}
}

func NewVMHandlerWithHub(svc *service.VMService, hub *ws.Hub) *VMHandler {
	return &VMHandler{svc: svc, hub: hub}
}

func (h *VMHandler) Routes(r chi.Router) {
	// GET: accesible a ambos roles
	r.Get("/api/vms", h.list)

	// Escritura: defensa en profundidad — BFF ya verificó el rol, api-core lo revalida
	r.Group(func(r chi.Router) {
		r.Use(RequireRoleMiddleware("admin"))
		r.Post("/api/vms", h.create)
		r.Put("/api/vms/{id}", h.update)
		r.Delete("/api/vms/{id}", h.delete)
	})
}

// --- request/response types ---

type vmResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Cores     int    `json:"cores"`
	RAMGB     int    `json:"ram_gb"`
	DiskGB    int    `json:"disk_gb"`
	OS        string `json:"os"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type createRequest struct {
	Name   string `json:"name"`
	Cores  int    `json:"cores"`
	RAMGB  int    `json:"ram_gb"`
	DiskGB int    `json:"disk_gb"`
	OS     string `json:"os"`
	Status string `json:"status"`
}

// updateRequest usa punteros — campo ausente en JSON = nil = no tocar.
type updateRequest struct {
	Name   *string `json:"name"`
	Cores  *int    `json:"cores"`
	RAMGB  *int    `json:"ram_gb"`
	DiskGB *int    `json:"disk_gb"`
	OS     *string `json:"os"`
	Status *string `json:"status"`
}

// --- handlers ---

func (h *VMHandler) list(w http.ResponseWriter, r *http.Request) {
	vms, err := h.svc.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, toResponseList(vms))
}

func (h *VMHandler) create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "cuerpo JSON inválido")
		return
	}
	vm, err := h.svc.Create(r.Context(), service.CreateInput{
		Name:   req.Name,
		Cores:  req.Cores,
		RAMGB:  req.RAMGB,
		DiskGB: req.DiskGB,
		OS:     req.OS,
		Status: domain.VMStatus(req.Status),
	})
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	resp := toResponse(vm)
	if h.hub != nil {
		h.hub.Broadcast(ws.Event{Type: "vm_created", Data: resp})
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *VMHandler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var req updateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "cuerpo JSON inválido")
		return
	}
	in := service.UpdateInput{
		Name:   req.Name,
		Cores:  req.Cores,
		RAMGB:  req.RAMGB,
		DiskGB: req.DiskGB,
		OS:     req.OS,
	}
	if req.Status != nil {
		s := domain.VMStatus(*req.Status)
		in.Status = &s
	}
	vm, err := h.svc.Update(r.Context(), id, in)
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	resp := toResponse(vm)
	if h.hub != nil {
		h.hub.Broadcast(ws.Event{Type: "vm_updated", Data: resp})
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *VMHandler) delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeServiceErr(w, err)
		return
	}
	if h.hub != nil {
		h.hub.Broadcast(ws.Event{Type: "vm_deleted", Data: map[string]string{"id": id.String()}})
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- helpers ---

func parseUUID(w http.ResponseWriter, raw string) (uuid.UUID, bool) {
	id, err := uuid.Parse(raw)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "id inválido")
		return uuid.UUID{}, false
	}
	return id, true
}

func writeServiceErr(w http.ResponseWriter, err error) {
	if service.IsValidationError(err) || errors.Is(err, domain.ErrCheckConstraint) {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, domain.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "vm not found")
		return
	}
	writeErr(w, http.StatusInternalServerError, "internal error")
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func toResponse(v domain.VM) vmResponse {
	return vmResponse{
		ID:        v.ID.String(),
		Name:      v.Name,
		Cores:     v.Cores,
		RAMGB:     v.RAMGB,
		DiskGB:    v.DiskGB,
		OS:        v.OS,
		Status:    string(v.Status),
		CreatedAt: v.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt: v.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

func toResponseList(vms []domain.VM) []vmResponse {
	out := make([]vmResponse, len(vms))
	for i, v := range vms {
		out[i] = toResponse(v)
	}
	return out
}
