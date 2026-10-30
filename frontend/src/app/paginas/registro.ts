import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { mensajeError } from '../compartido/sesion';
import { Acceso } from '../compartido/acceso';
import { Icono } from '../compartido/icono';
import { Avisos } from '../compartido/avisos';
import { Restringir, PATRON_NOMBRE } from '../compartido/restringir';

// S02/S05: solo se piden los datos mínimos. No hay campos de historia clínica,
// religión, ingresos, empleador, ubicación ni contactos.
@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink, Acceso, Icono, Restringir],
  template: `
    <app-acceso>
      <h2>Crear cuenta de paciente</h2>
      <p class="texto-suave">Solo te pedimos lo necesario para gestionar tus citas.</p>

      @if (error()) {
        <div class="banda error" role="alert"><app-icono nombre="alerta" /><p>{{ error() }}</p></div>
      }

      <form (ngSubmit)="registrar()" #f="ngForm">
        <div class="campos-2">
          <label class="campo"><span>Nombres</span>
            <input name="nombres" [(ngModel)]="datos.nombres" required autocomplete="given-name" restringir="letras" maxlength="50" minlength="2" [pattern]="nombrePatron" title="Solo letras y espacios"></label>
          <label class="campo"><span>Apellidos</span>
            <input name="apellidos" [(ngModel)]="datos.apellidos" required autocomplete="family-name" restringir="letras" maxlength="50" minlength="2" [pattern]="nombrePatron" title="Solo letras y espacios"></label>
          <label class="campo"><span>Cédula (10 dígitos)</span>
            <input name="identificacion" [(ngModel)]="datos.identificacion" required inputmode="numeric" restringir="digitos" maxlength="10" minlength="10" pattern="[0-9]{10}" placeholder="1712345678" title="Exactamente 10 dígitos"></label>
          <label class="campo"><span>Fecha de nacimiento</span>
            <input name="fechaNacimiento" type="date" [(ngModel)]="datos.fechaNacimiento" required [max]="hoy" min="1900-01-01"></label>
          <label class="campo"><span>Correo electrónico</span>
            <input name="email" type="email" [(ngModel)]="datos.email" required autocomplete="email" maxlength="100"></label>
          <label class="campo"><span>Teléfono <span class="texto-suave">(opcional, 10 dígitos)</span></span>
            <input name="telefono" type="tel" [(ngModel)]="datos.telefono" autocomplete="tel" inputmode="numeric" restringir="digitos" maxlength="10" pattern="([0-9]{10})?" placeholder="0991234567" title="Exactamente 10 dígitos"></label>
        </div>

        <label class="campo">
          <span>Contraseña</span>
          <div class="con-boton">
            <input name="password" [type]="verClave() ? 'text' : 'password'" [(ngModel)]="datos.password"
                   (ngModelChange)="clave.set($event)" required minlength="12" maxlength="64" autocomplete="new-password">
            <button type="button" class="btn-icono" (click)="verClave.set(!verClave())"
                    [attr.aria-label]="verClave() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
              <app-icono [nombre]="verClave() ? 'ojoOculto' : 'ojo'" />
            </button>
          </div>
          <div class="medidor" [attr.data-nivel]="nivelClave()"><i></i><i></i><i></i></div>
          <small>Entre 12 y 64 caracteres. Una frase de varias palabras es más segura y fácil de recordar.</small>
        </label>

        <label class="casilla">
          <input type="checkbox" name="sms" [(ngModel)]="datos.aceptaRecordatoriosSms">
          <span>Quiero recibir recordatorios por SMS. <span class="texto-suave">Es opcional y puedo retirarlo cuando quiera.</span></span>
        </label>

        <div class="banda" style="margin-top: 16px">
          <app-icono nombre="escudo" />
          <p class="pequeno">Tus datos se usan solo para gestionar tus citas, verificar tu seguro y cobrar el copago.
            No se usan para publicidad.</p>
        </div>

        <button class="btn btn-primario btn-bloque" [disabled]="cargando() || f.invalid">
          @if (cargando()) { <span class="girando"></span> Creando cuenta… } @else { Crear cuenta }
        </button>
      </form>

      <hr class="separador">
      <p class="texto-suave pequeno" style="margin: 0; text-align: center">
        ¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a>
      </p>
    </app-acceso>
  `,
  styles: `
    .medidor { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .medidor i { height: 5px; border-radius: 99px; background: var(--borde); transition: background 0.2s ease; }
    .medidor[data-nivel='1'] i:nth-child(-n+1) { background: var(--peligro); }
    .medidor[data-nivel='2'] i:nth-child(-n+2) { background: var(--alerta); }
    .medidor[data-nivel='3'] i { background: var(--exito); }
  `,
})
export class Registro {
  private http = inject(HttpClient);
  private router = inject(Router);
  private avisos = inject(Avisos);
  nombrePatron = PATRON_NOMBRE;
  hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  datos = { nombres: '', apellidos: '', identificacion: '', fechaNacimiento: '', telefono: '', email: '', password: '', aceptaRecordatoriosSms: false };
  clave = signal('');
  verClave = signal(false);
  cargando = signal(false);
  error = signal('');

  // Solo orienta al usuario; la regla real la valida el servidor
  nivelClave = computed(() => {
    const c = this.clave();
    if (!c) return 0;
    if (c.length < 12) return 1;
    return c.length >= 16 || /[^A-Za-z0-9]/.test(c) ? 3 : 2;
  });

  async registrar() {
    this.error.set('');
    this.cargando.set(true);
    const { telefono, ...resto } = this.datos;
    try {
      await firstValueFrom(this.http.post('/api/auth/registro', telefono ? this.datos : resto));
      this.avisos.mostrar('Cuenta creada. Ya puedes iniciar sesión.');
      this.router.navigate(['/login']);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
