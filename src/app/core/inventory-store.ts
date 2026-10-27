import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  exhaustMap,
  filter,
  map,
  merge,
  of,
  scan,
  share,
  shareReplay,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { InventoryApi } from './inventory-api';
import {
  CreateMovementRequest,
  CreateProductRequest,
  LiveState,
  Movement,
  Product,
  StockUpdated,
} from './models';
import { ToastService } from './toast';

/** Umbral desde el cual un producto se considera con poco stock. */
export const LOW_STOCK = 5;

/** Cuánto dura el destello de una tarjeta cuyo stock cambió. */
const FLASH_MS = 900;

export type LoadState = 'loading' | 'ready' | 'failed';

interface MovementsState {
  list: Movement[];
  loading: boolean;
}

interface StockChange {
  productId: number;
  stock: number;
}

type LoadEvent = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; products: Product[] };

type ProductPatch = (products: Product[]) => Product[];

/** Guarda de tipo para `filter`: deja pasar solo los eventos de acción de un tipo y los estrecha. */
function ofKind<K extends string>(kind: K) {
  return <E extends { kind: string }>(event: E): event is Extract<E, { kind: K }> => event.kind === kind;
}

const NO_MOVEMENTS: MovementsState = { list: [], loading: false };

function newestFirst(list: Movement[]): Movement[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

/**
 * Estado de la pantalla como flujos de RxJS: todo se deriva de la selección, del listado y de las
 * acciones. No hay subscribe() aquí: quien consume (los componentes) se suscribe con toSignal.
 * Los flujos compartidos son fríos hasta que alguien se suscribe y se liberan al irse el último.
 */
@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private readonly api = inject(InventoryApi);
  private readonly toast = inject(ToastService);

  // ── Entradas ────────────────────────────────────────────────────────────────
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  readonly selectedId$ = new BehaviorSubject<number | null>(null);
  private readonly createProductRequest$ = new Subject<CreateProductRequest>();
  private readonly createMovementRequest$ = new Subject<CreateMovementRequest>();

  // ── Listado inicial ─────────────────────────────────────────────────────────
  private readonly load$: Observable<LoadEvent> = this.reload$.pipe(
    switchMap(() =>
      this.api.listProducts().pipe(
        map((products): LoadEvent => ({ state: 'ready', products })),
        tap((event) => {
          const current = this.selectedId$.value;
          if (event.state === 'ready' && current !== null && !event.products.some((p) => p.id === current)) {
            this.select(null);
          }
        }),
        catchError((err): Observable<LoadEvent> => {
          this.toast.error(err);
          return of({ state: 'failed' });
        }),
        startWith<LoadEvent>({ state: 'loading' }),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly loadState$: Observable<LoadState> = this.load$.pipe(
    map((event) => event.state),
    distinctUntilChanged(),
  );

  // ── Stock en vivo del producto seleccionado ─────────────────────────────────
  /** Eventos SSE del producto seleccionado: al cambiar de selección se cierra el stream anterior. */
  private readonly stockUpdates$: Observable<StockUpdated> = this.selectedId$.pipe(
    distinctUntilChanged(),
    switchMap((id) => (id === null ? EMPTY : this.api.stockStream(id))),
    share(),
  );

  readonly live$: Observable<LiveState> = this.api.connection$;

  // ── Acciones (exhaustMap: un envío a la vez; un error avisa y no corta el flujo) ──
  private readonly productAction$ = this.createProductRequest$.pipe(
    exhaustMap((request) =>
      this.api.createProduct(request).pipe(
        map((product) => ({ kind: 'done' as const, product })),
        catchError((err) => {
          this.toast.error(err);
          return of({ kind: 'failed' as const });
        }),
        startWith({ kind: 'sending' as const }),
      ),
    ),
    share(),
  );

  private readonly movementAction$ = this.createMovementRequest$.pipe(
    exhaustMap((request) =>
      this.api.createMovement(request).pipe(
        map((result) => ({ kind: 'done' as const, request, result })),
        catchError((err) => {
          this.toast.error(err);
          return of({ kind: 'failed' as const });
        }),
        startWith({ kind: 'sending' as const }),
      ),
    ),
    share(),
  );

  /** Emite el producto recién registrado (después del aviso y de seleccionarlo). */
  readonly productCreated$ = this.productAction$.pipe(
    filter(ofKind('done')),
    map((event) => event.product),
    tap((product) => {
      this.toast.ok(`Producto ${product.sku} registrado`);
      this.select(product.id);
    }),
    share(),
  );

  /** Emite la petición de cada movimiento que el servidor aceptó, con el stock resultante. */
  readonly movementCreated$ = this.movementAction$.pipe(
    filter(ofKind('done')),
    map((event) => ({ request: event.request, currentStock: event.result.currentStock })),
    tap(({ request }) => {
      const verb = request.type === 'IN' ? 'Entrada' : 'Salida';
      this.toast.ok(`${verb} de ${request.quantity} registrada`);
    }),
    share(),
  );

  readonly sending$: Observable<boolean> = merge(this.productAction$, this.movementAction$).pipe(
    map((event) => event.kind === 'sending'),
    startWith(false),
    distinctUntilChanged(),
  );

  // ── Productos y derivados ───────────────────────────────────────────────────
  /** Cambios de stock, vengan del stream en vivo o de un movimiento registrado aquí. */
  private readonly stockChange$: Observable<StockChange> = merge(
    this.stockUpdates$.pipe(map((u) => ({ productId: u.productId, stock: u.currentStock }))),
    this.movementCreated$.pipe(map((c) => ({ productId: c.request.productId, stock: c.currentStock }))),
  ).pipe(share());

  /** El listado inicial, más los productos creados y los cambios de stock, aplicados con scan. */
  readonly products$: Observable<Product[]> = merge(
    this.load$.pipe(
      filter((event): event is Extract<LoadEvent, { state: 'ready' }> => event.state === 'ready'),
      map((event): ProductPatch => () => event.products),
    ),
    this.productCreated$.pipe(map((product): ProductPatch => (list) => [...list, product])),
    this.stockChange$.pipe(
      map(({ productId, stock }): ProductPatch => (list) =>
        list.map((p) => (p.id === productId ? { ...p, stock } : p)),
      ),
    ),
  ).pipe(
    scan((list, patch) => patch(list), [] as Product[]),
    startWith([] as Product[]),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly selected$: Observable<Product | null> = combineLatest([this.products$, this.selectedId$]).pipe(
    map(([products, id]) => products.find((p) => p.id === id) ?? null),
  );
  readonly totalUnits$ = this.products$.pipe(map((list) => list.reduce((sum, p) => sum + p.stock, 0)));
  readonly lowStockCount$ = this.products$.pipe(map((list) => list.filter((p) => p.stock <= LOW_STOCK).length));
  readonly maxStock$ = this.products$.pipe(map((list) => Math.max(20, ...list.map((p) => p.stock))));

  /** Producto cuyo stock acaba de cambiar (durante FLASH_MS); null el resto del tiempo. */
  readonly flashId$: Observable<number | null> = this.stockChange$.pipe(
    switchMap(({ productId }) =>
      timer(FLASH_MS).pipe(
        map((): number | null => null),
        startWith<number | null>(productId),
      ),
    ),
    startWith<number | null>(null),
  );

  // ── Historial ───────────────────────────────────────────────────────────────
  /**
   * El historial se vuelve a pedir al seleccionar, al llegar un evento en vivo y al registrar un
   * movimiento. Dos switchMap: cambiar de producto descarta la respuesta pendiente del anterior, y una
   * recarga nueva descarta la anterior del mismo producto.
   */
  private readonly movementsState$: Observable<MovementsState> = this.selectedId$.pipe(
    switchMap((id): Observable<MovementsState> => {
      if (id === null) return of(NO_MOVEMENTS);
      return merge(
        of(undefined),
        this.stockUpdates$.pipe(filter((u) => u.productId === id)),
        this.movementCreated$.pipe(filter((c) => c.request.productId === id)),
      ).pipe(
        switchMap(() =>
          this.api.listMovements(id).pipe(
            map((list): Partial<MovementsState> => ({ list: newestFirst(list), loading: false })),
            catchError((err): Observable<Partial<MovementsState>> => {
              this.toast.error(err);
              return of({ loading: false });
            }),
            startWith<Partial<MovementsState>>({ loading: true }),
          ),
        ),
        scan((state, part): MovementsState => ({ ...state, ...part }), { list: [], loading: true }),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly movements$ = this.movementsState$.pipe(
    map((state) => state.list),
    distinctUntilChanged(),
  );
  readonly movementsLoading$ = this.movementsState$.pipe(
    map((state) => state.loading),
    distinctUntilChanged(),
  );

  // ── Órdenes ─────────────────────────────────────────────────────────────────
  select(id: number | null): void {
    if (id !== this.selectedId$.value) this.selectedId$.next(id);
  }

  reload(): void {
    this.reload$.next();
  }

  createProduct(request: CreateProductRequest): void {
    this.createProductRequest$.next(request);
  }

  createMovement(request: CreateMovementRequest): void {
    this.createMovementRequest$.next(request);
  }
}
