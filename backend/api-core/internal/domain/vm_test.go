package domain_test

import (
	"testing"

	"github.com/vm/api-core/internal/domain"
)

// Guarda contra drift entre las constantes Go y los CHECK constraints SQL.
// Si alguien cambia ValidOS aquí sin actualizar la migración (o viceversa),
// este test falla antes de que llegue a producción.
func TestValidOS_MatchesMigrationConstraint(t *testing.T) {
	expected := [5]string{
		"Ubuntu 22.04",
		"Windows Server 2022",
		"CentOS 8",
		"Debian 12",
		"Rocky Linux 9",
	}
	if domain.ValidOS != expected {
		t.Errorf("ValidOS Go = %v; SQL constraint espera %v", domain.ValidOS, expected)
	}
}

func TestVMStatus_Constants(t *testing.T) {
	if domain.StatusEncendida != "encendida" {
		t.Errorf("StatusEncendida = %q; quiere %q", domain.StatusEncendida, "encendida")
	}
	if domain.StatusApagada != "apagada" {
		t.Errorf("StatusApagada = %q; quiere %q", domain.StatusApagada, "apagada")
	}
}

func TestRole_Constants(t *testing.T) {
	if domain.RoleAdmin != "admin" {
		t.Errorf("RoleAdmin = %q; quiere %q", domain.RoleAdmin, "admin")
	}
	if domain.RoleCliente != "cliente" {
		t.Errorf("RoleCliente = %q; quiere %q", domain.RoleCliente, "cliente")
	}
}
