DATABASE_URL ?= postgres://vm_user:vm_pass@localhost:5433/vm_db?sslmode=disable

.PHONY: db/up db/down migrate/up migrate/down db/seed

db/up:
	docker compose up -d postgres

db/down:
	docker compose down

migrate/up:
	migrate -path backend/api-core/migrations -database "$(DATABASE_URL)" up

migrate/down:
	migrate -path backend/api-core/migrations -database "$(DATABASE_URL)" down

db/seed:
	psql "$(DATABASE_URL)" -f backend/api-core/migrations/seed.sql
