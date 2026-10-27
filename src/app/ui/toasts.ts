import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast';
import { Icon } from './icons';

@Component({
  selector: 'app-toasts',
  imports: [Icon],
  template: `
    <div class="stack" role="region" aria-label="Notificaciones">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class]="t.kind" [attr.role]="t.kind === 'error' ? 'alert' : 'status'">
          <span class="icon"><app-icon [name]="t.kind === 'error' ? 'alert' : 'check'" [size]="16" /></span>
          <span class="text">{{ t.text }}</span>
          <button type="button" class="close" (click)="toasts.dismiss(t.id)" aria-label="Cerrar notificación">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack { position: fixed; inset: auto 1rem 1rem 1rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem; }
    .toast {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0.375rem 0.75rem 0.75rem; border-radius: var(--radius-xl);
      background: var(--color-surface); border: 1px solid var(--color-border); box-shadow: var(--shadow-dropdown);
      animation: toast-in .25s var(--ease-out-strong) both;
    }
    .icon { display: flex; width: 2rem; height: 2rem; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 50%; background: var(--color-primary-muted); color: var(--color-primary-muted-foreground); }
    .toast.ok .icon { background: var(--color-secondary-muted); color: var(--color-secondary-muted-foreground); }
    .toast.error .icon { background: var(--color-danger-muted); color: var(--color-danger-muted-foreground); }
    .text { flex: 1; min-width: 0; font-size: 14px; font-weight: 500; line-height: 1.4; color: var(--color-on-surface); }
    .close { display: inline-flex; width: 2.25rem; height: 2.25rem; flex-shrink: 0; align-items: center; justify-content: center; border: 0; background: none; border-radius: var(--radius-lg); color: var(--color-on-surface-secondary); cursor: pointer; }
    .close:hover { background: var(--color-muted); }
    @keyframes toast-in { from { opacity: 0; transform: translateX(calc(100% + 1.5rem)); } }
    @media (min-width: 640px) { .stack { left: auto; width: 24rem; } }
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
