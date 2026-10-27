# Inventario Reactivo — Frontend (Angular 21)

Interfaz para probar la API de `inventario-reactivo` (Spring WebFlux): catálogo con barras de stock, entradas y salidas, historial y **stock en vivo por SSE**. Tema claro/oscuro.

## Ejecutar

Con el backend corriendo en `http://localhost:8080`:

```bash
npm install
npm start        # http://localhost:4200
```

- Requiere Node 20.19+, 22.12+ o 24+.
- El servidor de desarrollo redirige `/api` a `localhost:8080` (`proxy.conf.json`), así que no hace falta configurar CORS. Si el backend usa otro puerto, cámbialo en ese archivo.
- Build de producción: `npm run build` (queda en `dist/`).

## Estructura

```
src/app/
├── core/   models, cliente HTTP y SSE (inventory-api, sse), estado reactivo (inventory-store), toasts, fechas
├── ui/     product-detail, product-form, toasts, icons
└── app.*   pantalla principal
```

## Arquitectura reactiva

Todo el flujo de datos es RxJS; los signals solo aparecen en la vista (`toSignal` en los componentes).

- **SSE como Observable** (`core/sse.ts`, `InventoryApi.stockStream`): envuelve `EventSource`, cierra la conexión al
  desuscribirse y reconecta sin límite con espera exponencial (1 s, 2 s, 4 s… hasta 30 s; un evento recibido reinicia la
  cuenta). `InventoryApi.connection$` expone el estado `connecting | on | off`.
- **Store declarativo** (`core/inventory-store.ts`), sin `subscribe()` ni `EventSource`:
  - `selectedId$` (`BehaviorSubject`) → `switchMap` al stream en vivo y al historial del producto seleccionado.
  - `products$` aplica con `scan` el listado inicial, los productos creados y los cambios de stock (SSE o movimientos propios).
  - `totalUnits$`, `lowStockCount$`, `maxStock$` y `selected$` se derivan con `map` / `combineLatest`.
  - El historial se vuelve a pedir con `switchMap` al seleccionar, al llegar un evento en vivo o al registrar un movimiento;
    cambiar de producto descarta la respuesta pendiente del anterior.
- **Acciones** (registrar producto, registrar movimiento): `Subject` + `exhaustMap`, así que un doble clic no envía dos
  veces. Un error va al `ToastService` con `catchError` y el flujo sigue vivo.
- **Búsqueda**: `debounceTime(250)` + `distinctUntilChanged`.
- **Limpieza**: los componentes usan `toSignal` y `takeUntilDestroyed`; los flujos compartidos (`share` / `shareReplay`
  con `refCount`) se liberan al irse el último suscriptor, y el stream SSE se cierra con ellos.

## Pruebas

```bash
npm test             # Vitest vía Angular, modo observador
npx ng test --watch=false
```

Los specs usan marble testing (`TestScheduler`): `core/sse.spec.ts` (reconexión con backoff, tope y reinicio de la cuenta,
cierre de `EventSource`) y `core/inventory-store.spec.ts` (descarte de respuestas obsoletas al cambiar de selección,
refresco del historial por evento en vivo, `scan` de productos).
