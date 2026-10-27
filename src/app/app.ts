import { Component, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { InventoryStore, LOW_STOCK } from './core/inventory-store';
import { Icon } from './ui/icons';
import { ProductDetail } from './ui/product-detail';
import { ProductForm } from './ui/product-form';
import { Toasts } from './ui/toasts';

type Theme = 'light' | 'dark';

/** Espera tras la última tecla antes de filtrar el catálogo. */
const SEARCH_DEBOUNCE_MS = 250;

@Component({
  selector: 'app-root',
  imports: [Icon, ProductDetail, ProductForm, Toasts],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly store = inject(InventoryStore);

  /** Lo que muestra el campo de búsqueda; el filtro se aplica con retardo. */
  protected readonly typed = signal('');
  protected readonly showForm = signal(false);
  protected readonly theme = signal<Theme>(initialTheme());
  protected readonly lowStock = LOW_STOCK;

  private readonly query$ = toObservable(this.typed).pipe(
    debounceTime(SEARCH_DEBOUNCE_MS),
    map((text) => text.trim().toLowerCase()),
    distinctUntilChanged(),
  );

  protected readonly query = toSignal(this.query$, { initialValue: '' });
  protected readonly products = toSignal(this.store.products$, { initialValue: [] });
  protected readonly loadState = toSignal(this.store.loadState$, { initialValue: 'loading' });
  protected readonly selectedId = toSignal(this.store.selectedId$, { initialValue: null });
  protected readonly flashId = toSignal(this.store.flashId$, { initialValue: null });
  protected readonly totalUnits = toSignal(this.store.totalUnits$, { initialValue: 0 });
  protected readonly lowStockCount = toSignal(this.store.lowStockCount$, { initialValue: 0 });
  protected readonly maxStock = toSignal(this.store.maxStock$, { initialValue: 20 });

  protected readonly visible = toSignal(
    combineLatest([this.store.products$, this.query$]).pipe(
      map(([products, q]) =>
        q ? products.filter((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : products,
      ),
    ),
    { initialValue: [] },
  );

  constructor() {
    // Registrar un producto cierra el panel.
    this.store.productCreated$.pipe(takeUntilDestroyed()).subscribe(() => this.showForm.set(false));

    effect(() => {
      const theme = this.theme();
      document.documentElement.dataset['theme'] = theme;
      try {
        localStorage.setItem('theme', theme);
      } catch {
        /* almacenamiento no disponible: el tema solo dura la sesión */
      }
    });
  }

  protected toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  protected percent(stock: number): number {
    return Math.min(100, Math.round((stock / this.maxStock()) * 100));
  }

  protected level(stock: number): 'ok' | 'low' | 'out' {
    return stock === 0 ? 'out' : stock <= LOW_STOCK ? 'low' : 'ok';
  }
}

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* sin almacenamiento */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
