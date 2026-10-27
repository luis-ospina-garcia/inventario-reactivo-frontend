import { TestBed } from '@angular/core/testing';
import { NEVER, distinctUntilChanged, map, of } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { InventoryApi } from './inventory-api';
import { InventoryStore } from './inventory-store';
import { Movement, Product, StockUpdated } from './models';
import { ToastService } from './toast';

function scheduler(): TestScheduler {
  return new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
}

const producto = (id: number, stock: number): Product => ({ id, sku: `SKU-${id}`, name: `Producto ${id}`, stock });
const movimiento = (id: number, productId: number): Movement => ({
  id,
  productId,
  type: 'IN',
  quantity: 1,
  reason: null,
  createdAt: '2026-01-01T10:00:00',
});

function crearStore(api: Partial<InventoryApi>): InventoryStore {
  TestBed.configureTestingModule({
    providers: [
      { provide: InventoryApi, useValue: { connection$: of('off'), stockStream: () => NEVER, ...api } },
      { provide: ToastService, useValue: { ok: () => undefined, error: () => undefined } },
    ],
  });
  return TestBed.inject(InventoryStore);
}

const ids = (list: Movement[]) => list.map((m) => m.id).join(',');

describe('InventoryStore', () => {
  it('descarta la respuesta pendiente del producto anterior al cambiar de selección', () => {
    const ts = scheduler();
    ts.run(({ cold, expectObservable }) => {
      const store = crearStore({
        // El producto 1 responde tarde (frame 11); el 2, rápido (frame 7).
        listMovements: (id) =>
          id === 1 ? cold('10ms (a|)', { a: [movimiento(10, 1)] }) : cold('2ms (b|)', { b: [movimiento(20, 2)] }),
      });
      ts.schedule(() => store.select(1), 1);
      ts.schedule(() => store.select(2), 5);

      expectObservable(store.movements$.pipe(map(ids), distinctUntilChanged())).toBe('x 6ms y', { x: '', y: '20' });
    });
  });

  it('vuelve a pedir el historial cuando llega un evento en vivo del producto seleccionado', () => {
    const ts = scheduler();
    ts.run(({ cold, expectObservable }) => {
      let llamadas = 0;
      const store = crearStore({
        listMovements: () => {
          llamadas++;
          return of(llamadas === 1 ? [movimiento(1, 1)] : [movimiento(2, 1), movimiento(1, 1)]);
        },
        // Se suscribe en el frame 1 (al seleccionar), así que el evento llega en el 5.
        stockStream: () => cold('4ms u', { u: { productId: 1, currentStock: 3 } as StockUpdated }),
      });
      ts.schedule(() => store.select(1), 1);

      expectObservable(store.movements$.pipe(map(ids), distinctUntilChanged())).toBe('xy 3ms z', {
        x: '',
        y: '1',
        z: '2,1',
      });
    });
  });

  it('aplica los eventos en vivo sobre el listado inicial', () => {
    const ts = scheduler();
    ts.run(({ cold, expectObservable }) => {
      const store = crearStore({
        listProducts: () => cold('(p|)', { p: [producto(1, 10)] }),
        stockStream: () => cold('4ms u', { u: { productId: 1, currentStock: 3 } as StockUpdated }),
      });
      ts.schedule(() => store.select(1), 1);

      expectObservable(
        store.products$.pipe(
          map((list) => list.map((p) => p.stock).join(',')),
          distinctUntilChanged(),
        ),
      ).toBe('(xy) 1ms z', { x: '', y: '10', z: '3' });
    });
  });
});
