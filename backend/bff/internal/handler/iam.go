package handler

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// fetchIDToken obtiene un ID Token del metadata server de GCP con el audience dado.
// Disponible en Cloud Run y GCE. Solo se llama cuando APP_ENV=prod;
// en dev, el BFF usa INTERNAL_PROXY_SECRET en su lugar.
//
// El token resultante se envía como "Authorization: Bearer <token>" al api-core.
// Cloud Run con --no-allow-unauthenticated valida el token en la plataforma antes
// de que llegue al container, por lo que api-core no necesita validarlo en código.
func fetchIDToken(ctx context.Context, audience string) (string, error) {
	metaURL := "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=" + url.QueryEscape(audience)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, metaURL, nil)
	if err != nil {
		return "", fmt.Errorf("metadata request: %w", err)
	}
	req.Header.Set("Metadata-Flavor", "Google")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("metadata server inalcanzable: %w", err)
	}
	defer resp.Body.Close()
	token, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("leer ID token: %w", err)
	}
	return string(token), nil
}
