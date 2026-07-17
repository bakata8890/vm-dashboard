package auth_test

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/vm/bff/internal/auth"
)

const testSecret = "test-secret-key"

func TestSign_Verify_Roundtrip(t *testing.T) {
	svc := auth.NewJWTService(testSecret)
	token, err := svc.Sign("user-1", "test@vm.dev", "admin")
	if err != nil {
		t.Fatalf("Sign falló: %v", err)
	}
	claims, err := svc.Verify(token)
	if err != nil {
		t.Fatalf("Verify falló: %v", err)
	}
	if claims.Sub != "user-1" || claims.Email != "test@vm.dev" || claims.Role != "admin" {
		t.Errorf("claims incorrectos: %+v", claims)
	}
}

func TestVerify_ExpiredToken_ReturnsError(t *testing.T) {
	svc := auth.NewJWTService(testSecret)
	// Crea un token ya expirado manipulando las claims directamente
	claims := auth.Claims{
		Sub:   "user-1",
		Email: "test@vm.dev",
		Role:  "admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	}
	token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	_, err := svc.Verify(token)
	if err == nil {
		t.Fatal("esperaba error para token expirado, got nil")
	}
}

func TestVerify_TamperedSignature_ReturnsError(t *testing.T) {
	svc := auth.NewJWTService(testSecret)
	token, _ := svc.Sign("user-1", "test@vm.dev", "admin")

	// Altera el último byte de la firma (tercera parte del JWT)
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatal("JWT no tiene 3 partes")
	}
	sig := []byte(parts[2])
	sig[len(sig)-1] ^= 0xFF // flip bits del último byte
	tampered := parts[0] + "." + parts[1] + "." + string(sig)

	_, err := svc.Verify(tampered)
	if err == nil {
		t.Fatal("firma manipulada debe retornar error, got nil")
	}
}

func TestVerify_WrongSecret_ReturnsError(t *testing.T) {
	svc1 := auth.NewJWTService("secret-A")
	svc2 := auth.NewJWTService("secret-B")
	token, _ := svc1.Sign("user-1", "test@vm.dev", "admin")
	_, err := svc2.Verify(token)
	if err == nil {
		t.Fatal("secret incorrecto debe retornar error, got nil")
	}
}
