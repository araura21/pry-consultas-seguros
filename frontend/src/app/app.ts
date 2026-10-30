import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Sesion, NOMBRE_ROL } from './compartido/sesion';
import { Tema } from './compartido/tema';
import { Icono } from './compartido/icono';
import { AvisosFlotantes } from './compartido/avisos';

interface Enlace { ruta: string; texto: string; icono: string }

const MENU: Record<string, Enlace[]> = {
  PACIENTE: [
    { ruta: '/buscar', texto: 'Buscar', icono: 'buscar' },
    { ruta: '/citas', texto: 'Mis citas', icono: 'calendario' },
    { ruta: '/perfil', texto: 'Mis datos', icono: 'usuario' },
  ],
  PROFESIONAL: [{ ruta: '/citas', texto: 'Mi agenda', icono: 'calendario' }],
  RECEPCION: [
    { ruta: '/citas', texto: 'Citas', icono: 'calendario' },
    { ruta: '/recepcion', texto: 'Dependientes', icono: 'usuarios' },
  ],
  ASEGURADORA: [{ ruta: '/aseguradora', texto: 'Solicitudes', icono: 'lista' }],
  AUDITOR: [{ ruta: '/auditoria', texto: 'Auditoría', icono: 'escudo' }],
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono, AvisosFlotantes],
  template: `
    <a class="saltar" href="#contenido">Saltar al contenido</a>
    <header class="barra">
      <div class="barra-interior">
        <a class="marca" [routerLink]="sesion.rol() ? null : '/login'" aria-label="Consultas Seguras">
          <span class="logo"><app-icono nombre="escudo" [tamano]="20" /></span>
          <span class="marca-texto">Consultas <b>Seguras</b></span>
        </a>

        @if (sesion.rol()) {
          <nav class="nav" [class.abierta]="menuAbierto()" aria-label="Principal">
            @for (e of enlaces(); track e.ruta) {
              <a [routerLink]="e.ruta" routerLinkActive="activo" (click)="menuAbierto.set(false)">
                <app-icono [nombre]="e.icono" /> {{ e.texto }}
              </a>
            }
            <button class="nav-salir" (click)="salir()"><app-icono nombre="salir" /> Cerrar sesión</button>
          </nav>
        }

        <div class="acciones">
          @if (sesion.rol()) { <span class="rol">{{ nombreRol() }}</span> }
          <button class="btn-icono" (click)="tema.alternar()"
                  [attr.aria-label]="tema.oscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
                  [attr.title]="tema.oscuro() ? 'Modo claro' : 'Modo oscuro'">
            <app-icono [nombre]="tema.oscuro() ? 'sol' : 'luna'" [tamano]="20" />
          </button>
          @if (sesion.rol()) {
            <button class="btn-icono solo-escritorio" (click)="salir()" aria-label="Cerrar sesión" title="Cerrar sesión">
              <app-icono nombre="salir" [tamano]="20" />
            </button>
            <button class="btn-icono solo-movil" (click)="menuAbierto.set(!menuAbierto())"
                    [attr.aria-expanded]="menuAbierto()" aria-label="Abrir menú">
              <app-icono [nombre]="menuAbierto() ? 'cerrar' : 'menu'" [tamano]="22" />
            </button>
          }
        </div>
      </div>
    </header>

    <main id="contenido"><router-outlet /></main>
    <app-avisos />
  `,
  styles: `
    .saltar { position: absolute; left: -999px; top: 8px; z-index: 60; padding: 8px 14px; border-radius: 8px;
      background: var(--superficie); box-shadow: var(--sombra); }
    .saltar:focus { left: 8px; }
    .barra { position: sticky; top: 0; z-index: 30; background: var(--superficie-vidrio);
      backdrop-filter: saturate(1.6) blur(14px); border-bottom: 1px solid var(--borde); }
    .barra-interior { max-width: 1120px; margin: 0 auto; padding: 10px 20px; display: flex; align-items: center; gap: 18px; }
    .marca { display: flex; align-items: center; gap: 10px; color: var(--texto); text-decoration: none; }
    .logo { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px;
      background: var(--degradado); color: #fff; box-shadow: 0 6px 16px rgb(79 70 229 / 0.35); }
    .marca-texto { font-size: 16px; font-weight: 500; letter-spacing: -0.01em; }
    .marca-texto b { font-weight: 700; background: var(--degradado-texto); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .nav { display: flex; gap: 4px; flex: 1; }
    .nav a, .nav-salir { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 10px;
      color: var(--texto-suave); font-weight: 600; font-size: 14.5px; text-decoration: none; }
    .nav a:hover { color: var(--texto); background: var(--superficie-2); }
    .nav a.activo { color: var(--primario); background: var(--primario-suave); }
    .nav-salir { display: none; border: 0; background: none; font: inherit; cursor: pointer; }
    .acciones { display: flex; align-items: center; gap: 6px; margin-left: auto; }
    .rol { font-size: 12.5px; font-weight: 600; padding: 4px 10px; border-radius: 99px;
      color: var(--primario); background: var(--primario-suave); }
    .solo-movil { display: none; }

    @media (max-width: 760px) {
      .barra-interior { padding: 10px 16px; flex-wrap: wrap; gap: 10px; }
      .marca-texto { font-size: 15px; }
      .solo-escritorio { display: none; }
      .solo-movil { display: inline-grid; }
      .rol { display: none; }
      .nav { display: none; order: 3; flex-basis: 100%; flex-direction: column; padding: 6px 0 10px; }
      .nav.abierta { display: flex; }
      .nav a, .nav-salir { padding: 12px 14px; font-size: 15px; }
      .nav-salir { display: inline-flex; color: var(--peligro); }
    }
  `,
})
export class App {
  protected sesion = inject(Sesion);
  protected tema = inject(Tema);
  private router = inject(Router);
  protected menuAbierto = signal(false);
  protected enlaces = computed(() => MENU[this.sesion.rol() ?? ''] ?? []);
  protected nombreRol = computed(() => NOMBRE_ROL[this.sesion.rol() ?? ''] ?? '');

  constructor() {
    this.sesion.cargar();
    this.router.events.subscribe((e) => e instanceof NavigationEnd && this.menuAbierto.set(false));
  }

  async salir() {
    this.menuAbierto.set(false);
    await this.sesion.salir();
    this.router.navigate(['/login']);
  }
}
