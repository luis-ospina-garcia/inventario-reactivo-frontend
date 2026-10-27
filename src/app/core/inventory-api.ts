import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, defer, distinctUntilChanged, finalize, map, tap } from 'rxjs';
import {
  ApiResponse,
  CreateMovementRequest,
  CreateProductRequest,
  LiveState,
  Movement,
  Product,
  StockUpdated,
} from './models';
import { eventSourceStream, reconnectWithBackoff } from './sse';

const BASE = '/api/v1';

/** Cliente HTTP de la API. El proxy de desarrollo (proxy.conf.json) la redirige al backend en :8080. */
@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private readonly http = inject(HttpClient);
  private readonly connection = new BehaviorSubject<LiveState>('off');

  /** Estado de la conexión en vivo: connecting mientras espera para reintentar, off sin stream abierto. */
  readonly connection$: Observable<LiveState> = this.connection.pipe(distinctUntilChanged());

  listProducts(): Observable<Product[]> {
    return this.http.get<ApiResponse<Product>>(`${BASE}/products`).pipe(map((r) => r.data));
  }

  createProduct(request: CreateProductRequest): Observable<Product> {
    return this.http
      .post<ApiResponse<Product>>(`${BASE}/products`, request)
      .pipe(map((r) => r.data[0]));
  }

  listMovements(productId: number): Observable<Movement[]> {
    const params = new HttpParams().set('productId', productId);
    return this.http
      .get<ApiResponse<Movement>>(`${BASE}/movements`, { params })
      .pipe(map((r) => r.data));
  }

  createMovement(request: CreateMovementRequest): Observable<Movement & { currentStock: number }> {
    return this.http
      .post<ApiResponse<Movement & { currentStock: number }>>(`${BASE}/movements`, request)
      .pipe(map((r) => r.data[0]));
  }

  /**
   * Stock en vivo de un producto (SSE). Reconecta solo, con espera exponencial, y no termina nunca
   * por errores de red: se cierra al desuscribirse.
   */
  stockStream(productId: number): Observable<StockUpdated> {
    // El servidor no envía cabeceras hasta el primer evento, así que 'onopen' tarda en llegar:
    // se marca como activo desde el inicio y solo se degrada si la conexión falla.
    return defer(() => {
      this.connection.next('on');
      return eventSourceStream<StockUpdated>(`${BASE}/products/${productId}/stock/stream`, 'stock');
    }).pipe(
      tap(() => this.connection.next('on')),
      reconnectWithBackoff({ onRetry: () => this.connection.next('connecting') }),
      finalize(() => this.connection.next('off')),
    );
  }
}
