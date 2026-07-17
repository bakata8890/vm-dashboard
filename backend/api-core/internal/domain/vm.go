package domain

import (
	"time"

	"github.com/google/uuid"
)

type VMStatus string

const (
	StatusEncendida VMStatus = "encendida"
	StatusApagada   VMStatus = "apagada"
)

var ValidOS = [5]string{
	"Ubuntu 22.04",
	"Windows Server 2022",
	"CentOS 8",
	"Debian 12",
	"Rocky Linux 9",
}

type VM struct {
	ID        uuid.UUID
	Name      string
	Cores     int
	RAMGB     int
	DiskGB    int
	OS        string
	Status    VMStatus
	CreatedAt time.Time
	UpdatedAt time.Time
}
