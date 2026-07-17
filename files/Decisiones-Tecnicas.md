# Decisiones Técnicas — VM Dashboard

## 1. Por qué BFF en vez de backend directo

El requisito de la prueba (cookie HttpOnly, JWT nunca en el body/localStorage) empuja
naturalmente a un patrón BFF: el frontend jamás debe saber que un token existe. Separar
BFF de API Core además nos permite aplicar el mismo control de acceso service-to-service
que ya usaste en FairRide (SDD v5, `SERVICE_URL` audience validation) — reutilización directa
de un patrón que ya validaste en producción, no algo nuevo que aprender.

## 2. Por qué Go para ambos servicios

Es tu stack más fuerte, arquitectura hexagonal ya interiorizada, y te permite mover
velocidad de desarrollo hacia el frontend, que es donde más pesa la evaluación y donde
menos terreno dominas. No tiene sentido gastar horas de aprendizaje en un backend framework
nuevo cuando el riesgo real del ejercicio está en React.

## 3. Estado global y Optimistic UI — la parte que te pone nervioso

Vamos a desmontar esto porque conceptualmente **ya lo hiciste**, solo que del otro lado.

### La idea central
Optimistic UI es exactamente lo mismo que optimistic locking, pero en el cliente:
asumes que la operación va a tener éxito, actualizas el estado *antes* de tener
confirmación del servidor, y si el servidor te dice que no, revierte. Es el mismo
principio de "actúa primero, reconcilia después" que usaste en la corrección de la
race condition en KVS — solo que ahí la reconciliación era contra la base de datos,
y aquí es contra la respuesta HTTP.

### Cómo se implementa en la práctica (con React Query)

React Query tiene un mecanismo de tres pasos para esto, `useMutation`:

```
onMutate:   se ejecuta ANTES de mandar la petición.
            Aquí guardas el estado actual (snapshot) y actualizas
            el cache local como si ya hubiera funcionado.

onError:    si la petición falla, usas el snapshot guardado en
            onMutate para devolver el cache al estado anterior.

onSettled:  pase lo que pase (éxito o error), vuelves a pedir
            los datos reales al servidor para asegurar consistencia
            (esto es tu "reconciliación final").
```

Ejemplo conceptual para eliminar una VM:

```javascript
useMutation({
  mutationFn: (id) => deleteVM(id),
  onMutate: async (id) => {
    await queryClient.cancelQueries(['vms']);
    const snapshot = queryClient.getQueryData(['vms']);
    // actualización optimista: la quito del cache YA
    queryClient.setQueryData(['vms'], old => old.filter(vm => vm.id !== id));
    return { snapshot }; // esto viaja a onError
  },
  onError: (err, id, context) => {
    // algo falló, regreso al estado anterior
    queryClient.setQueryData(['vms'], context.snapshot);
    toast.error('No se pudo eliminar la VM');
  },
  onSettled: () => {
    queryClient.invalidateQueries(['vms']); // pido la verdad al server
  },
})
```

**El punto clave para que pierdas el miedo:** no estás inventando un sistema de estado
distribuido nuevo. React Query ya trae este patrón resuelto — tu trabajo no es
implementar el mecanismo desde cero, es *conectarlo correctamente* a cada mutación
(crear, editar, eliminar) y decidir qué snapshot guardar. Es más config que lógica nueva.

### Por qué React Query y no Redux/Zustand para esto

Redux/Zustand son buenos para estado de UI (¿está abierto el modal?, ¿qué tema está activo?).
Pero el estado de "datos del servidor" (las VMs) es un caso distinto — tiene cache,
expiración, reintentos, invalidación. React Query fue diseñado específicamente para eso,
así que resuelve el 80% del optimistic UI por vos. Usaremos:

- **React Query** → estado del servidor (VMs, usuario autenticado)
- **Zustand** → estado puro de UI (tema oscuro, modales, filtros) — mínimo boilerplate

## 4. Por qué Recharts sobre Chart.js

Recharts es componentes React nativos (declarativo, se integra con el árbol de componentes
y el estado sin wrappers). Chart.js es imperativo y requiere más "glue code". Para 2 días,
Recharts es menos fricción.

## 5. Por qué SameSite=Strict y no None

Al servir frontend y BFF bajo el mismo dominio (Load Balancer con path routing), no
necesitamos `SameSite=None` (que exige contexto cross-site y es más frágil ante
configuraciones de navegador). `Strict` es más seguro y es posible precisamente porque
evitamos la arquitectura típica de "frontend en Vercel, backend en otro dominio".

## 6. Plan de implementación — desglose

**Día 1**
| Horas | Tarea |
|---|---|
| 0-2h | Scaffolding monorepo, OpenAPI, modelo VM, migraciones |
| 2-5h | API Core: CRUD + middleware IAM + WS hub |
| 5-7h | BFF: login, cookie, proxy, validación de ID Token |
| 7-9h | GCP: Cloud SQL, Secret Manager, SAs, IAM bindings, deploy inicial |

**Día 2**
| Horas | Tarea |
|---|---|
| 0-4h | SPA: login, dashboard RBAC, listado, CRUD + Optimistic UI (React Query) |
| 4-6h | Dark mode, skeletons, toasts, gráficos Recharts |
| 6-7h | WS en frontend (actualización en vivo) |
| 7-8h | Load Balancer, dominio, TLS |
| 8-10h | README, diagrama, Bitácora de IA, pruebas finales |

## 7. Riesgos identificados

- **Real-time vía Cloud Run**: requiere activar session affinity; validar temprano en Día 1,
  no dejarlo para el final por si hay que ajustar la config de Cloud Run.
- **Tiempo en frontend**: si el Optimistic UI toma más de lo estimado, el fallback es
  degradar a UI pesimista (loading state simple) en los módulos menos críticos y dejarlo
  bien implementado solo en el flujo principal (crear/eliminar VM), documentándolo como
  decisión consciente en el README.

## 9. Arquitectura interna de api-core — hexagonal

Cada capa tiene una responsabilidad única y solo depende hacia adentro:

```
api-core/internal/
  domain/              ← entidades + interfaces (ports)
    vm.go
    user.go
    repository.go      ← interfaces VMRepository, UserRepository
  infrastructure/
    postgres/          ← adapters SQL (implementan las interfaces de domain)
      vm_repo.go
      user_repo.go
  service/             ← lógica de negocio / casos de uso
    vm_service.go
  handler/             ← entrega HTTP
    vm_handler.go
```

**Regla de dependencias:** `handler → service → domain ← infrastructure/postgres`.
`infrastructure` conoce `domain`; `domain` no importa nada de `infrastructure`.
**HTTP router:** `chi` — sin framework pesado, middleware compatible con `net/http` estándar.
**Migraciones:** `golang-migrate` con driver `pgx/v5`, archivos `000001_*.up/down.sql` en `migrations/`.

**Constraint de `name` en SQL:**
```sql
CHECK (name ~ '^[a-zA-Z0-9][a-zA-Z0-9 _-]*$')
```
El ancla `^[a-zA-Z0-9]` impide nombres que empiecen con espacio o guion — casos que el CHECK de `length >= 3` no cubre. Verificado contra Postgres real (casos 4 y 5 de BITACORA Módulo 1 backend).
La validación en Go (`service/vm_service.go`) replica la misma regex para devolver 400 antes de tocar la DB.

## 8. Convención de selectores Zustand

Un selector que devuelve un objeto o array nuevo en cada llamada hace que
`useSyncExternalStore` detecte un cambio en cada render y provoca un loop infinito
("Maximum update depth exceeded"). Bug encontrado en Módulo 1 (LoginPage).

**Regla obligatoria para todos los módulos:**

```ts
// ✓ CORRECTO — un valor por llamada
const user    = useAuthStore((s) => s.user);
const setUser = useAuthStore((s) => s.setUser);

// ✓ CORRECTO — si se necesitan varios campos juntos, usar useShallow
import { useShallow } from 'zustand/react/shallow';
const { user, setUser } = useAuthStore(useShallow((s) => ({ user: s.user, setUser: s.setUser })));

// ✗ INCORRECTO — crea un objeto nuevo en cada render → loop infinito
const { user, setUser } = useAuthStore((s) => ({ user: s.user, setUser: s.setUser }));
```

No existe regla de ESLint que detecte este patrón automáticamente.
La prevención es esta convención + revisión de cualquier selector que devuelva `{` o `[`.
