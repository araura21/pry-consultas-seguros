import { Component, computed, input } from '@angular/core';

// Círculo y rectángulo redondeado convertidos a trazos SVG
const circulo = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

// Íconos de línea (estilo Lucide) dibujados en una cuadrícula de 24 x 24
const ICONOS: Record<string, string[]> = {
  sol: [circulo(12, 12, 4), 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'],
  luna: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  cerrar: ['M18 6 6 18M6 6l12 12'],
  buscar: [circulo(11, 11, 8), 'm21 21-4.3-4.3'],
  calendario: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4M8 2v4M3 10h18'],
  usuario: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', circulo(12, 7, 4)],
  escudo: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'],
  salir: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5M21 12H9'],
  check: ['M20 6 9 17l-5-5'],
  alerta: [circulo(12, 12, 10), 'M12 8v4M12 16h.01'],
  ojo: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z', circulo(12, 12, 3)],
  ojoOculto: ['M9.88 9.88a3 3 0 1 0 4.24 4.24', 'M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13 13 0 0 1-1.67 2.68', 'M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61', 'M2 2l20 20'],
  descargar: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5M12 15V3'],
  tarjeta: ['M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M2 10h20'],
  reloj: [circulo(12, 12, 10), 'M12 6v6l4 2'],
  edificio: ['M3 21h18M5 21V7l8-4v18M19 21V11l-6-4', 'M9 9h.01M9 13h.01M9 17h.01'],
  nota: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6M16 13H8M16 17H8'],
  usuarios: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', circulo(9, 7, 4), 'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'],
  lista: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
  candado: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  mas: ['M12 5v14M5 12h14'],
};

@Component({
  selector: 'app-icono',
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="tamano()" [attr.height]="tamano()" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @for (d of trazos(); track $index) { <path [attr.d]="d" /> }
    </svg>
  `,
  host: { class: 'icono' },
})
export class Icono {
  nombre = input.required<string>();
  tamano = input(18);
  trazos = computed(() => ICONOS[this.nombre()] ?? []);
}
