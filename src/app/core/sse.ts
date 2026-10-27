import { MonoTypeOperatorFunction, Observable, retry, timer } from 'rxjs';

/** Lo mínimo que se usa de EventSource: permite sustituirlo en las pruebas. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
  onerror: ((event: Event) => void) | null;
}

export type EventSourceFactory = (url: string) => EventSourceLike;

const browserEventSource: EventSourceFactory = (url) => new EventSource(url) as unknown as EventSourceLike;

/**
 * Envuelve un EventSource en un Observable: cada evento `eventName` emite su JSON ya interpretado.
 * Un fallo de conexión (o un evento ilegible) termina el flujo con error y la conexión se cierra
 * al desuscribirse. Reconectar es cosa de `reconnectWithBackoff`.
 */
export function eventSourceStream<T>(
  url: string,
  eventName: string,
  factory: EventSourceFactory = browserEventSource,
): Observable<T> {
  return new Observable<T>((subscriber) => {
    const source = factory(url);
    source.addEventListener(eventName, (event) => {
      try {
        subscriber.next(JSON.parse(event.data) as T);
      } catch (err) {
        subscriber.error(err);
      }
    });
    source.onerror = () => subscriber.error(new Error(`Se perdió la conexión con ${url}`));
    return () => source.close();
  });
}

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  /** Se llama justo antes de esperar para reintentar (intento 1, 2, 3…). */
  onRetry?: (attempt: number) => void;
}

/** Reintenta sin límite con espera exponencial (base, 2·base, 4·base… hasta maxMs). Un valor recibido reinicia la cuenta. */
export function reconnectWithBackoff<T>({
  baseMs = 1000,
  maxMs = 30_000,
  onRetry,
}: BackoffOptions = {}): MonoTypeOperatorFunction<T> {
  return retry({
    resetOnSuccess: true,
    delay: (_error, attempt) => {
      onRetry?.(attempt);
      return timer(Math.min(baseMs * 2 ** (attempt - 1), maxMs));
    },
  });
}
