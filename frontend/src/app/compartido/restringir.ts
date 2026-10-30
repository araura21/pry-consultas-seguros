import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';

// Descarta mientras se escribe lo que el campo no admite (por ejemplo, letras en un teléfono)
@Directive({ selector: 'input[restringir]' })
export class Restringir {
  restringir = input.required<'digitos' | 'letras'>();
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private control = inject(NgControl, { optional: true });

  @HostListener('input')
  limpiar() {
    const actual = this.el.nativeElement.value;
    const limpio = this.restringir() === 'digitos'
      ? actual.replace(/\D/g, '')
      : actual.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, '').replace(/^ +/, '').replace(/ {2,}/g, ' ');
    if (limpio !== actual) {
      this.el.nativeElement.value = limpio;
      this.control?.control?.setValue(limpio);
    }
  }
}

// Mismo patrón que el servidor (Angular lo evalúa sin el indicador "u", por eso no usa \p{L})
export const PATRON_NOMBRE = '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*';
