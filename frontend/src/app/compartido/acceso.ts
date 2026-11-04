import { Component } from '@angular/core';
import { Icono } from './icono';

// Diseño compartido de login y registro: panel de marca + formulario
@Component({
  selector: 'app-acceso',
  imports: [Icono],
  template: `
    <div class="acceso">
      <section class="hero">
        <div class="hero-contenido">
          <span class="etiqueta-hero"><app-icono nombre="escudo" [tamano]="16" /> Red de consultorios</span>
          <h1>Tu salud en orden, tus datos protegidos.</h1>
          <p>Encuentra especialistas, verifica tu seguro y paga el copago en un solo lugar.</p>
          <ul>
            <li><app-icono nombre="check" /> Solo pedimos los datos necesarios para tu cita</li>
            <li><app-icono nombre="candado" /> Tu información sensible se guarda cifrada</li>
            <li><app-icono nombre="tarjeta" /> Tu tarjeta nunca pasa por nuestros servidores</li>
          </ul>
        </div>
      </section>
      <section class="formulario">
        <div class="tarjeta caja"><ng-content /></div>
      </section>
    </div>
  `,
  styles: `
    .acceso { max-width: 1120px; margin: 0 auto; padding: 32px 20px 64px;
      display: grid; grid-template-columns: 1.05fr 1fr; gap: 32px; align-items: center; min-height: calc(100dvh - 60px); }
    .hero { position: relative; overflow: hidden; border-radius: 24px; padding: 44px 40px; color: #fff;
      background: var(--degradado); box-shadow: var(--sombra-fuerte); }
    .hero::before, .hero::after { content: ''; position: absolute; border-radius: 50%; background: rgb(255 255 255 / 0.12); }
    .hero::before { width: 320px; height: 320px; right: -120px; top: -120px; }
    .hero::after { width: 200px; height: 200px; left: -70px; bottom: -90px; }
    .hero-contenido { position: relative; z-index: 1; }
    .etiqueta-hero { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 99px;
      background: rgb(255 255 255 / 0.18); font-size: 13px; font-weight: 600; margin-bottom: 18px; }
    .hero h1 { font-size: clamp(1.6rem, 3vw, 2.3rem); color: #fff; }
    .hero p { opacity: 0.92; font-size: 16px; }
    .hero ul { list-style: none; padding: 0; margin: 22px 0 0; display: grid; gap: 12px; }
    .hero li { display: flex; align-items: center; gap: 10px; font-weight: 500; }
    .hero li app-icono { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
      background: rgb(255 255 255 / 0.18); flex: none; }
    .caja { padding: 32px; max-width: 520px; margin: 0 auto; width: 100%; }

    @media (max-width: 900px) {
      .acceso { grid-template-columns: 1fr; gap: 20px; padding: 20px 16px 48px; min-height: 0; }
      .hero { padding: 26px 22px; border-radius: 20px; }
      .hero ul { display: none; }
      .caja { padding: 22px 18px; }
    }
  `,
})
export class Acceso {}
