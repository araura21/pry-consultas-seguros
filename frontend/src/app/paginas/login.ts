import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Sesion, INICIO_ROL, mensajeError } from '../compartido/sesion';
import { Acceso } from '../compartido/acceso';
import { Icono } from '../compartido/icono';
import { Restringir } from '../compartido/restringir';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, Acceso, Icono, Restringir],
  template: `
    <app-acceso>
      <h2>Iniciar sesión</h2>
      <p class="texto-suave">Ingresa con tu correo y contraseña.</p>

      @if (error()) {
        <div class="banda error" role="alert"><app-icono nombre="alerta" /><p>{{ error() }}</p></div>
      }

      <form (ngSubmit)="entrar()" #f="ngForm">
        <label class="campo">
          <span>Correo electrónico</span>
          <input name="email" type="email" [(ngModel)]="datos.email" required maxlength="100" autocomplete="username" placeholder="nombre@correo.com">
        </label>
        <label class="campo">
          <span>Contraseña</span>
          <div class="con-boton">
            <input name="password" [type]="verClave() ? 'text' : 'password'" [(ngModel)]="datos.password" required maxlength="64"
                   autocomplete="current-password">
            <button type="button" class="btn-icono" (click)="verClave.set(!verClave())"
                    [attr.aria-label]="verClave() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
              <app-icono [nombre]="verClave() ? 'ojoOculto' : 'ojo'" />
            </button>
          </div>
        </label>

        <label class="casilla">
          <input type="checkbox" name="personal" [(ngModel)]="esPersonal">
          <span>Soy personal del consultorio, aseguradora o auditoría</span>
        </label>
        @if (esPersonal) {
          <label class="campo" style="margin-top: 14px">
            <span>Código de verificación</span>
            <input name="totp" [(ngModel)]="datos.totp" inputmode="numeric" restringir="digitos" maxlength="6" minlength="6" pattern="[0-9]{6}"
                   autocomplete="one-time-code" placeholder="6 dígitos de tu app autenticadora">
            <small>El personal debe usar doble factor de autenticación.</small>
          </label>
        }

        <button class="btn btn-primario btn-bloque" style="margin-top: 18px" [disabled]="cargando() || f.invalid">
          @if (cargando()) { <span class="girando"></span> Entrando… } @else { Entrar }
        </button>
      </form>

      <hr class="separador">
      <p class="texto-suave pequeno" style="margin: 0; text-align: center">
        ¿Eres paciente y no tienes cuenta? <a routerLink="/registro">Crea una aquí</a>
      </p>
    </app-acceso>
  `,
})
export class Login {
  private http = inject(HttpClient);
  private router = inject(Router);
  private sesion = inject(Sesion);
  datos = { email: '', password: '', totp: '' };
  esPersonal = false;
  verClave = signal(false);
  cargando = signal(false);
  error = signal('');

  constructor() {
    // Si ya hay una sesión abierta, no tiene sentido mostrar el login
    this.sesion.cargar().then((rol) => {
      if (rol) this.router.navigateByUrl(INICIO_ROL[rol]);
    });
  }

  async entrar() {
    this.error.set('');
    this.cargando.set(true);
    const { totp, ...resto } = this.datos;
    try {
      const r = await firstValueFrom(
        this.http.post<{ rol: string }>('/api/auth/login', this.esPersonal && totp ? this.datos : resto),
      );
      this.sesion.rol.set(r.rol);
      this.router.navigateByUrl(INICIO_ROL[r.rol]);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
