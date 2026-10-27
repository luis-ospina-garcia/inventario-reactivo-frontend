import { Component, input } from '@angular/core';

/** Iconos de trazo (estilo Lucide) como un único componente. */
@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor"
         stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name()) {
        @case ('box') {
          <path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" />
        }
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('minus') { <path d="M5 12h14" /> }
        @case ('search') { <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /> }
        @case ('down') { <path d="M12 5v14M5 12l7 7 7-7" /> }
        @case ('up') { <path d="M12 19V5M5 12l7-7 7 7" /> }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        }
        @case ('moon') { <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /> }
        @case ('x') { <path d="M18 6 6 18M6 6l12 12" /> }
        @case ('layers') { <path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /> }
        @case ('alert') {
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" />
        }
        @case ('check') { <path d="m5 12 5 5L20 7" /> }
        @case ('history') { <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /> }
        @case ('refresh') { <path d="M21 12a9 9 0 0 0-15-6.7L3 8" /><path d="M3 3v5h5M3 12a9 9 0 0 0 15 6.7L21 16" /><path d="M21 21v-5h-5" /> }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; line-height: 0; }`,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(18);
}
