import { Component, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Icono } from '../compartido/icono';
import { Avisos } from '../compartido/avisos';
import { Restringir, PATRON_NOMBRE } from '../compartido/restringir';

const ESTADO_VINCULO: Record<string, string> = { PENDIENTE: 'alerta', VERIFICADO: 'exito', RECHAZADO: 'peligro' };

@Component({
  selector: 'app-perfil',
  imports: [FormsModule, DatePipe, TitleCasePipe, Icono, Restringir],
  template: `
    <div class="pagina">
      <div class="encabezado-pagina">
        <div><h1>Mis datos</h1><p>Revisa tu información, tus seguros y tus preferencias de privacidad.</p></div>
      </div>

      @if (yo(); as d) {
        <div class="rejilla-2">
          <section class="tarjeta">
            <div class="tarjeta-titulo">
              <span class="avatar">{{ d.nombres[0] }}{{ d.apellidos[0] }}</span>
              <div><h2>{{ d.nombres }} {{ d.apellidos }}</h2><p class="texto-suave pequeno" style="margin:0">Paciente</p></div>
            </div>
            <dl class="datos">
              <dt>Identificación</dt><dd class="mono">{{ d.identificacion }}</dd>
              <dt>Fecha de nacimiento</dt><dd>{{ d.fechaNacimiento | date: 'd MMMM y' }}</dd>
              <dt>Teléfono</dt><dd>{{ d.telefono ?? 'No registrado' }}</dd>
            </dl>
            <p class="texto-suave pequeno" style="margin: 12px 0 0">Tu identificación se muestra parcialmente oculta y se guarda cifrada.</p>
          </section>

          <section class="tarjeta">
            <div class="tarjeta-titulo"><span class="icono-circulo"><app-icono nombre="candado" /></span><h2>Privacidad</h2></div>
            <label class="interruptor">
              <span><strong>Recordatorios por SMS</strong><br>
                <span class="texto-suave pequeno">Opcional. Los mensajes nunca incluyen datos médicos.</span></span>
              <input type="checkbox" [checked]="aceptaSms()" (change)="cambiarSms($event)">
              <span class="pista"></span>
            </label>
            <hr class="separador">
            <div class="pila" style="gap: 10px">
              <button class="btn btn-borde" (click)="exportar()"><app-icono nombre="descargar" /> Descargar mis datos</button>
              <button class="btn btn-peligro" (click)="cerrarSesiones()"><app-icono nombre="salir" /> Cerrar sesión en todos mis dispositivos</button>
            </div>
          </section>

          <section class="tarjeta">
            <div class="tarjeta-titulo"><span class="icono-circulo"><app-icono nombre="escudo" /></span><h2>Mis seguros</h2></div>
            @for (p of d.polizas; track p.id) {
              <div class="elemento">
                <div><strong>{{ p.aseguradora }}</strong><br><span class="mono texto-suave">{{ p.numero }}</span></div>
                <span class="insignia info">{{ p.relacion === 'TITULAR' ? 'Titular' : 'Beneficiario' }}</span>
              </div>
            } @empty { <p class="texto-suave pequeno">No tienes seguros registrados. Puedes atenderte como particular.</p> }

            <form #fp="ngForm" (ngSubmit)="agregarPoliza(fp)" class="formulario">
              <div class="campos-2">
                <label class="campo"><span>Aseguradora</span>
                  <select [(ngModel)]="poliza.aseguradoraId" name="aseg">
                    <option [ngValue]="1">Aseguradora A</option><option [ngValue]="2">Aseguradora B</option>
                  </select></label>
                <label class="campo"><span>Relación</span>
                  <select [(ngModel)]="poliza.relacion" name="relacion">
                    <option value="TITULAR">Titular</option><option value="BENEFICIARIO">Beneficiario</option>
                  </select></label>
              </div>
              <label class="campo"><span>Número de póliza</span>
                <input [(ngModel)]="poliza.numero" name="numero" required maxlength="20" minlength="4" [pattern]="polizaPatron" placeholder="Ej.: POL-1001" title="4 a 20 letras, números o guiones"></label>
              <button class="btn btn-secundario" [disabled]="fp.invalid"><app-icono nombre="mas" /> Agregar póliza</button>
            </form>
          </section>

          <section class="tarjeta">
            <div class="tarjeta-titulo"><span class="icono-circulo"><app-icono nombre="usuarios" /></span><h2>Dependientes</h2></div>
            @for (x of d.dependientes; track x.id) {
              <div class="elemento">
                <strong>{{ x.nombres }} {{ x.apellidos }}</strong>
                <span class="insignia" [class]="'insignia ' + claseVinculo(x.estado)">{{ x.estado | titlecase }}</span>
              </div>
            } @empty { <p class="texto-suave pequeno">No tienes dependientes vinculados.</p> }

            <form #fd="ngForm" (ngSubmit)="agregarDependiente(fd)" class="formulario">
              <div class="campos-2">
                <label class="campo"><span>Nombres</span><input [(ngModel)]="dependiente.nombres" name="dn" required restringir="letras" maxlength="50" minlength="2" [pattern]="nombrePatron" title="Solo letras y espacios"></label>
                <label class="campo"><span>Apellidos</span><input [(ngModel)]="dependiente.apellidos" name="da" required restringir="letras" maxlength="50" minlength="2" [pattern]="nombrePatron" title="Solo letras y espacios"></label>
                <label class="campo"><span>Cédula</span><input [(ngModel)]="dependiente.identificacion" name="di" required inputmode="numeric" restringir="digitos" maxlength="10" minlength="10" pattern="[0-9]{10}" title="Exactamente 10 dígitos"></label>
                <label class="campo"><span>Fecha de nacimiento</span>
                  <input type="date" [(ngModel)]="dependiente.fechaNacimiento" name="df" required [max]="hoy" min="1900-01-01"></label>
              </div>
              <p class="texto-suave pequeno">Solo menores de 15 años. El vínculo queda pendiente hasta que recepción revise el
                documento que acredita la representación.</p>
              <button class="btn btn-secundario" [disabled]="fd.invalid"><app-icono nombre="mas" /> Solicitar vínculo</button>
            </form>
          </section>
        </div>
      } @else {
        <div class="rejilla-2"><div class="esqueleto" style="height: 220px"></div><div class="esqueleto" style="height: 220px"></div></div>
      }
    </div>
  `,
  styles: `
    .datos { display: grid; grid-template-columns: auto 1fr; gap: 10px 18px; margin: 4px 0 0; }
    .datos dt { color: var(--texto-suave); font-size: 13.5px; }
    .datos dd { margin: 0; font-weight: 500; }
    .elemento { display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 14px; border-radius: 10px; background: var(--superficie-2); margin-bottom: 8px; }
    .formulario { margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--borde); }
  `,
})
export class Perfil {
  private http = inject(HttpClient);
  private avisos = inject(Avisos);
  hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  nombrePatron = PATRON_NOMBRE;
  polizaPatron = '[A-Za-z0-9-]{4,20}';
  yo = signal<any>(null);
  aceptaSms = signal(false);
  poliza = { aseguradoraId: 1, numero: '', relacion: 'TITULAR' };
  dependiente = { nombres: '', apellidos: '', identificacion: '', fechaNacimiento: '' };

  constructor() {
    this.cargar();
  }

  claseVinculo(estado: string) {
    return ESTADO_VINCULO[estado] ?? '';
  }

  async cargar() {
    try {
      const d = await firstValueFrom(this.http.get<any>('/api/pacientes/yo'));
      this.yo.set(d);
      this.aceptaSms.set(d.consentimientos.find((c: any) => c.finalidad === 'RECORDATORIOS_SMS')?.aceptado ?? false);
    } catch (e) {
      this.avisos.error(e);
    }
  }

  private async enviar(url: string, cuerpo: object): Promise<boolean> {
    try {
      const r = await firstValueFrom(this.http.post<any>(url, cuerpo));
      this.avisos.mostrar(r.mensaje);
      await this.cargar();
      return true;
    } catch (e) {
      this.avisos.error(e);
      return false;
    }
  }

  async cambiarSms(ev: Event) {
    const casilla = ev.target as HTMLInputElement;
    if (!(await this.enviar('/api/pacientes/consentimientos', { finalidad: 'RECORDATORIOS_SMS', aceptado: casilla.checked }))) {
      casilla.checked = !casilla.checked;
    }
  }

  async agregarPoliza(f: NgForm) {
    if (await this.enviar('/api/pacientes/polizas', this.poliza)) {
      f.resetForm({ aseg: 1, relacion: 'TITULAR', numero: '' });
    }
  }

  async agregarDependiente(f: NgForm) {
    if (await this.enviar('/api/pacientes/dependientes', this.dependiente)) f.resetForm();
  }

  async exportar() {
    try {
      const datos = await firstValueFrom(this.http.get('/api/pacientes/yo/exportar'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
      a.download = 'mis-datos.json';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      this.avisos.error(e);
    }
  }

  async cerrarSesiones() {
    if (!confirm('Se cerrará tu sesión en todos los dispositivos, incluido este. ¿Continuar?')) return;
    await firstValueFrom(this.http.post('/api/auth/cerrar-sesiones', {})).catch(() => null);
    window.location.href = '/login';
  }
}
