import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { InversionService } from '../services/inversion.service';

/**
 * Deja entrar a las pantallas de un plan (`/modulo/:id`) solo si el plan existe y es del usuario.
 * El backend ya se lo niega a quien no es el dueño (404); esto evita mostrar una pantalla vacía
 * con errores cuando se escribe a mano un id inexistente o ajeno.
 */
@Injectable({ providedIn: 'root' })
export class PlanGuard implements CanActivate {
  private readonly inversionService = inject(InversionService);
  private readonly router = inject(Router);
  /** Planes ya comprobados en esta sesión: al cambiar de módulo no se repite la consulta. */
  private readonly verificados = new Set<number>();

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const id = Number(route.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) return this.rechazar();
    if (this.verificados.has(id)) return true;

    const accesible = await this.inversionService.planAccesible(id);
    if (accesible) this.verificados.add(id);
    return accesible ? true : this.rechazar();
  }

  private rechazar(): false {
    this.router.navigate(['/home']);
    return false;
  }
}
