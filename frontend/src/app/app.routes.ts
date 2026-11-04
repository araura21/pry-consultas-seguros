import { Routes } from '@angular/router';
import { soloRoles } from './compartido/sesion';
import { Login } from './paginas/login';
import { Registro } from './paginas/registro';
import { Buscar } from './paginas/buscar';
import { Citas } from './paginas/citas';
import { Perfil } from './paginas/perfil';
import { Recepcion } from './paginas/recepcion';
import { Aseguradora } from './paginas/aseguradora';
import { Auditoria } from './paginas/auditoria';

export const routes: Routes = [
  { path: 'login', component: Login, title: 'Iniciar sesión · Consultas Seguras' },
  { path: 'registro', component: Registro, title: 'Crear cuenta · Consultas Seguras' },
  { path: 'buscar', component: Buscar, title: 'Buscar especialista · Consultas Seguras', canActivate: [soloRoles('PACIENTE')] },
  { path: 'perfil', component: Perfil, title: 'Mis datos · Consultas Seguras', canActivate: [soloRoles('PACIENTE')] },
  { path: 'citas', component: Citas, title: 'Citas · Consultas Seguras', canActivate: [soloRoles('PACIENTE', 'PROFESIONAL', 'RECEPCION')] },
  { path: 'recepcion', component: Recepcion, title: 'Dependientes · Consultas Seguras', canActivate: [soloRoles('RECEPCION')] },
  { path: 'aseguradora', component: Aseguradora, title: 'Solicitudes · Consultas Seguras', canActivate: [soloRoles('ASEGURADORA')] },
  { path: 'auditoria', component: Auditoria, title: 'Auditoría · Consultas Seguras', canActivate: [soloRoles('AUDITOR')] },
  { path: '**', redirectTo: 'login' },
];
