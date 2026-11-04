import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Icono } from '../compartido/icono';
import { Avisos } from '../compartido/avisos';

const CLASE_RESULTADO: Record<string, string> = { OK: 'exito', APROBADO: 'exito', VERIFICADO: 'exito' };

@Component({
  selector: 'app-auditoria',
  imports: [DatePipe, FormsModule, Icono],
  template: `
    <div class="pagina">
      <div class="encabezado-pagina">
        <div><h1>Registro de auditoría</h1><p>Quién hizo qué, cuándo y con qué resultado. Los registros no se pueden modificar.</p></div>
        <button class="btn btn-primario" (click)="verificar()" [disabled]="verificando()">
          @if (verificando()) { <span class="girando"></span> } @else { <app-icono nombre="escudo" /> }
          Verificar integridad
        </button>
      </div>

      @if (resultado(); as r) {
        <div class="banda" [class.exito]="r.ok" [class.error]="!r.ok" role="status">
          <app-icono [nombre]="r.ok ? 'check' : 'alerta'" />
          <p>{{ r.ok ? 'Cadena íntegra: los ' + r.filas + ' registros conservan su hash original.'
                     : 'Se detectó una alteración en el registro #' + r.filaAlterada + '. Revisa el incidente.' }}</p>
        </div>
      }

      <div class="fila" style="margin-bottom: 14px">
        <label class="campo" style="margin: 0; flex: 1; min-width: 220px">
          <span class="sr">Filtrar</span>
          <input maxlength="60" [ngModel]="filtroTexto()" (ngModelChange)="filtroTexto.set($event)" placeholder="Filtrar por acción, recurso o resultado (ej.: ACCESO_DENEGADO)">
        </label>
        <span class="texto-suave pequeno">{{ filtrados().length }} de {{ registros().length }} eventos</span>
      </div>

      <div class="tabla-contenedor">
        <table class="tabla">
          <thead><tr><th>#</th><th>Fecha</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Recurso</th><th>Resultado</th><th>IP</th></tr></thead>
          <tbody>
            @for (a of filtrados(); track a.id) {
              <tr>
                <td data-etiqueta="#" class="mono">{{ a.id }}</td>
                <td data-etiqueta="Fecha">{{ a.ts | date: 'dd/MM HH:mm:ss' }}</td>
                <td data-etiqueta="Usuario" class="mono">{{ a.usuario_id ? a.usuario_id.slice(0, 8) : '—' }}</td>
                <td data-etiqueta="Rol">{{ a.rol ?? '—' }}</td>
                <td data-etiqueta="Acción"><strong>{{ a.accion }}</strong></td>
                <td data-etiqueta="Recurso" class="mono recurso">{{ a.recurso ?? '—' }}</td>
                <td data-etiqueta="Resultado"><span class="insignia" [class]="'insignia ' + clase(a.resultado)">{{ a.resultado }}</span></td>
                <td data-etiqueta="IP" class="mono">{{ a.ip }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .recurso { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class Auditoria {
  private http = inject(HttpClient);
  private avisos = inject(Avisos);
  registros = signal<any[]>([]);
  resultado = signal<any>(null);
  verificando = signal(false);
  filtroTexto = signal('');

  filtrados = computed(() => {
    const f = this.filtroTexto().trim().toLowerCase();
    if (!f) return this.registros();
    return this.registros().filter((a) => `${a.accion} ${a.recurso} ${a.resultado} ${a.rol}`.toLowerCase().includes(f));
  });

  constructor() {
    firstValueFrom(this.http.get<any[]>('/api/auditoria'))
      .then((r) => this.registros.set(r))
      .catch((e) => this.avisos.error(e));
  }

  clase(resultado: string) {
    return CLASE_RESULTADO[resultado] ?? (resultado === 'DENEGADO' || resultado.includes('INVALID') || resultado === 'NO_ENCONTRADO' ? 'peligro' : 'alerta');
  }

  async verificar() {
    this.verificando.set(true);
    try {
      this.resultado.set(await firstValueFrom(this.http.get('/api/auditoria/verificar')));
    } catch (e) {
      this.avisos.error(e);
    } finally {
      this.verificando.set(false);
    }
  }
}
