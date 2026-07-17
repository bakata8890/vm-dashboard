package service_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/vm/api-core/internal/domain"
	"github.com/vm/api-core/internal/service"
)

// mockRepo implementa domain.VMRepository en memoria.
type mockRepo struct {
	vms    []domain.VM
	called string
}

func (m *mockRepo) List(_ context.Context) ([]domain.VM, error) {
	m.called = "List"
	return m.vms, nil
}
func (m *mockRepo) GetByID(_ context.Context, _ uuid.UUID) (domain.VM, error) {
	m.called = "GetByID"
	if len(m.vms) == 0 {
		return domain.VM{}, domain.ErrNotFound
	}
	return m.vms[0], nil
}
func (m *mockRepo) Create(_ context.Context, v domain.VM) (domain.VM, error) {
	m.called = "Create"
	v.ID = uuid.New()
	m.vms = append(m.vms, v)
	return v, nil
}
func (m *mockRepo) Update(_ context.Context, v domain.VM) (domain.VM, error) {
	m.called = "Update"
	return v, nil
}
func (m *mockRepo) Delete(_ context.Context, _ uuid.UUID) error {
	m.called = "Delete"
	return nil
}

var validInput = service.CreateInput{
	Name:   "vm-valida",
	Cores:  4,
	RAMGB:  8,
	DiskGB: 100,
	OS:     "Ubuntu 22.04",
	Status: domain.StatusApagada,
}

func TestCreate_ValidInput_CallsRepo(t *testing.T) {
	repo := &mockRepo{}
	svc := service.NewVMService(repo)
	_, err := svc.Create(context.Background(), validInput)
	if err != nil {
		t.Fatalf("esperaba nil error, got: %v", err)
	}
	if repo.called != "Create" {
		t.Errorf("esperaba repo.Create, got: %q", repo.called)
	}
}

func TestCreate_Cores_Zero_Returns400(t *testing.T) {
	in := validInput
	in.Cores = 0
	svc := service.NewVMService(&mockRepo{})
	_, err := svc.Create(context.Background(), in)
	if !service.IsValidationError(err) {
		t.Fatalf("esperaba ValidationError para cores=0, got: %v", err)
	}
}

func TestCreate_Cores_Above64_Returns400(t *testing.T) {
	in := validInput
	in.Cores = 65
	svc := service.NewVMService(&mockRepo{})
	_, err := svc.Create(context.Background(), in)
	if !service.IsValidationError(err) {
		t.Fatalf("esperaba ValidationError para cores=65, got: %v", err)
	}
}

func TestCreate_InvalidOS_Returns400(t *testing.T) {
	in := validInput
	in.OS = "Arch Linux"
	svc := service.NewVMService(&mockRepo{})
	_, err := svc.Create(context.Background(), in)
	if !service.IsValidationError(err) {
		t.Fatalf("esperaba ValidationError para os=Arch Linux, got: %v", err)
	}
}

func TestCreate_NameStartsWithDash_Returns400(t *testing.T) {
	in := validInput
	in.Name = "-vm-invalido"
	svc := service.NewVMService(&mockRepo{})
	_, err := svc.Create(context.Background(), in)
	if !service.IsValidationError(err) {
		t.Fatalf("esperaba ValidationError para name=-vm-invalido, got: %v", err)
	}
}

func TestCreate_NameTooShort_Returns400(t *testing.T) {
	in := validInput
	in.Name = "ab"
	svc := service.NewVMService(&mockRepo{})
	_, err := svc.Create(context.Background(), in)
	if !service.IsValidationError(err) {
		t.Fatalf("esperaba ValidationError para name=ab, got: %v", err)
	}
}

func intPtr(v int) *int { return &v }

func TestUpdate_OnlyPatchesPresentFields(t *testing.T) {
	existing := validInput
	repo := &mockRepo{vms: []domain.VM{{
		Name: existing.Name, Cores: existing.Cores,
		RAMGB: existing.RAMGB, DiskGB: existing.DiskGB,
		OS: existing.OS, Status: existing.Status,
	}}}
	svc := service.NewVMService(repo)
	id := uuid.New()
	// Solo cambia cores; el resto nil = no tocar
	_, err := svc.Update(context.Background(), id, service.UpdateInput{Cores: intPtr(8)})
	if err != nil {
		t.Fatalf("update parcial falló: %v", err)
	}
	if repo.called != "Update" {
		t.Errorf("esperaba repo.Update, got: %q", repo.called)
	}
}

func TestUpdate_ExplicitZeroCores_IsValidationError(t *testing.T) {
	svc := service.NewVMService(&mockRepo{})
	_, err := svc.Update(context.Background(), uuid.New(), service.UpdateInput{Cores: intPtr(0)})
	if !service.IsValidationError(err) {
		t.Fatalf("cores=0 explícito debe ser ValidationError, got: %v", err)
	}
}
