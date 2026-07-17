package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"

	"github.com/google/uuid"
	"github.com/vm/api-core/internal/domain"
)

var nameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9 _-]*$`)

type VMService struct {
	repo domain.VMRepository
}

func NewVMService(repo domain.VMRepository) *VMService {
	return &VMService{repo: repo}
}

// CreateInput holds the fields for a new VM (all required).
type CreateInput struct {
	Name   string
	Cores  int
	RAMGB  int
	DiskGB int
	OS     string
	Status domain.VMStatus
}

// UpdateInput — nil = campo no enviado, no tocar. Puntero a valor = campo explícito.
type UpdateInput struct {
	Name   *string
	Cores  *int
	RAMGB  *int
	DiskGB *int
	OS     *string
	Status *domain.VMStatus
}

func (s *VMService) List(ctx context.Context) ([]domain.VM, error) {
	return s.repo.List(ctx)
}

func (s *VMService) GetByID(ctx context.Context, id uuid.UUID) (domain.VM, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *VMService) Create(ctx context.Context, in CreateInput) (domain.VM, error) {
	if err := validateCreate(in); err != nil {
		return domain.VM{}, err
	}
	return s.repo.Create(ctx, domain.VM{
		Name:   in.Name,
		Cores:  in.Cores,
		RAMGB:  in.RAMGB,
		DiskGB: in.DiskGB,
		OS:     in.OS,
		Status: in.Status,
	})
}

func (s *VMService) Update(ctx context.Context, id uuid.UUID, in UpdateInput) (domain.VM, error) {
	if err := validateUpdate(in); err != nil {
		return domain.VM{}, err
	}
	// Fetch-then-merge: solo sobrescribimos los campos que llegaron explícitos.
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.VM{}, err
	}
	if in.Name != nil {
		existing.Name = *in.Name
	}
	if in.Cores != nil {
		existing.Cores = *in.Cores
	}
	if in.RAMGB != nil {
		existing.RAMGB = *in.RAMGB
	}
	if in.DiskGB != nil {
		existing.DiskGB = *in.DiskGB
	}
	if in.OS != nil {
		existing.OS = *in.OS
	}
	if in.Status != nil {
		existing.Status = *in.Status
	}
	return s.repo.Update(ctx, existing)
}

func (s *VMService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

// --- validaciones §14.2 ---

type ValidationError struct{ msg string }

func (e *ValidationError) Error() string { return e.msg }

func validationErr(msg string) error { return &ValidationError{msg: msg} }

func IsValidationError(err error) bool {
	var ve *ValidationError
	return errors.As(err, &ve)
}

func validateCreate(in CreateInput) error {
	if err := validateName(in.Name); err != nil {
		return err
	}
	if err := validateNumericFields(in.Cores, in.RAMGB, in.DiskGB); err != nil {
		return err
	}
	if err := validateOS(in.OS); err != nil {
		return err
	}
	return validateStatus(string(in.Status))
}

func validateUpdate(in UpdateInput) error {
	if in.Name != nil {
		if err := validateName(*in.Name); err != nil {
			return err
		}
	}
	if in.Cores != nil {
		if *in.Cores < 1 || *in.Cores > 64 {
			return validationErr("cores debe estar entre 1 y 64")
		}
	}
	if in.RAMGB != nil {
		if *in.RAMGB < 1 || *in.RAMGB > 512 {
			return validationErr("ram_gb debe estar entre 1 y 512")
		}
	}
	if in.DiskGB != nil {
		if *in.DiskGB < 1 || *in.DiskGB > 4096 {
			return validationErr("disk_gb debe estar entre 1 y 4096")
		}
	}
	if in.OS != nil {
		if err := validateOS(*in.OS); err != nil {
			return err
		}
	}
	if in.Status != nil {
		if err := validateStatus(string(*in.Status)); err != nil {
			return err
		}
	}
	return nil
}

func validateName(name string) error {
	l := len(name)
	if l < 3 || l > 50 {
		return validationErr("name debe tener entre 3 y 50 caracteres")
	}
	if !nameRegex.MatchString(name) {
		return validationErr("name solo puede contener letras, dígitos, espacios, guiones y guiones bajos, y debe comenzar con un carácter alfanumérico")
	}
	return nil
}

func validateNumericFields(cores, ram, disk int) error {
	if cores < 1 || cores > 64 {
		return validationErr("cores debe estar entre 1 y 64")
	}
	if ram < 1 || ram > 512 {
		return validationErr("ram_gb debe estar entre 1 y 512")
	}
	if disk < 1 || disk > 4096 {
		return validationErr("disk_gb debe estar entre 1 y 4096")
	}
	return nil
}

func validateOS(os string) error {
	for _, valid := range domain.ValidOS {
		if os == valid {
			return nil
		}
	}
	return validationErr(fmt.Sprintf("os debe ser uno de: %v", domain.ValidOS))
}

func validateStatus(status string) error {
	if status != string(domain.StatusEncendida) && status != string(domain.StatusApagada) {
		return validationErr("status debe ser 'encendida' o 'apagada'")
	}
	return nil
}
