import { Component, Injectable, inject, signal } from '@angular/core';
import { Icono } from './icono';
import { mensajeError } from './sesion';

export interface Aviso {
  id: number;
  tipo: 'exito' | 'error' | 'info';
  texto: string;
}

// Mensajes emergentes que se cierran solos después de unos segundos
@Injectable({ providedIn: 'root' })
export class Avisos {
  readonly lista = signal<Aviso[]>([]);
  private siguiente = 0;

  mostrar(texto: string, tipo: Aviso['tipo'] = 'exito') {
    const id = ++this.siguiente;
    this.lista.update((l) => [...l, { id, tipo, texto }]);
    setTimeout(() => this.cerrar(id), 5000);
  }

  error(e: unknown) {
    this.mostrar(mensajeError(e), 'error');
  }

  cerrar(id: number) {
    this.lista.update((l) => l.filter((a) => a.id !== id));
  }
}

@Component({
  selector: 'app-avisos',
  imports: [Icono],
  template: `
    <div class="avisos" aria-live="polite">
      @for (a of avisos.lista(); track a.id) {
        <div [class]="'aviso-flotante ' + a.tipo" role="status">
          <app-icono [nombre]="a.tipo === 'error' ? 'alerta' : 'check'" />
          <span>{{ a.texto }}</span>
          <button class="btn-icono" (click)="avisos.cerrar(a.id)" aria-label="Cerrar aviso"><app-icono nombre="cerrar" /></button>
        </div>
      }
    </div>
  `,
})
export class AvisosFlotantes {
  protected avisos = inject(Avisos);
}
