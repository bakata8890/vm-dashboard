# QA Manual — Frontend (VM Dashboard)

Checklist de comportamiento observable en el navegador. No requiere leer código React —
cada punto dice exactamente qué clickear y qué mirar. Úsalo cada vez que el agente
entregue o modifique un módulo de frontend, contra la especificación del SDD §14.

Herramientas necesarias: Chrome/Edge con DevTools, extensión **React DevTools**.

---

## 1. Autenticación y cookie (SDD §7, §14.1)

- [ ] Login con credenciales de admin → entra correctamente
- [ ] Login con credenciales inválidas → aparece toast/mensaje de error, no pantalla en blanco
- [ ] Abrir **DevTools → Application → Storage → Local Storage** → confirmar que está **vacío** (ningún token ahí)
- [ ] **DevTools → Application → Cookies** → buscar la cookie de sesión → confirmar flags: `HttpOnly` ✓, `Secure` ✓, `SameSite=Strict`
- [ ] **DevTools → Console** → ejecutar `document.cookie` → la cookie de sesión **no debe aparecer** (HttpOnly la oculta de JS, así se valida)

## 2. RBAC — Cliente vs Admin (SDD §6, §14.1)

- [ ] Login como **cliente** → click derecho sobre el dashboard → "Inspeccionar"
- [ ] Buscar en el HTML (Ctrl+F dentro del panel Elements) botones "Crear VM", "Editar", "Eliminar"
- [ ] **Deben NO existir en el DOM** — si aparecen con `style="display:none"` o `hidden`, está mal implementado (está oculto, no removido)
- [ ] Login como **admin** → los mismos botones sí aparecen y son funcionales

## 3. Validaciones del formulario de VM (SDD §14.2)

Con usuario admin, abrir "Nueva VM" y probar uno por uno:
- [ ] Nombre vacío → error al salir del campo (blur), sin necesidad de dar submit
- [ ] Nombre con símbolo raro (ej. `VM@@@`) → error de formato
- [ ] RAM en 0 o negativo → error, no permite continuar
- [ ] Disco en 0 o negativo → error
- [ ] Cores fuera de rango (ej. 999) → error
- [ ] Formulario válido → botón submit habilitado, guarda correctamente

## 4. Optimistic UI (SDD §6, Decisiones-Técnicas §3)

- [ ] Crear una VM con conexión normal → aparece **inmediatamente** en el listado (antes de que uno alcance a notar espera)
- [ ] **DevTools → Network → throttling → Offline** (o bloquear el endpoint específico)
- [ ] Intentar eliminar una VM → debe desaparecer de la lista al instante
- [ ] Esperar el timeout/error → la VM debe **reaparecer** en la lista (rollback) + toast de error
- [ ] Volver a **Online**, repetir la acción → debe funcionar y persistir tras refrescar la página (F5)

## 5. Estados de UI (SDD §14.4)

- [ ] **DevTools → Network → Slow 3G** → recargar el dashboard → debe verse un **skeleton** con forma de tarjetas, no un spinner genérico ni pantalla en blanco
- [ ] Eliminar todas las VMs (o entrar con DB vacía) → debe verse un **empty state** con mensaje, distinto para admin (con CTA de crear) vs cliente
- [ ] Provocar un error de red al cargar el listado → debe verse mensaje de error + botón "Reintentar", nunca blanco
- [ ] Cualquier acción exitosa → toast visible, desaparece solo (~3s)

## 6. Panel de Data Visualization (SDD §14.3)

- [ ] Anotar manualmente la suma de cores/RAM/disco de las VMs con estado "encendida" (cálculo a mano)
- [ ] Comparar contra lo que muestra el gráfico → deben coincidir exactamente
- [ ] Cambiar el estado de una VM de apagada→encendida (o crear una nueva encendida) → el gráfico debe recalcular sin recargar la página
- [ ] VMs apagadas **no deben sumar** en el total

## 7. Tiempo real / WebSockets (SDD §6)

- [ ] Abrir el dashboard en **dos pestañas/navegadores distintos**, una como admin y otra como cliente
- [ ] Desde admin, cambiar el estado de una VM (apagada → encendida)
- [ ] En la pestaña de cliente, la tarjeta debe actualizarse **sin refrescar** en menos de ~1 segundo
- [ ] Debe verse una animación/highlight breve marcando el cambio

## 8. Dark mode (SDD §14.5)

- [ ] Activar el toggle → cambia toda la superficie (fondo, tarjetas, texto, inputs, gráfico)
- [ ] Revisar que no queden textos con bajo contraste (gris sobre gris, blanco sobre blanco)
- [ ] Navegar entre pantallas (login → dashboard → crear VM) con dark mode activo → se mantiene consistente

## 9. Responsive (SDD §14.6)

- [ ] **DevTools → Toggle device toolbar** → probar en 1280px de ancho → el layout no se rompe (nada se corta ni se superpone)
- [ ] Probar en tamaño tablet (~768px) → sigue siendo usable

## 10. Auditoría automática (complemento, no reemplaza lo anterior)

- [ ] **DevTools → Lighthouse** → correr audit de Accessibility y Performance sobre el dashboard → revisar score y warnings (no hace falta entender cada uno, mirar si hay errores marcados en rojo)
- [ ] Pedir a un segundo agente (sesión limpia, sin contexto de construcción) que audite el código del frontend contra SDD §14 y liste discrepancias

---

**Regla de cierre:** un módulo de frontend no se da por aceptado hasta que su bloque
correspondiente de este checklist esté 100% en verde. Si algo falla, se anota en
`BITACORA.md` como intervención manual necesaria, se corrige, y se vuelve a correr
solo ese bloque (no todo el checklist de nuevo).
