import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { InventoryStore, LOW_STOCK } from '../core/inventory-store';
import { MovementType } from '../core/models';
import { formatDateTime, timeAgo } from '../core/time';
import { Icon } from './icons';

@Component({
  selector: 'app-product-detail',
  imports: [FormsModule, Icon],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetail {
  protected readonly store = inject(InventoryStore);

  protected readonly type = signal<MovementType>('OUT');
  protected readonly quantity = signal(1);
  protected readonly reason = signal('');

  protected readonly product = toSignal(this.store.selected$, { initialValue: null });
  protected readonly maxStock = toSignal(this.store.maxStock$, { initialValue: 20 });
  protected readonly live = toSignal(this.store.live$, { initialValue: 'off' });
  protected readonly flashId = toSignal(this.store.flashId$, { initialValue: null });
  protected readonly sending = toSignal(this.store.sending$, { initialValue: false });
  protected readonly movements = toSignal(this.store.movements$, { initialValue: [] });
  protected readonly movementsLoading = toSignal(this.store.movementsLoading$, { initialValue: false });
  protected readonly level = computed(() => {
    const stock = this.product()?.stock ?? 0;
    return stock === 0 ? 'out' : stock <= LOW_STOCK ? 'low' : 'ok';
  });
  protected readonly percent = computed(() =>
    Math.min(100, Math.round(((this.product()?.stock ?? 0) / this.maxStock()) * 100)),
  );
  protected readonly projected = computed(() => {
    const stock = this.product()?.stock ?? 0;
    const q = Math.max(0, this.quantity() || 0);
    return this.type() === 'IN' ? stock + q : stock - q;
  });
  protected readonly canSubmit = computed(
    () => (this.quantity() ?? 0) >= 1 && !this.sending(),
  );

  constructor() {
    // Un movimiento aceptado deja el formulario listo para el siguiente.
    this.store.movementCreated$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.quantity.set(1);
      this.reason.set('');
    });
  }

  protected step(delta: number): void {
    this.quantity.set(Math.max(1, (this.quantity() || 0) + delta));
  }

  protected submit(): void {
    const product = this.product();
    if (!product || !this.canSubmit()) return;
    this.store.createMovement({
      productId: product.id,
      type: this.type(),
      quantity: Math.floor(this.quantity()),
      reason: this.reason().trim() || null,
    });
  }

  protected ago(value: string): string {
    return timeAgo(value);
  }

  protected when(value: string): string {
    return formatDateTime(value);
  }
}
