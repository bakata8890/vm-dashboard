package domain

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	ErrNotFound        = errors.New("not found")
	ErrCheckConstraint = errors.New("check constraint violation")
)

type VMRepository interface {
	List(ctx context.Context) ([]VM, error)
	GetByID(ctx context.Context, id uuid.UUID) (VM, error)
	Create(ctx context.Context, vm VM) (VM, error)
	Update(ctx context.Context, vm VM) (VM, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (User, error)
	GetByID(ctx context.Context, id uuid.UUID) (User, error)
}
