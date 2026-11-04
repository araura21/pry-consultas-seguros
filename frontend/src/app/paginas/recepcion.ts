import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Icono } from '../compartido/icono';
import { Avisos } from '../compartido/avisos';

@Component({
  selector: 'app-recepcion',
  imports: [DatePipe, Icono],
  template: `
    <div class="pagina">
      <div class="encabezado-pagina">
        <div><h1>Vínculos de dependientes</h1><p>Solicitudes de representantes que esperan verificación.</p></div>
      </div>

      <div class="banda alerta">
        <app-icono nombre="alerta" />
        <p>Aprueba solo después de revisar el documento original que acredita la representación (partida de nacimiento o
          resolución judicial). Tu decisión queda registrada en la auditoría.</p>
      </div>

      @if (cargando()) {
        <div class="rejilla"><div class="esqueleto"></div><div class="esqueleto"></div></div>
      } @else {
        <div class="rejilla">
          @for (d of pendientes(); track d.id) {
            <article class="tarjeta">
              <span class="insignia alerta">Pendiente</span>
              <h3 style="margin-top: 12px">{{ d.dependiente }}</h3>
              <dl class="datos">
                <dt>Identificación</dt><dd class="mono">{{ d.identificacion }}</dd>
                <dt>Nacimiento</dt><dd>{{ d.fecha_nacimiento | date: 'd MMM y' }}</dd>
                <dt>Representante</dt><dd>{{ d.representante }}</dd>
              </dl>
              <div class="fila">
                <button class="btn btn-primario btn-pequeno" style="flex: 1" (click)="decidir(d, true)"><app-icono nombre="check" /> Aprobar</button>
                <button class="btn btn-peligro btn-pequeno" style="flex: 1" (click)="decidir(d, false)">Rechazar</button>
              </div>
            </article>
          } @empty {
            <div class="vacio" style="grid-column: 1 / -1">
              <span class="icono-circulo"><app-icono nombre="check" [tamano]="24" /></span>
              <strong>No hay solicitudes pendientes</strong>
              <span class="pequeno">Cuando un representante solicite un vínculo aparecerá aquí.</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .datos { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 10px 0 16px; font-size: 14px; }
    .datos dt { color: var(--texto-suave); }
    .datos dd { margin: 0; font-weight: 500; }
  `,
})
export class Recepcion {
  private http = inject(HttpClient);
  private avisos = inject(Avisos);
  pendientes = signal<any[]>([]);
  cargando = signal(true);

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      this.pendientes.set(await firstValueFrom(this.http.get<any[]>('/api/recepcion/dependientes')));
    } catch (e) {
      this.avisos.error(e);
    } finally {
      this.cargando.set(false);
    }
  }

  async decidir(d: any, aprobar: boolean) {
    if (!aprobar && !confirm(`¿Rechazar el vínculo de ${d.dependiente}?`)) return;
    try {
      await firstValueFrom(this.http.post(`/api/recepcion/dependientes/${d.id}`, { aprobar }));
      this.avisos.mostrar(aprobar ? 'Vínculo verificado' : 'Vínculo rechazado');
      await this.cargar();
    } catch (e) {
      this.avisos.error(e);
    }
  }
}
