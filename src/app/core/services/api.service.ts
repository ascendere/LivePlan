import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './login.service';

const MENSAJE_NO_AUTORIZADA =
  'Tu cuenta no está autorizada para usar la herramienta. Pide acceso al administrador.';
const MENSAJE_SESION_TERMINADA =
  'Tu sesión terminó o tu cuenta fue deshabilitada. Contacta al administrador si crees que es un error.';

/**
 * fetch al backend con el ID token de Firebase del usuario. El backend lo exige en cada petición y de él
 * saca quién es la persona, de quién es cada plan y qué rol tiene.
 *
 * Además reacciona a los avisos del backend sobre la cuenta:
 *  - 401: token vencido → pide uno nuevo y reintenta una vez; si sigue fallando, la sesión ya no vale.
 *  - 403 "cambiar_clave": la persona aún tiene la contraseña provisional → la lleva a cambiarla.
 *  - 403 "cuenta_deshabilitada": cierra la sesión y avisa en el login.
 *  - 403 "cuenta_no_autorizada": la cuenta se creó por su cuenta y no está en la lista del administrador.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const enviar = async (renovarToken: boolean) => {
      const headers = new Headers(init.headers);
      const token = await this.authService.obtenerToken(renovarToken);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...init, headers });
    };
    let respuesta = await enviar(false);
    if (respuesta.status === 401) {
      try {
        respuesta = await enviar(true);
      } catch {
        // Firebase no puede renovar el token: la sesión se revocó (cuenta deshabilitada, contraseña restablecida...).
        await this.authService.logout(MENSAJE_SESION_TERMINADA);
        return respuesta;
      }
    }
    await this.atenderAvisosDeCuenta(respuesta);
    return respuesta;
  }

  /** Código de error que el backend manda en el cuerpo ({"codigo": "..."}), sin consumir la respuesta. */
  async codigoDeError(respuesta: Response): Promise<string | null> {
    try {
      const cuerpo = await respuesta.clone().json();
      return typeof cuerpo?.codigo === 'string' ? cuerpo.codigo : null;
    } catch {
      return null;
    }
  }

  private async atenderAvisosDeCuenta(respuesta: Response): Promise<void> {
    if (respuesta.status !== 401 && respuesta.status !== 403) return;
    const codigo = await this.codigoDeError(respuesta);
    if (codigo === 'cambiar_clave') {
      if (!this.router.url.startsWith('/cambiar-clave')) this.router.navigate(['/cambiar-clave']);
    } else if (codigo === 'cuenta_no_autorizada') {
      await this.authService.logout(MENSAJE_NO_AUTORIZADA);
    } else if (codigo === 'cuenta_deshabilitada' || codigo === 'sesion_revocada') {
      await this.authService.logout(MENSAJE_SESION_TERMINADA);
    }
  }
}
