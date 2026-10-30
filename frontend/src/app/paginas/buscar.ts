import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Icono } from '../compartido/icono';
import { Avisos } from '../compartido/avisos';
import { Restringir, PATRON_NOMBRE } from '../compartido/restringir';

const iniciales = (nombre: string) =>
  nombre.replace(/^(Dra?\.)\s*/, '').split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();

@Component({
  selector: 'app-buscar',
  imports: [FormsModule, DatePipe, CurrencyPipe, Icono, Restringir],
  template: `
    <div class="pagina">
      <div class="encabezado-pagina">
        <div>
          <h1>Buscar especialista</h1>
          <p>Elige un profesional y un horario. No necesitas ingresar datos médicos para ver la agenda.</p>
        </div>
      </div>

      <form class="tarjeta filtros" (ngSubmit)="buscar()">
        <label class="campo"><span>Especialidad</span>
          <input name="esp" [(ngModel)]="filtro.especialidad" restringir="letras" maxlength="50" placeholder="Ej.: Cardiología"></label>
        <label class="campo"><span>Ciudad</span>
          <input name="ciudad" [(ngModel)]="filtro.ciudad" restringir="letras" maxlength="50" placeholder="Ej.: Quito"></label>
        <button class="btn btn-primario"><app-icono nombre="buscar" /> Buscar</button>
      </form>

      <div class="distribucion">
        <section class="pila" aria-label="Resultados">
          @if (buscando()) {
            <div class="esqueleto"></div><div class="esqueleto"></div>
          } @else {
            @for (p of profesionales(); track p.id) {
              <article class="tarjeta tarjeta-interactiva profesional" [class.seleccionada]="elegido()?.id === p.id">
                <span class="avatar">{{ iniciales(p.nombres) }}</span>
                <div class="datos">
                  <h3>{{ p.nombres }}</h3>
                  <div class="fila pequeno texto-suave">
                    <span class="insignia info">{{ p.especialidad }}</span>
                    <span class="fila" style="gap:4px"><app-icono nombre="edificio" [tamano]="15" /> {{ p.establecimiento }} · {{ p.ciudad }}</span>
                  </div>
                </div>
                <div class="precio">
                  <small class="texto-suave">Consulta</small>
                  <strong>{{ p.precio | currency: 'USD' : 'symbol' : '1.2-2' }}</strong>
                  <button class="btn btn-secundario btn-pequeno" (click)="elegir(p)">Ver horarios</button>
                </div>
              </article>
            } @empty {
              <div class="vacio">
                <span class="icono-circulo"><app-icono nombre="buscar" [tamano]="24" /></span>
                <strong>Sin resultados</strong>
                <span class="pequeno">Prueba con otra especialidad o ciudad.</span>
              </div>
            }
          }
        </section>

        <aside class="panel" #panel>
          @if (elegido(); as p) {
            <div class="tarjeta">
              <div class="tarjeta-titulo">
                <span class="icono-circulo"><app-icono nombre="calendario" /></span>
                <div><h2>Reservar cita</h2><p class="texto-suave pequeno" style="margin:0">{{ p.nombres }} · {{ p.especialidad }}</p></div>
              </div>

              <span class="etiqueta">Horario disponible</span>
              @for (dia of diasVisibles(); track dia.fecha) {
                <p class="dia">{{ dia.fecha | date: 'EEEE d MMM' }}</p>
                <div class="chips">
                  @for (h of dia.horas; track h.id) {
                    <button type="button" class="chip" [class.activo]="reserva.horarioId === h.id"
                            (click)="reserva.horarioId = h.id" [attr.aria-pressed]="reserva.horarioId === h.id">
                      {{ h.inicio | date: 'HH:mm' }}
                    </button>
                  }
                </div>
              } @empty {
                <p class="texto-suave pequeno">No hay horarios libres para este profesional.</p>
              }
              @if (horariosPorDia().length > diasVisibles().length) {
                <button type="button" class="btn btn-borde btn-pequeno" style="margin-top: 12px" (click)="todosLosDias.set(true)">
                  Ver más fechas ({{ horariosPorDia().length - diasVisibles().length }})
                </button>
              }

              <hr class="separador">
              <label class="campo"><span>¿Para quién es la cita?</span>
                <select [(ngModel)]="reserva.pacienteId" name="paciente">
                  <option [ngValue]="null">Para mí</option>
                  @for (d of dependientesVerificados(); track d.paciente_id) {
                    <option [ngValue]="d.paciente_id">{{ d.nombres }} {{ d.apellidos }}</option>
                  }
                </select>
              </label>
              <label class="campo"><span>Forma de pago</span>
                <select [(ngModel)]="reserva.polizaId" name="poliza">
                  <option [ngValue]="null">Particular (sin seguro)</option>
                  @for (s of polizas(); track s.id) { <option [ngValue]="s.id">{{ s.aseguradora }} · {{ s.numero }}</option> }
                </select>
              </label>
              <label class="campo"><span>Motivo de consulta <span class="texto-suave">(opcional)</span></span>
                <input [(ngModel)]="reserva.motivo" name="motivo" maxlength="100" placeholder="Solo lo verá tu médico"></label>
              <label class="campo"><span>Alergias relevantes <span class="texto-suave">(opcional)</span></span>
                <input [(ngModel)]="reserva.alergias" name="alergias" maxlength="100"></label>

              <div class="banda pequeno">
                <app-icono nombre="escudo" />
                <p>El copago lo calcula el sistema con la respuesta de tu aseguradora. Pagarás en la página segura de la pasarela.</p>
              </div>
              <button class="btn btn-primario btn-bloque" (click)="reservar()" [disabled]="!reserva.horarioId || reservando()">
                @if (reservando()) { <span class="girando"></span> Reservando… } @else { Reservar }
              </button>
            </div>
          } @else {
            <div class="vacio">
              <span class="icono-circulo"><app-icono nombre="calendario" [tamano]="24" /></span>
              <strong>Elige un especialista</strong>
              <span class="pequeno">Aquí verás sus horarios disponibles.</span>
            </div>
          }
        </aside>
      </div>
    </div>
  `,
  styles: `
    .filtros { display: grid; grid-template-columns: 1fr 1fr auto; gap: 14px; align-items: end; margin-bottom: 22px; }
    .filtros .campo { margin: 0; }
    .distribucion { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 20px; align-items: start; }
    .panel { position: sticky; top: 84px; }
    .profesional { display: flex; align-items: center; gap: 14px; }
    .profesional .datos { flex: 1; min-width: 0; }
    .profesional h3 { margin-bottom: 6px; }
    .precio { display: grid; justify-items: end; gap: 2px; }
    .precio strong { font-size: 17px; margin-bottom: 6px; }
    .dia { margin: 12px 0 6px; font-size: 13px; font-weight: 600; color: var(--texto-suave); text-transform: capitalize; }
    @media (max-width: 860px) {
      .distribucion { grid-template-columns: 1fr; }
      .panel { position: static; }
    }
    @media (max-width: 560px) {
      .filtros { grid-template-columns: 1fr; }
      .profesional { flex-wrap: wrap; }
      .precio { width: 100%; grid-template-columns: 1fr auto; align-items: center; justify-items: start; }
      .precio small { display: none; }
      .precio strong { margin: 0; }
    }
  `,
})
export class Buscar {
  private http = inject(HttpClient);
  private avisos = inject(Avisos);
  private panel = viewChild<ElementRef<HTMLElement>>('panel');
  iniciales = iniciales;
  filtro = { especialidad: '', ciudad: '' };
  profesionales = signal<any[]>([]);
  buscando = signal(false);
  elegido = signal<any>(null);
  horarios = signal<any[]>([]);
  polizas = signal<any[]>([]);
  dependientesVerificados = signal<any[]>([]);
  reserva: any = this.reservaVacia();
  reservando = signal(false);

  horariosPorDia = computed(() => {
    const dias = new Map<string, any[]>();
    for (const h of this.horarios()) {
      const clave = new Date(h.inicio).toDateString();
      dias.set(clave, [...(dias.get(clave) ?? []), h]);
    }
    return [...dias.values()].map((horas) => ({ fecha: horas[0].inicio, horas }));
  });

  todosLosDias = signal(false);
  diasVisibles = computed(() => (this.todosLosDias() ? this.horariosPorDia() : this.horariosPorDia().slice(0, 3)));

  constructor() {
    this.buscar();
  }

  private reservaVacia() {
    return { horarioId: null, pacienteId: null, polizaId: null, motivo: '', alergias: '' };
  }

  async buscar() {
    this.buscando.set(true);
    const params: Record<string, string> = {};
    if (this.filtro.especialidad.trim()) params['especialidad'] = this.filtro.especialidad.trim();
    if (this.filtro.ciudad.trim()) params['ciudad'] = this.filtro.ciudad.trim();
    try {
      this.profesionales.set(await firstValueFrom(this.http.get<any[]>('/api/profesionales', { params })));
    } catch (e) {
      this.avisos.error(e);
    } finally {
      this.buscando.set(false);
    }
  }

  async elegir(p: any) {
    this.elegido.set(p);
    this.todosLosDias.set(false);
    this.reserva = this.reservaVacia();
    try {
      const [horarios, yo] = await Promise.all([
        firstValueFrom(this.http.get<any[]>(`/api/profesionales/${p.id}/horarios`)),
        firstValueFrom(this.http.get<any>('/api/pacientes/yo')),
      ]);
      this.horarios.set(horarios);
      this.polizas.set(yo.polizas);
      this.dependientesVerificados.set(yo.dependientes.filter((d: any) => d.estado === 'VERIFICADO'));
      if (window.innerWidth < 860) this.panel()?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      this.avisos.error(e);
    }
  }

  async reservar() {
    this.reservando.set(true);
    // Solo se envían los campos con valor; nunca el precio ni el copago
    const cuerpo = Object.fromEntries(Object.entries(this.reserva).filter(([, v]) => v !== null && v !== ''));
    try {
      const r = await firstValueFrom(this.http.post<any>('/api/citas', cuerpo));
      if (r.urlPago) {
        // Redirige a la pasarela: la tarjeta se escribe allí, no en esta aplicación
        window.location.href = r.urlPago;
        return;
      }
      this.avisos.mostrar('Cita confirmada. No tienes copago que pagar.');
      this.elegir(this.elegido());
    } catch (e) {
      this.avisos.error(e);
    }
    this.reservando.set(false);
  }
}
