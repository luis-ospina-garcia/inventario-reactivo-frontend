import { TestScheduler } from 'rxjs/testing';
import { Observable, defer } from 'rxjs';
import { EventSourceLike, eventSourceStream, reconnectWithBackoff } from './sse';

function scheduler(): TestScheduler {
  return new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
}

describe('reconnectWithBackoff', () => {
  /** Devuelve las fuentes en orden, una por suscripción (la última se repite). */
  const enOrden = <T>(...fuentes: Observable<T>[]) => {
    let n = 0;
    return defer(() => fuentes[Math.min(n++, fuentes.length - 1)]);
  };

  it('reintenta con espera exponencial y la limita a maxMs', () => {
    scheduler().run(({ cold, expectObservable }) => {
      // Cuatro fallos seguidos: esperas de 1, 2, 4 y 4 s (tope) antes de la conexión que funciona.
      const source = enOrden(cold('#'), cold('#'), cold('#'), cold('#'), cold('a|'));

      expectObservable(source.pipe(reconnectWithBackoff({ baseMs: 1000, maxMs: 4000 }))).toBe('11000ms a|');
    });
  });

  it('un valor recibido reinicia la espera a la base', () => {
    scheduler().run(({ cold, expectObservable }) => {
      // Cada sesión emite y cae a los 2 ms: la espera sigue siendo de 1 s (periodo de 1002 ms), no crece.
      const source = cold('a-#');

      expectObservable(source.pipe(reconnectWithBackoff({ baseMs: 1000 })), '3500ms !').toBe(
        'a 1001ms a 1001ms a 1001ms a',
      );
    });
  });

  it('avisa de cada reintento antes de esperar', () => {
    const avisos: number[] = [];
    scheduler().run(({ cold, expectObservable }) => {
      const source = enOrden(cold('#'), cold('#'), cold('a|'));

      expectObservable(source.pipe(reconnectWithBackoff({ onRetry: (intento) => avisos.push(intento) }))).toBe(
        '3000ms a|',
      );
    });
    expect(avisos).toEqual([1, 2]);
  });
});

class FakeEventSource implements EventSourceLike {
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, (event: MessageEvent<string>) => void>();

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, listener);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: string): void {
    this.listeners.get(type)?.({ data } as MessageEvent<string>);
  }
}

describe('eventSourceStream', () => {
  it('emite el JSON de cada evento y cierra la conexión al desuscribirse', () => {
    const fake = new FakeEventSource();
    const recibidos: unknown[] = [];
    const sub = eventSourceStream<{ stock: number }>('/stream', 'stock', () => fake).subscribe((v) => recibidos.push(v));

    fake.emit('stock', '{"stock":7}');
    fake.emit('otro', '{"stock":99}');
    expect(recibidos).toEqual([{ stock: 7 }]);
    expect(fake.closed).toBe(false);

    sub.unsubscribe();
    expect(fake.closed).toBe(true);
  });

  it('termina con error y cierra la conexión cuando falla', () => {
    const fake = new FakeEventSource();
    let error: unknown;
    eventSourceStream('/stream', 'stock', () => fake).subscribe({ error: (e) => (error = e) });

    fake.onerror?.(new Event('error'));
    expect(error).toBeInstanceOf(Error);
    expect(fake.closed).toBe(true);
  });
});
