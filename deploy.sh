#!/usr/bin/env bash
# deploy.sh — VM Dashboard: bff (público) + api-core (privado IAM)
# Uso: DATABASE_URL='postgres://...' bash deploy.sh
set -euo pipefail

# ─── CONFIG ───────────────────────────────────────────────────────────────────
# Acepta PROJECT_ID desde entorno; si no está, usa un nombre fijo (no genera uno nuevo)
PROJECT_ID="${PROJECT_ID:-vm-dashboard-ifx}"
REGION="us-central1"

# ─── PRE-FLIGHT ───────────────────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo ""
  echo "  ERROR: DATABASE_URL no está definida."
  echo ""
  echo "  Opción rápida (~1 min): crea una DB gratis en https://neon.tech"
  echo "  Luego exporta:  export DATABASE_URL='postgres://user:pass@host/db?sslmode=require'"
  echo ""
  echo "  Después corre las migraciones:"
  echo "    psql \$DATABASE_URL -f backend/api-core/migrations/000001_create_users.up.sql"
  echo "    psql \$DATABASE_URL -f backend/api-core/migrations/000002_create_vms.up.sql"
  echo "    psql \$DATABASE_URL -f backend/api-core/migrations/seed.sql  # opcional"
  echo ""
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo ""
echo "══════════════════════════════════════════════"
echo "  VM Dashboard Deploy"
echo "  Proyecto: $PROJECT_ID"
echo "  Región:   $REGION"
echo "══════════════════════════════════════════════"

# ─── 1. PROYECTO ──────────────────────────────────────────────────────────────
echo ""
echo "[1/8] Proyecto GCP: $PROJECT_ID"
if gcloud projects describe "$PROJECT_ID" --quiet &>/dev/null; then
  echo "  → Proyecto ya existe, reutilizando."
else
  echo "  → Creando proyecto nuevo..."
  gcloud projects create "$PROJECT_ID" --name="VM Dashboard" --quiet
  BILLING_ACCOUNT=$(gcloud billing accounts list \
    --format="value(name)" --filter="open=true" | head -1)
  if [[ -z "$BILLING_ACCOUNT" ]]; then
    echo "ERROR: No se encontró una cuenta de billing activa."
    echo "Abre https://console.cloud.google.com/billing y vincula una cuenta."
    exit 1
  fi
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT" --quiet
fi
gcloud config set project "$PROJECT_ID" --quiet

# ─── 2. APIs ──────────────────────────────────────────────────────────────────
echo ""
echo "[2/8] Habilitando APIs (30-60 seg)..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project="$PROJECT_ID" --quiet

# ─── 3. ARTIFACT REGISTRY ─────────────────────────────────────────────────────
echo ""
echo "[3/8] Artifact Registry: vm-images"
if gcloud artifacts repositories describe vm-images \
    --location="$REGION" --project="$PROJECT_ID" --quiet &>/dev/null; then
  echo "  → Repositorio ya existe, reutilizando."
else
  echo "  → Creando repositorio..."
  gcloud artifacts repositories create vm-images \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID" --quiet
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/vm-images"

# ─── 4. SERVICE ACCOUNT ───────────────────────────────────────────────────────
echo ""
echo "[4/8] Service Account: bff-sa"
BFF_SA="bff-sa@${PROJECT_ID}.iam.gserviceaccount.com"
if gcloud iam service-accounts describe "$BFF_SA" --project="$PROJECT_ID" --quiet &>/dev/null; then
  echo "  → Service account ya existe, reutilizando."
else
  echo "  → Creando service account..."
  gcloud iam service-accounts create bff-sa \
    --display-name="BFF Service Account" \
    --project="$PROJECT_ID" --quiet
fi

# ─── 5. JWT_SECRET ────────────────────────────────────────────────────────────
echo ""
echo "[5/8] Secret Manager: jwt-secret"
if gcloud secrets describe jwt-secret --project="$PROJECT_ID" --quiet &>/dev/null; then
  echo "  → Secret ya existe, reutilizando (no se regenera)."
else
  echo "  → Creando secret..."
  JWT_SECRET=$(openssl rand -hex 32)
  echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret \
    --data-file=- \
    --project="$PROJECT_ID" --quiet
fi

gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:${BFF_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$PROJECT_ID" --quiet

# ─── 6. BUILD + PUSH ──────────────────────────────────────────────────────────
echo ""
echo "[6/8] Construyendo y pusheando imágenes Docker..."

# api-core — context propio
docker buildx build --platform=linux/amd64 --push \
  -t "${IMAGE_BASE}/api-core:latest" \
  -f "${REPO_ROOT}/backend/api-core/Dockerfile" \
  "${REPO_ROOT}/backend/api-core"

# bff — context es la raíz del repo (necesita acceso a frontend/)
docker buildx build --platform=linux/amd64 --push \
  -t "${IMAGE_BASE}/bff:latest" \
  -f "${REPO_ROOT}/backend/bff/Dockerfile" \
  "${REPO_ROOT}"

# ─── 7. DEPLOY API-CORE (PRIVADO) ─────────────────────────────────────────────
echo ""
echo "[7/8] Desplegando api-core (privado, sin acceso público)..."
gcloud run deploy api-core \
  --image="${IMAGE_BASE}/api-core:latest" \
  --region="$REGION" \
  --platform=managed \
  --no-allow-unauthenticated \
  --set-env-vars="APP_ENV=prod,DATABASE_URL=${DATABASE_URL}" \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=2 \
  --project="$PROJECT_ID" --quiet

API_CORE_URL=$(gcloud run services describe api-core \
  --region="$REGION" \
  --format="value(status.url)" \
  --project="$PROJECT_ID")

echo "  api-core URL: $API_CORE_URL"

# bff-sa puede invocar api-core via IAM
gcloud run services add-iam-policy-binding api-core \
  --region="$REGION" \
  --member="serviceAccount:${BFF_SA}" \
  --role="roles/run.invoker" \
  --project="$PROJECT_ID" --quiet

# ─── 8. DEPLOY BFF (PÚBLICO) ──────────────────────────────────────────────────
echo ""
echo "[8/8] Desplegando bff (público)..."
gcloud run deploy bff \
  --image="${IMAGE_BASE}/bff:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --service-account="$BFF_SA" \
  --set-env-vars="APP_ENV=prod,API_CORE_URL=${API_CORE_URL},DATABASE_URL=${DATABASE_URL}" \
  --set-secrets="JWT_SECRET=jwt-secret:latest" \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --project="$PROJECT_ID" --quiet

BFF_URL=$(gcloud run services describe bff \
  --region="$REGION" \
  --format="value(status.url)" \
  --project="$PROJECT_ID")

echo ""
echo "══════════════════════════════════════════════"
echo "  DEPLOY COMPLETO"
echo ""
echo "  App (BFF público):  $BFF_URL"
echo "  api-core (privado): $API_CORE_URL"
echo "  Proyecto GCP:       $PROJECT_ID"
echo ""
echo "  Guarda el JWT_SECRET (no se muestra de nuevo):"
echo "  gcloud secrets versions access latest --secret=jwt-secret --project=$PROJECT_ID"
echo "══════════════════════════════════════════════"
