import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment.example';
import { ApiService } from './api.service';

export interface FilaCarga {
  nombres: string;
  apellidos: string;
  correo: string;
  cedula: string;
  /** "cedula" (ecuatoriana, por defecto) o "extranjero" (pasaporte u otro documento). Vacío = cédula. */
  tipo_documento: string;
  carrera: string;
  asignatura: string;
}

export type EstadoCarga = 'creado' | 'vinculado' | 'actualizado' | 'sin_cambios' | 'error';

export interface ResultadoCarga {
  /** 1 = primera fila de datos del archivo (la que sigue al encabezado). */
  fila: number;
  filas?: number[];
  correo?: string;
  estado: EstadoCarga;
  mensaje: string;
}

export interface RespuestaCarga {
  simulado: boolean;
  resumen: Partial<Record<EstadoCarga, number>>;
  resultados: ResultadoCarga[];
}

export interface Asignacion {
  carrera: string;
  asignatura: string;
}

export interface UsuarioAdmin {
  id: number;
  uid: string;
  correo: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  tipo_documento: string;
  activo: boolean;
  creado_en: string;
  asignaciones: Asignacion[];
}

export interface PaginaUsuarios {
  total: number;
  pagina: number;
  por_pagina: number;
  usuarios: UsuarioAdmin[];
}

/** Llamadas del módulo de administración de usuarios (el backend exige el rol de administrador). */
@Injectable({ providedIn: 'root' })
export class UsuariosAdminService {
  private readonly api = inject(ApiService);
  private readonly base = `${environment.backend.url}/admin/usuarios`;

  async listar(q: string, pagina: number, porPagina = 50): Promise<PaginaUsuarios> {
    const params = new URLSearchParams({ pagina: String(pagina), por_pagina: String(porPagina) });
    if (q.trim()) params.set('q', q.trim());
    return this.pedir(`${this.base}?${params}`);
  }

  /** `simular` = solo valida y dice qué pasaría con cada fila, sin crear nada (vista previa). */
  async cargar(filas: FilaCarga[], simular: boolean): Promise<RespuestaCarga> {
    return this.pedir(`${this.base}/carga${simular ? '?simular=1' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filas }),
    });
  }

  async cambiarActivo(id: number, activo: boolean): Promise<UsuarioAdmin> {
    return this.pedir(`${this.base}/${id}/activo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo }),
    });
  }

  async formatearClave(id: number): Promise<void> {
    await this.pedir(`${this.base}/${id}/formatear-clave`, { method: 'POST' });
  }

  private async pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
    let respuesta: Response;
    try {
      respuesta = await this.api.fetch(url, init);
    } catch {
      throw new Error('No hay conexión con el servidor.');
    }
    if (!respuesta.ok) {
      let mensaje = `Error ${respuesta.status}`;
      try {
        const cuerpo = await respuesta.json();
        if (cuerpo?.mensaje) mensaje = cuerpo.mensaje;
      } catch {
        /* cuerpo sin JSON */
      }
      throw new Error(mensaje);
    }
    return respuesta.json();
  }
}
