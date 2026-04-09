import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/login.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.authService.getAuthState().pipe(
      take(1),
      map(user => {
        if (user) {
          return true;  // Usuario autenticado, permite el acceso
        } else {
          this.router.navigate(['/login']);  // Redirige al login si no está autenticado
          return false;
        }
      })
    );
  }
}
