import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/login.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  standalone: false
})
export class Header implements OnInit, OnDestroy {
  isLoggedIn: boolean = false;
  /** Tiene el rol de administrador de usuarios: se le muestra el botón de administración. */
  esAdmin: boolean = false;
  private authSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Suscribirse al estado de autenticación
    this.authSubscription = this.authService.getAuthState().subscribe(async user => {
      this.isLoggedIn = !!user; // Convierte a boolean
      // El rol viene en el token; ocultar el botón solo es comodidad: el backend lo vuelve a exigir.
      this.esAdmin = user ? !!(await this.authService.obtenerPerfilDeAcceso())?.esAdmin : false;
    });
  }

  ngOnDestroy(): void {
    // Limpiar suscripción para evitar memory leaks
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  async onAuthAction(): Promise<void> {
    if (this.isLoggedIn) {
      // Si está logueado, cerrar sesión
      await this.authService.logout();
    } else {
      // Si no está logueado, redirigir a login
      this.router.navigate(['/login']);
    }
  }
}
