import { Injectable, signal } from '@angular/core';

// Tema claro/oscuro. La preferencia se recuerda en este navegador (no es un dato sensible).
// El tema inicial lo aplica un script en index.html para que la página no parpadee al cargar.
@Injectable({ providedIn: 'root' })
export class Tema {
  readonly oscuro = signal(document.documentElement.getAttribute('data-tema') === 'oscuro');

  alternar() {
    this.oscuro.update((v) => !v);
    const tema = this.oscuro() ? 'oscuro' : 'claro';
    document.documentElement.setAttribute('data-tema', tema);
    try {
      localStorage.setItem('tema', tema);
    } catch {
      // modo privado o almacenamiento bloqueado: el tema funciona igual en esta visita
    }
  }
}
