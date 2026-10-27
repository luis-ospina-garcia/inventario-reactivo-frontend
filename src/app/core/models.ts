export type MovementType = 'IN' | 'OUT';

export interface Product {
  id: number;
  sku: string;
  name: string;
  stock: number;
}

export interface Movement {
  id: number;
  productId: number;
  type: MovementType;
  quantity: number;
  reason: string | null;
  createdAt: string;
}

export interface StockUpdated {
  productId: number;
  sku: string;
  type: MovementType;
  quantity: number;
  currentStock: number;
  occurredAt: string;
}

export interface CreateProductRequest {
  sku: string;
  name: string;
  initialStock: number;
}

export interface CreateMovementRequest {
  productId: number;
  type: MovementType;
  quantity: number;
  reason: string | null;
}

/** Sobre estándar de las respuestas exitosas de la API. */
export interface ApiResponse<T> {
  data: T[];
  messages: string[];
}

/** Cuerpo de las respuestas de error de la API. */
export interface ApiError {
  code: string;
  message: string;
  messages: string[];
}

/** Estado de la conexión en vivo (SSE). */
export type LiveState = 'off' | 'connecting' | 'on';
