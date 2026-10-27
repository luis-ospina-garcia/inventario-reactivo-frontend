import { Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from './models';

export interface Toast {
  id: number;
  kind: 'ok' | 'error' | 'info';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  ok(text: string): void {
    this.push('ok', text);
  }

  info(text: string): void {
    this.push('info', text);
  }

  /** Convierte un error HTTP de la API (o un fallo de red) en un aviso legible. */
  error(err: unknown): void {
    this.push('error', ToastService.messageOf(err), 6000);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  static messageOf(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'No logramos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
      }
      const body = err.error as Partial<ApiError> | null;
      if (body?.messages?.length) {
        return body.messages.join(' · ');
      }
      if (body?.message) {
        return body.message;
      }
      return 'No se pudo completar la acción. Inténtalo nuevamente.';
    }
    return 'Ocurrió un error inesperado.';
  }

  private push(kind: Toast['kind'], text: string, ms = 3500): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
