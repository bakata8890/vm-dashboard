package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vm/api-core/internal/domain"
)

type VMRepo struct {
	pool *pgxpool.Pool
}

func NewVMRepo(pool *pgxpool.Pool) *VMRepo {
	return &VMRepo{pool: pool}
}

func (r *VMRepo) List(ctx context.Context) ([]domain.VM, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, cores, ram_gb, disk_gb, os, status, created_at, updated_at
		FROM vms ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list vms: %w", err)
	}
	defer rows.Close()

	var vms []domain.VM
	for rows.Next() {
		var v domain.VM
		if err := rows.Scan(&v.ID, &v.Name, &v.Cores, &v.RAMGB, &v.DiskGB,
			&v.OS, &v.Status, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan vm: %w", err)
		}
		vms = append(vms, v)
	}
	if vms == nil {
		vms = []domain.VM{}
	}
	return vms, rows.Err()
}

func (r *VMRepo) GetByID(ctx context.Context, id uuid.UUID) (domain.VM, error) {
	var v domain.VM
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, cores, ram_gb, disk_gb, os, status, created_at, updated_at
		FROM vms WHERE id = $1`, id).
		Scan(&v.ID, &v.Name, &v.Cores, &v.RAMGB, &v.DiskGB,
			&v.OS, &v.Status, &v.CreatedAt, &v.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.VM{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.VM{}, fmt.Errorf("get vm: %w", err)
	}
	return v, nil
}

func (r *VMRepo) Create(ctx context.Context, v domain.VM) (domain.VM, error) {
	var created domain.VM
	err := r.pool.QueryRow(ctx, `
		INSERT INTO vms (name, cores, ram_gb, disk_gb, os, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, cores, ram_gb, disk_gb, os, status, created_at, updated_at`,
		v.Name, v.Cores, v.RAMGB, v.DiskGB, v.OS, v.Status).
		Scan(&created.ID, &created.Name, &created.Cores, &created.RAMGB, &created.DiskGB,
			&created.OS, &created.Status, &created.CreatedAt, &created.UpdatedAt)
	if err != nil {
		return domain.VM{}, mapDBErr(err)
	}
	return created, nil
}

func (r *VMRepo) Update(ctx context.Context, v domain.VM) (domain.VM, error) {
	var updated domain.VM
	err := r.pool.QueryRow(ctx, `
		UPDATE vms SET
			name    = $2,
			cores   = $3,
			ram_gb  = $4,
			disk_gb = $5,
			os      = $6,
			status  = $7,
			updated_at = now()
		WHERE id = $1
		RETURNING id, name, cores, ram_gb, disk_gb, os, status, created_at, updated_at`,
		v.ID, v.Name, v.Cores, v.RAMGB, v.DiskGB, v.OS, string(v.Status)).
		Scan(&updated.ID, &updated.Name, &updated.Cores, &updated.RAMGB, &updated.DiskGB,
			&updated.OS, &updated.Status, &updated.CreatedAt, &updated.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.VM{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.VM{}, mapDBErr(err)
	}
	return updated, nil
}

func (r *VMRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM vms WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete vm: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// mapDBErr convierte error 23514 (check constraint) a ErrCheckConstraint.
// El resto pasa como error genérico de DB.
func mapDBErr(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23514" {
		return domain.ErrCheckConstraint
	}
	return fmt.Errorf("db error: %w", err)
}
