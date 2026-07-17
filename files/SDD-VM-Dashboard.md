# SDD — VM Dashboard (Prueba Técnica IFX Networks)
**Versión:** v1
**Autor:** Germán
**Fecha:** 2026-07-16

## 1. Objetivo

Diseñar e implementar una SPA de gestión de VMs con API RESTful de soporte, cumpliendo
los requisitos de UI/UX premium, seguridad (JWT en cookie HttpOnly), RBAC por rol y
actualización en tiempo real vía WebSockets. Despliegue en GCP con arquitectura BFF.

## 2. Alcance

**Incluido:**
- SPA (React) con login, dashboard, CRUD de VMs, panel de recursos
- BFF (Go) — autenticación, sesión, proxy hacia API Core
- API Core (Go) — CRUD de VMs, hub de WebSockets, persistencia
- Despliegue GCP: Cloud Run (x3), Cloud SQL, Secret Manager, IAM service-to-service
- Documentación: README, diagrama de arquitectura, Bitácora de IA

**Fuera de alcance:**
- Multi-tenancy, facturación, gestión de usuarios (solo seed de 2 usuarios: admin/cliente)
- CI/CD completo (deploy manual documentado es suficiente)

## 3. Arquitectura

```
Browser (SPA)
   │  HTTPS, cookie SameSite=Strict (mismo dominio)
   ▼
[Frontend] ──/api/*──► [BFF - Cloud Run] ──ID Token (IAM)──► [API Core - Cloud Run, privado]
                                                                     │
                                                                     ▼
                                                              Cloud SQL (Postgres, IP privada)
```

- **Frontend**: Cloud Run sirviendo build estático (nginx) o Cloud Storage+CDN
- **BFF**: único componente que conoce el JWT de sesión. Setea/lee la cookie HttpOnly.
  No tiene lógica de negocio, solo autentica y reenvía al API Core con un ID Token de GCP.
- **API Core**: `--no-allow-unauthenticated`. Solo la service account del BFF puede invocarlo
  (patrón estándar de `SERVICE_URL` audience validation con OIDC en Cloud Run).
- **WebSockets**: expuestos por el API Core, el BFF actúa como proxy WS transparente hacia el frontend.

## 4. Modelo de datos

```sql
users (id, email, password_hash, role ENUM('admin','cliente'), created_at)

vms (
  id UUID PK,
  name VARCHAR NOT NULL,
  cores INT NOT NULL CHECK (cores > 0),
  ram_gb INT NOT NULL CHECK (ram_gb > 0),
  disk_gb INT NOT NULL CHECK (disk_gb > 0),
  os VARCHAR NOT NULL,
  status ENUM('encendida','apagada') DEFAULT 'apagada',
  created_at, updated_at
)
```

## 5. Contratos de API

### BFF (público, `/api/*`)
| Método | Ruta | Descripción | Rol |
|---|---|---|---|
| POST | /api/login | Valida credenciales, setea cookie HttpOnly | público |
| POST | /api/logout | Invalida sesión | autenticado |
| GET | /api/me | Retorna user + rol (para hidratar estado front) | autenticado |
| GET | /api/vms | Proxy a API Core | admin, cliente |
| POST | /api/vms | Proxy a API Core | admin |
| PUT | /api/vms/{id} | Proxy a API Core | admin |
| DELETE | /api/vms/{id} | Proxy a API Core | admin |
| WS | /api/ws | Proxy WS hacia API Core | autenticado |

### API Core (interno, solo invocable por BFF)
Mismos endpoints `/vms`, sin lógica de cookie — recibe identidad ya validada
vía header inyectado por el BFF (`X-User-Role`, `X-User-Id`) tras validar el ID Token de IAM.

## 6. Flujos clave

**Login:**
1. Frontend → `POST /api/login` (email, password)
2. BFF valida contra API Core (o DB directa si BFF tiene acceso), genera JWT de sesión
3. BFF responde `Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Strict` + body con `{user, role}`
4. Frontend guarda `{user, role}` en estado global (memoria, NO localStorage) — el token nunca lo toca

**CRUD de VM (con Optimistic UI):**
1. Usuario crea/edita/elimina → frontend actualiza la UI **inmediatamente** (estado optimista)
2. Petición viaja con la cookie automáticamente
3. Si la API responde error → frontend revierte al estado anterior + toast de error
4. Si responde éxito → se reconcilia con la respuesta real del servidor

**Actualización en tiempo real:**
1. Admin actualiza estado de una VM → API Core persiste → emite evento por WS hub
2. BFF reenvía el mensaje a todos los clientes conectados
3. Frontend recibe evento, actualiza la tarjeta correspondiente con animación

## 7. Seguridad

- Cookie HttpOnly + Secure + SameSite=Strict (mismo dominio front/BFF vía Load Balancer)
- API Core sin exposición pública, invocación solo por IAM (service account del BFF)
- Secretos (clave JWT, credenciales DB) en Secret Manager, nunca en código
- Validaciones de input en backend (no solo frontend) — cores/ram/disk > 0, nombre con formato válido
- Rol verificado en cada endpoint del BFF antes de proxyear (defensa en profundidad, no solo UI oculta botones)

## 8. Infraestructura GCP

| Recurso | Detalle |
|---|---|
| Cloud Run `frontend` | público, sirve SPA |
| Cloud Run `bff` | público, SA propia con `roles/run.invoker` sobre `api-core` |
| Cloud Run `api-core` | privado, acepta solo SA del bff |
| Cloud SQL | Postgres, IP privada, Serverless VPC Connector |
| Secret Manager | `jwt-signing-key`, `db-credentials`, `internal-proxy-secret` — montados como variables de entorno en cada Cloud Run; nunca hardcodeados en Dockerfile ni en configs de deploy |
| Load Balancer | routing `/api/*` → bff, `/*` → frontend, mismo dominio |

**Cuenta y proyecto GCP:** se crea un **proyecto nuevo y aislado** (ej. `ifx-vm-dashboard`)
para esta prueba. Esto evita:
- Fricción de mezclar recursos con proyectos existentes
- Riesgo de dejar recursos de la prueba corriendo dentro de un proyecto productivo

Al finalizar la evaluación, el proyecto se puede apagar o eliminar sin afectar nada más.

## 9. Plan de implementación (2 días)

Ver documento de Decisiones Técnicas §6 para el desglose hora a hora.

## 10. Gobernanza del uso de IA (captura de Bitácora)

Riesgo identificado: si la Bitácora de IA se escribe de memoria al final del Día 2,
va a quedar genérica o incompleta — justo lo que IFX dice que va a evaluar
("tu capacidad para guiar a la IA", no solo el resultado final). Para evitarlo,
la captura es un paso obligatorio del proceso, no una tarea de cierre:

**Regla de captura en vivo:**
Cada vez que se le delegue una tarea "pesada" a un agente (generar el login, un CRUD,
la config de WebSockets, un componente completo), inmediatamente después se anota en
`BITACORA.md` (borrador, en la raíz del repo):
1. Herramienta usada (Claude Code, Claude.ai, etc.)
2. Qué se delegó exactamente (prompt real, no resumido)
3. Qué tuvo que corregirse/ajustarse manualmente después

**Gate de verificación (antes de considerar cerrado el Día 2):**
- [ ] `BITACORA.md` tiene al menos una entrada por cada módulo grande (auth, CRUD, WS, UI)
- [ ] Incluye 1-2 prompts *verbatim* de los que resolvieron algo complejo (no parafraseados)
- [ ] Germán revisó cada entrada y confirma que refleja lo que realmente pasó
  (no lo que el agente dice que hizo — verificado contra el código resultante)
- [ ] La sección final en el README.md se redacta a partir de `BITACORA.md`, no al revés

Esto asegura que la Bitácora refleje intervención real y verificable, en vez de un
resumen genérico generado al final — que es exactamente lo que un evaluador experimentado
detecta rápido.

## 12. Harness de Implementación

Objetivo: que la revisión de cada entrega del agente sea **rápida y puntual**, no una
lectura exhaustiva de todo el código. Se logra limitando el tamaño de lo que se revisa
por vez y usando una tarjeta corta de sí/no en vez de prosa.

**Regla de oro:** un módulo del SDD (§5/§6) = una sesión con el agente = una revisión = un commit.
Nunca "hazme todo" de una — si el agente entrega más de un módulo junto, se corta la revisión
en pedazos igual, no se aprueba en bloque.

### Antes de codear — plan
Se le pide al agente el plan antes del código ("no escribas código todavía, dime tu plan").
Se compara el plan contra 1-2 líneas del SDD del módulo correspondiente. Si el plan ya se
desvía, se corrige ahí — más barato que corregir código.

### Tarjeta de revisión (por módulo, ~2 min c/u)

```
Módulo: ___________________

[ ] El diff toca SOLO los archivos esperados para este módulo
[ ] Respeta el contrato de la sección correspondiente del SDD (§5/§6/§7)
[ ] Si aplica seguridad (auth, roles, cookie): revisado línea por línea (sin excepción)
[ ] El agente generó un test para el camino crítico del módulo, y el test pasa
[ ] No hay TODOs, mocks o hardcodes que deberían ser reales

→ Si las 5 pasan: commit + entrada en BITACORA.md
→ Si alguna falla: se corrige ANTES de avanzar al siguiente módulo
```

**Por qué solo el punto de seguridad exige lectura línea por línea:** no toda la
superficie de código merece el mismo nivel de escrutinio. Auth, cookies y roles son
donde un error es invisible hasta que alguien lo explota — ahí no se negocia. El resto
(estilos, textos, estructura de componentes) se valida con la tarjeta y el test, no leyendo
cada línea.

### Diff, no archivo completo
Se revisa `git diff`, nunca "aquí está el archivo completo de nuevo". Un diff de 40 líneas
se lee con atención real; un archivo de 400 se hojea.

### Orden sugerido de módulos (alineado al plan del Día 1-2 en Decisiones Técnicas §6)
1. Modelo de datos + migraciones
2. API Core: CRUD de VMs (sin auth todavía, mockeado)
3. Auth: JWT + cookie HttpOnly (BFF) — **máximo escrutinio**
4. Middleware de roles + IAM service-to-service — **máximo escrutinio**
5. Frontend: login + rutas protegidas
6. Frontend: CRUD + Optimistic UI
7. WebSockets (backend + frontend)
8. Estilos, dark mode, gráficos, pulido visual

## 14. Especificación de Frontend

Esta sección existe porque el agente no puede inferir lo que no está escrito. Todo lo
listado aquí es requisito explícito del PDF (Parte 1) y debe estar presente sin excepción.

### 14.1 Páginas y componentes

**Login** (ruta pública)
- Form: email, password, botón submit
- Validación en tiempo real: email formato válido, password no vacío
- Error visible si credenciales inválidas (toast + mensaje inline)

**Dashboard** (ruta privada, layout compartido)
- Header: nombre de usuario, rol, botón logout, toggle dark mode
- Panel de Data Visualization (ver 14.3)
- Listado de VMs (grid de tarjetas o tabla)
- Botón "Nueva VM" — **visible solo si rol = admin** (no renderizado en el DOM para cliente, no solo oculto por CSS)

**Listado de VMs**
- Cada tarjeta/fila: nombre, cores, RAM, disco, OS, estado (badge visual encendida/apagada)
- Acciones editar/eliminar — **solo renderizadas si rol = admin**
- Empty state si no hay VMs: ilustración/mensaje + botón "Crear primera VM" (admin) o mensaje neutro (cliente)

**Crear/Editar VM** (modal o página, admin únicamente — ruta protegida por rol, no solo por sesión)
- Campos: name, cores, ram, disk, os, status
- Validaciones en tiempo real (ver 14.2)
- Optimistic UI al guardar (ver SDD §6)

### 14.2 Reglas de validación (form de VM)

| Campo | Regla |
|---|---|
| name | requerido, 3-50 caracteres, sin caracteres especiales fuera de `- _` |
| cores | entero, 1-64 |
| ram | entero, 1-512 (GB), no negativo ni cero |
| disk | entero, 1-4096 (GB), no negativo ni cero |
| os | requerido, select con lista fija (ej. Ubuntu, Windows Server, CentOS, Debian) |

Todas las validaciones se muestran **al perder foco del campo** (no solo al hacer submit),
con mensaje de error específico bajo el campo.

### 14.3 Panel de Data Visualization

Un gráfico (Recharts) que muestra, sobre el conjunto de VMs con `status = 'encendida'` únicamente:
- Suma total de cores
- Suma total de RAM (GB)
- Suma total de disco (GB)

Se recalcula reactivamente cuando cambia el listado (crear/eliminar/cambiar estado),
incluyendo bajo Optimistic UI (el gráfico también debe "adelantarse" y luego revertir si falla).

### 14.4 Estados de UI obligatorios (aplican a Dashboard y Listado)

| Estado | Comportamiento esperado |
|---|---|
| Loading inicial | Skeleton (no spinner genérico) con la forma aproximada del contenido real |
| Error de carga | Mensaje + botón "Reintentar", nunca pantalla en blanco |
| Vacío (sin VMs) | Empty state ilustrativo, diferenciado por rol |
| Acción exitosa (crear/editar/eliminar) | Toast de éxito, auto-dismiss ~3s |
| Acción fallida | Toast de error + rollback visible del Optimistic UI |
| Actualización en tiempo real (WS) | Animación breve (highlight/pulse) sobre la tarjeta afectada, ~1s |

### 14.5 Dark mode

- Toggle persistente durante la sesión (estado en Zustand, no requiere persistir entre sesiones salvo que se quiera de plus)
- Aplica a toda la superficie: fondo, tarjetas, texto, gráficos (Recharts respeta el tema), inputs
- Contraste verificado (no texto gris sobre gris) — usar tokens de color consistentes, no colores sueltos por componente

### 14.6 Responsive

No está explícito en el PDF pero "SPA altamente pulida" lo implica. Mínimo: que el
dashboard no se rompa en viewport de laptop pequeña (1280px) y sea usable en tablet.
Mobile no es prioridad para esta prueba.

## 15. Criterios de aceptación

- [ ] Cliente no ve botones de crear/editar/eliminar (no solo deshabilitados)
- [ ] Token JWT nunca visible en DevTools > Application > localStorage
- [ ] Optimistic UI revierte correctamente ante error simulado (ej. 500 forzado)
- [ ] WS actualiza tarjeta en <1s tras cambio de estado por admin
- [ ] `docker-compose up` levanta todo el stack local con seed de usuarios
- [ ] Deploy en GCP accesible públicamente vía HTTPS
- [ ] Bitácora de IA verificada contra `BITACORA.md` (no redactada de memoria al cierre)
