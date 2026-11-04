import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Sesion } from '../compartido/sesion';
import { Icono } from '../compartido/icono';
import { Avisos } from '../compartido/avisos';

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  PENDIENTE_PAGO: { texto: 'Pendiente de pago', clase: 'alerta' },
  CONFIRMADA: { texto: 'Confirmada', clase: 'exito' },
  ATENDIDA: { texto: 'Atendida', clase: 'info' },
  CANCELADA: { texto: 'Cancelada', clase: 'peligro' },
};

const TITULOS: Record<string, [string, string]> = {
  PACIENTE: ['Mis citas', 'Tus citas y las de tus dependientes verificados.'],
  PROFESIONAL: ['Mi agenda', 'Solo ves a los pacientes que tienen cita contigo.'],
  RECEPCION: ['Citas del establecimiento', 'Sin datos clínicos: solo agenda y estado del pago.'],
};

// Una sola pantalla para tres roles; el backend decide qué citas y qué campos llegan
@Component({
  selector: 'app-citas',
  host: { '(document:keydown.escape)': 'citaNota.set(null)' },
  imports: [DatePipe, CurrencyPipe, FormsModule, Icono],
  template: `
    <div class="pagina">
      <div class="encabezado-pagina">
        <div><h1>{{ titulo()[0] }}</h1><p>{{ titulo()[1] }}</p></div>
        <div class="segmentos" role="tablist">
          <button role="tab" [class.activo]="vista() === 'activas'" [attr.aria-selected]="vista() === 'activas'"
                  (click)="vista.set('activas')">Activas ({{ activas().length }})</button>
          <button role="tab" [class.activo]="vista() === 'historial'" [attr.aria-selected]="vista() === 'historial'"
                  (click)="vista.set('historial')">Historial ({{ historial().length }})</button>
        </div>
      </div>

      @if (avisoPago() === 'ok') {
        <div class="banda exito"><app-icono nombre="check" /><p>Pago aprobado. Tu cita está confirmada.</p></div>
      } @else if (avisoPago()) {
        <div class="banda error"><app-icono nombre="alerta" /><p>El pago fue rechazado y la reserva se canceló. Puedes intentarlo de nuevo.</p></div>
      }

      @if (cargando()) {
        <div class="pila"><div class="esqueleto"></div><div class="esqueleto"></div></div>
      } @else {
        <div class="pila">
          @for (c of visibles(); track c.id) {
            <article class="tarjeta cita">
              <div class="fecha">
                <span class="mes">{{ c.inicio | date: 'MMM' }}</span>
                <span class="numero">{{ c.inicio | date: 'd' }}</span>
                <span class="hora">{{ c.inicio | date: 'HH:mm' }}</span>
              </div>
              <div class="cuerpo">
                <div class="fila">
                  <h3>{{ rol() === 'PACIENTE' ? c.profesional : c.paciente }}</h3>
                  <span class="insignia" [class]="'insignia ' + estado(c).clase">{{ estado(c).texto }}</span>
                </div>
                <p class="texto-suave pequeno">
                  @if (rol() !== 'PACIENTE') { {{ c.profesional }} · }
                  {{ c.especialidad }} · {{ c.establecimiento }}
                  @if (rol() === 'PACIENTE') { · Paciente: {{ c.paciente }} }
                </p>
                @if (rol() === 'PROFESIONAL') {
                  <p class="detalle"><b>Motivo:</b> {{ c.motivo || 'No indicado' }} · <b>Alergias:</b> {{ c.alergias || 'No indicadas' }}</p>
                } @else {
                  <p class="detalle con-icono">
                    <app-icono nombre="tarjeta" [tamano]="15" />
                    <span>Copago {{ c.copago | currency: 'USD' : 'symbol' : '1.2-2' }}
                    @if (c.estadoPago) { · {{ c.estadoPago === 'APROBADO' ? 'Pagado' : c.estadoPago === 'RECHAZADO' ? 'Rechazado' : 'Pendiente' }} }
                    @if (c.ultimos4) { · {{ c.marca }} •••• {{ c.ultimos4 }} }</span>
                  </p>
                }
              </div>
              <div class="acciones">
                @if ((rol() === 'PACIENTE' || rol() === 'RECEPCION') && esActiva(c)) {
                  <button class="btn btn-peligro btn-pequeno" (click)="cancelar(c)">Cancelar</button>
                }
                @if (rol() === 'PROFESIONAL' && (c.estado === 'CONFIRMADA' || c.estado === 'ATENDIDA')) {
                  <button class="btn btn-secundario btn-pequeno" (click)="abrirNota(c)">
                    <app-icono nombre="nota" [tamano]="16" /> {{ c.estado === 'ATENDIDA' ? 'Editar nota' : 'Registrar nota' }}
                  </button>
                }
                @if (rol() === 'PACIENTE' && c.estado === 'ATENDIDA') {
                  <button class="btn btn-secundario btn-pequeno" (click)="abrirNota(c)"><app-icono nombre="nota" [tamano]="16" /> Ver nota</button>
                }
              </div>
            </article>
          } @empty {
            <div class="vacio">
              <span class="icono-circulo"><app-icono nombre="calendario" [tamano]="24" /></span>
              <strong>{{ vista() === 'activas' ? 'No hay citas activas' : 'Todavía no hay historial' }}</strong>
            </div>
          }
        </div>
      }
    </div>

    @if (citaNota(); as c) {
      <div class="fondo-modal" (click)="citaNota.set(null)">
        <div class="tarjeta modal" role="dialog" aria-modal="true" aria-labelledby="titulo-nota" (click)="$event.stopPropagation()">
          <div class="tarjeta-titulo">
            <span class="icono-circulo"><app-icono nombre="nota" /></span>
            <div style="flex: 1"><h2 id="titulo-nota">Nota de atención</h2>
              <p class="texto-suave pequeno" style="margin: 0">{{ c.paciente }} · {{ c.inicio | date: 'd MMM y, HH:mm' }}</p></div>
            <button class="btn-icono" (click)="citaNota.set(null)" aria-label="Cerrar"><app-icono nombre="cerrar" /></button>
          </div>
          @if (rol() === 'PROFESIONAL') {
            <label class="campo"><span>Observaciones de la consulta</span>
              <textarea rows="7" [(ngModel)]="nota" name="nota" maxlength="2000"></textarea>
              <small>{{ nota.length }}/2000 · Se guarda cifrada y solo la ven tú y el paciente.</small>
            </label>
            <div class="fila" style="justify-content: flex-end">
              <button class="btn btn-borde" (click)="citaNota.set(null)">Cancelar</button>
              <button class="btn btn-primario" (click)="guardarNota()" [disabled]="!nota.trim()">Guardar nota</button>
            </div>
          } @else {
            <p class="nota-texto">{{ nota || 'El profesional todavía no ha registrado la nota.' }}</p>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .cita { display: flex; align-items: center; gap: 18px; }
    .fecha { display: grid; justify-items: center; flex: none; width: 74px; padding: 10px 0; border-radius: 12px;
      background: var(--primario-suave); color: var(--primario); line-height: 1.15; }
    .mes { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .numero { font-size: 26px; font-weight: 700; }
    .hora { font-size: 12.5px; font-weight: 600; }
    .cuerpo { flex: 1; min-width: 0; }
    .cuerpo h3 { margin: 0; }
    .cuerpo p { margin: 6px 0 0; }
    .detalle { font-size: 14px; }
    .con-icono { display: flex; align-items: flex-start; gap: 6px; }
    .con-icono app-icono { margin-top: 3px; flex: none; }
    .acciones { display: flex; flex-direction: column; gap: 8px; }
    .nota-texto { white-space: pre-wrap; background: var(--superficie-2); padding: 14px; border-radius: 10px; }
    @media (max-width: 640px) {
      .cita { flex-wrap: wrap; align-items: flex-start; gap: 14px; }
      .fecha { width: 62px; }
      .acciones { flex-direction: row; width: 100%; }
      .acciones .btn { flex: 1; }
    }
  `,
})
export class Citas {
  private http = inject(HttpClient);
  private avisos = inject(Avisos);
  protected rol = inject(Sesion).rol;
  citas = signal<any[]>([]);
  cargando = signal(true);
  vista = signal<'activas' | 'historial'>('activas');
  citaNota = signal<any>(null);
  nota = '';
  avisoPago = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('pago'));

  titulo = computed(() => TITULOS[this.rol() ?? ''] ?? TITULOS['PACIENTE']);
  activas = computed(() => this.citas().filter((c) => this.esActiva(c)).reverse());
  historial = computed(() => this.citas().filter((c) => !this.esActiva(c)));
  visibles = computed(() => (this.vista() === 'activas' ? this.activas() : this.historial()));

  constructor() {
    this.cargar();
  }

  esActiva(c: any) {
    return c.estado === 'CONFIRMADA' || c.estado === 'PENDIENTE_PAGO';
  }

  estado(c: any) {
    return ESTADOS[c.estado] ?? { texto: c.estado, clase: '' };
  }

  async cargar() {
    try {
      this.citas.set(await firstValueFrom(this.http.get<any[]>('/api/citas')));
    } catch (e) {
      this.avisos.error(e);
    } finally {
      this.cargando.set(false);
    }
  }

  async cancelar(c: any) {
    if (!confirm('¿Seguro que deseas cancelar esta cita? El horario quedará libre para otra persona.')) return;
    try {
      await firstValueFrom(this.http.post(`/api/citas/${c.id}/cancelar`, {}));
      this.avisos.mostrar('Cita cancelada');
      await this.cargar();
    } catch (e) {
      this.avisos.error(e);
    }
  }

  async abrirNota(c: any) {
    try {
      const r = await firstValueFrom(this.http.get<{ nota: string | null }>(`/api/citas/${c.id}/nota`));
      this.nota = r.nota ?? '';
      this.citaNota.set(c);
    } catch (e) {
      this.avisos.error(e);
    }
  }

  async guardarNota() {
    try {
      await firstValueFrom(this.http.put(`/api/citas/${this.citaNota().id}/nota`, { nota: this.nota }));
      this.citaNota.set(null);
      this.avisos.mostrar('Nota guardada');
      await this.cargar();
    } catch (e) {
      this.avisos.error(e);
    }
  }
}
