import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/login.service';

/** Exige sesión iniciada; quien aún tiene la contraseña provisional va a cambiarla antes de usar nada más. */
@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const perfil = await this.authService.obtenerPerfilDeAcceso();
    if (!perfil) return this.router.createUrlTree(['/login']);
    return perfil.debeCambiarClave ? this.router.createUrlTree(['/cambiar-clave']) : true;
  }
}

/** Solo exige sesión iniciada (para la pantalla de cambio de contraseña provisional). */
@Injectable({
  providedIn: 'root'
})
export class SesionGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const perfil = await this.authService.obtenerPerfilDeAcceso();
    return perfil ? true : this.router.createUrlTree(['/login']);
  }
}

/** Solo para quien tiene el rol de administrador de usuarios. El backend lo vuelve a comprobar en cada llamada. */
@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const perfil = await this.authService.obtenerPerfilDeAcceso();
    if (!perfil) return this.router.createUrlTree(['/login']);
    if (perfil.debeCambiarClave) return this.router.createUrlTree(['/cambiar-clave']);
    return perfil.esAdmin ? true : this.router.createUrlTree(['/home']);
  }
}
