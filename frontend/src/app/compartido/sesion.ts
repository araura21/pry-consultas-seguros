import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';

export const NOMBRE_ROL: Record<string, string> = {
  PACIENTE: 'Paciente', PROFESIONAL: 'Profesional', RECEPCION: 'Recepción', ASEGURADORA: 'Aseguradora', AUDITOR: 'Auditoría',
};

export const INICIO_ROL: Record<string, string> = {
  PACIENTE: '/buscar', PROFESIONAL: '/citas', RECEPCION: '/citas', ASEGURADORA: '/aseguradora', AUDITOR: '/auditoria',
};

// El frontend solo guarda el ROL para mostrar el menú. La sesión es una cookie
// HttpOnly que JavaScript no puede leer, y no se guarda nada en localStorage.
@Injectable({ providedIn: 'root' })
export class Sesion {
  private http = inject(HttpClient);
  readonly rol = signal<string | null>(null);

  async cargar(): Promise<string | null> {
    try {
      const r = await firstValueFrom(this.http.get<{ rol: string }>('/api/auth/yo'));
      this.rol.set(r.rol);
    } catch {
      this.rol.set(null);
    }
    return this.rol();
  }

  async salir() {
    await firstValueFrom(this.http.post('/api/auth/logout', {})).catch(() => null);
    this.rol.set(null);
  }
}

// Si la API responde 401 (sesión vencida o cerrada), se vuelve al login
export const sesionInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const sesion = inject(Sesion);
  return next(req).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && !req.url.endsWith('/auth/yo') && !req.url.endsWith('/auth/login')) {
        sesion.rol.set(null);
        router.navigate(['/login']);
      }
      return throwError(() => e);
    }),
  );
};

// Solo controla qué pantallas se muestran. La autorización REAL la hace el backend.
export function soloRoles(...roles: string[]): CanActivateFn {
  return async () => {
    const sesion = inject(Sesion);
    const router = inject(Router);
    const rol = sesion.rol() ?? (await sesion.cargar());
    return rol && roles.includes(rol) ? true : router.parseUrl('/login');
  };
}

// Extrae el mensaje de error que envía la API
export function mensajeError(e: unknown): string {
  const r = e as HttpErrorResponse;
  if (r?.status === 0) return 'No hay conexión con el servidor';
  return r?.error?.error ?? 'Ocurrió un error inesperado';
}
