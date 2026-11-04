import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Icono } from '../compartido/icono';
import { Avisos } from '../compartido/avisos';

// S08: no es un panel general; solo aparecen las solicitudes de los afiliados de esta aseguradora
@Component({
  selector: 'app-aseguradora',
  imports: [DatePipe, Icono],
  template: `
    <div class="pagina">
      <div class="encabezado-pagina">
        <div><h1>Solicitudes de cobertura</h1><p>Solo se muestran las solicitudes de tus afiliados, sin información clínica.</p></div>
      </div>

      <div class="rejilla resumen">
        <div class="tarjeta"><span class="texto-suave pequeno">Solicitudes</span><strong>{{ solicitudes().length }}</strong></div>
        <div class="tarjeta"><span class="texto-suave pequeno">Elegibles</span><strong class="ok">{{ elegibles() }}</strong></div>
        <div class="tarjeta"><span class="texto-suave pequeno">No elegibles</span><strong class="no">{{ solicitudes().length - elegibles() }}</strong></div>
      </div>

      @if (solicitudes().length) {
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead><tr><th>Solicitud</th><th>Cita</th><th>Establecimiento</th><th>Prestación</th><th>Póliza</th><th>Resultado</th></tr></thead>
            <tbody>
              @for (s of solicitudes(); track s.id) {
                <tr>
                  <td data-etiqueta="Solicitud">{{ s.creada | date: 'dd/MM/y HH:mm' }}</td>
                  <td data-etiqueta="Cita">{{ s.inicio | date: 'dd/MM/y HH:mm' }}</td>
                  <td data-etiqueta="Establecimiento">{{ s.establecimiento }}</td>
                  <td data-etiqueta="Prestación">{{ s.prestacion }}</td>
                  <td data-etiqueta="Póliza" class="mono">{{ s.poliza }}</td>
                  <td data-etiqueta="Resultado">
                    <span class="insignia" [class]="s.elegible ? 'insignia exito' : 'insignia peligro'">
                      {{ s.elegible ? 'Cubre ' + s.porcentaje + ' %' : 'No elegible' }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!cargando()) {
        <div class="vacio">
          <span class="icono-circulo"><app-icono nombre="lista" [tamano]="24" /></span>
          <strong>Sin solicitudes</strong>
          <span class="pequeno">Las solicitudes aparecen cuando un afiliado reserva una cita con su póliza.</span>
        </div>
      }
    </div>
  `,
  styles: `
    .resumen { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 18px; }
    .resumen .tarjeta { display: grid; gap: 2px; padding: 16px 18px; }
    .resumen strong { font-size: 26px; }
    .ok { color: var(--exito); }
    .no { color: var(--peligro); }
    @media (max-width: 560px) { .resumen { gap: 10px; } .resumen .tarjeta { padding: 12px; } .resumen strong { font-size: 20px; } }
  `,
})
export class Aseguradora {
  private http = inject(HttpClient);
  private avisos = inject(Avisos);
  solicitudes = signal<any[]>([]);
  cargando = signal(true);
  elegibles = computed(() => this.solicitudes().filter((s) => s.elegible).length);

  constructor() {
    firstValueFrom(this.http.get<any[]>('/api/aseguradora/solicitudes'))
      .then((r) => this.solicitudes.set(r))
      .catch((e) => this.avisos.error(e))
      .finally(() => this.cargando.set(false));
  }
}
