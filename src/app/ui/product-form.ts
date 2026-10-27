import { Component, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { InventoryStore } from '../core/inventory-store';
import { Icon } from './icons';

@Component({
  selector: 'app-product-form',
  imports: [FormsModule, Icon],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (click)="closed.emit()" aria-hidden="true"></div>
    <form class="panel" role="dialog" aria-modal="true" aria-labelledby="pf-title" (ngSubmit)="submit()">
      <header>
        <div>
          <h2 id="pf-title">Registrar producto</h2>
          <p>El stock inicial queda anotado como la primera entrada del historial.</p>
        </div>
        <button type="button" class="close" (click)="closed.emit()" aria-label="Cerrar panel"><app-icon name="x" /></button>
      </header>

      <div class="body">
        <label>
          <span>SKU</span>
          <input name="sku" [(ngModel)]="sku" maxlength="50" placeholder="TOR-001" autocomplete="off" autofocus />
        </label>
        <label>
          <span>Nombre</span>
          <input name="name" [(ngModel)]="name" placeholder="Tornillo hexagonal 1/4”" autocomplete="off" />
        </label>
        <label>
          <span>Stock inicial</span>
          <input name="stock" type="number" min="0" [(ngModel)]="initialStock" />
        </label>
      </div>

      <footer>
        <button type="button" class="btn" (click)="closed.emit()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="!valid() || sending()">
          {{ sending() ? 'Guardando…' : 'Registrar producto' }}
        </button>
      </footer>
    </form>
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; z-index: 40; background: var(--scrim); animation: fade-in .2s var(--ease-out-strong); }
    .panel {
      position: fixed; inset: 0 0 0 auto; z-index: 50; display: flex; flex-direction: column;
      width: 100%; background: var(--color-surface); box-shadow: var(--shadow-lg);
      animation: slide-in-right .25s var(--ease-out-strong);
    }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1rem 0.5rem 1rem 1rem; border-bottom: 1px solid var(--color-border); }
    h2 { margin: 0; font-size: 1.25rem; font-weight: 700; }
    p { margin: 0.25rem 0 0; font-size: 14px; color: var(--color-on-surface-secondary); }
    .close { display: inline-flex; width: 2.75rem; height: 2.75rem; flex-shrink: 0; align-items: center; justify-content: center; border: 0; background: none; border-radius: var(--radius-lg); color: var(--color-on-surface-secondary); cursor: pointer; }
    .close:hover { background: var(--color-muted); }
    .body { flex: 1; overflow-y: auto; display: grid; align-content: start; gap: 1rem; padding: 1rem; }
    label { display: block; }
    label span { display: block; margin-bottom: 0.375rem; font-size: 0.8125rem; font-weight: 500; color: var(--color-on-surface); }
    footer { display: flex; flex-direction: column-reverse; gap: 0.5rem; padding: 1rem; border-top: 1px solid var(--color-border); }
    footer .btn { width: 100%; }
    @keyframes fade-in { from { opacity: 0; } }
    @keyframes slide-in-right { from { opacity: 0; transform: translateX(2rem); } }
    @media (min-width: 640px) {
      .panel { max-width: 35rem; border-left: 1px solid var(--color-border); }
      header { padding: 1.25rem 0.5rem 1.25rem 1.5rem; }
      .body { padding: 1.5rem; }
      footer { flex-direction: row; justify-content: flex-end; padding: 1rem 1.5rem; }
      footer .btn { width: auto; }
      .close { width: 2.25rem; height: 2.25rem; }
    }
  `,
})
export class ProductForm {
  protected readonly store = inject(InventoryStore);
  readonly closed = output<void>();

  protected readonly sending = toSignal(this.store.sending$, { initialValue: false });
  protected readonly sku = signal('');
  protected readonly name = signal('');
  protected readonly initialStock = signal(0);

  protected readonly valid = computed(
    () => this.sku().trim().length > 0 && this.name().trim().length > 0 && this.initialStock() >= 0,
  );

  protected submit(): void {
    if (!this.valid()) return;
    this.store.createProduct({
      sku: this.sku().trim(),
      name: this.name().trim(),
      initialStock: Math.floor(this.initialStock() ?? 0),
    });
  }
}
