import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InversionService } from '../../core/services';

@Component({
  selector: 'app-planificacion',
  standalone: false,
  templateUrl: './planificacion.html',
  styleUrl: './planificacion.css'
})
export class Planificacion implements OnInit {
  activeSection = 'planificacion';
  planId: number = 0; // ID del plan capturado de la ruta
  isSidebarCollapsed = false;

  // Eliminación del plan (se confirma en una ventana antes de borrar)
  nombrePlan = '';
  confirmandoEliminar = false;
  eliminando = false;
  errorEliminar = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inversionService: InversionService,
  ) {}

  ngOnInit(): void {
    // Captura el ID de la ruta
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
      // console.log('ID del plan en Planificación:', this.planId);
    });
  }

  pedirEliminar(): void {
    this.errorEliminar = '';
    this.confirmandoEliminar = true;
    this.inversionService
      .getPlanNegocio(this.planId)
      .then((plan) => (this.nombrePlan = plan.problematica))
      .catch(() => (this.nombrePlan = ''));
  }

  cancelarEliminar(): void {
    if (!this.eliminando) this.confirmandoEliminar = false;
  }

  async confirmarEliminar(): Promise<void> {
    if (!this.planId || this.eliminando) return;
    this.eliminando = true;
    this.errorEliminar = '';
    try {
      const { aviso } = await this.inversionService.eliminarPlanNegocio(this.planId);
      // El Home muestra el aviso si algo quedó pendiente (p. ej. el texto en Firebase)
      await this.router.navigate(['/home'], { state: { avisoEliminar: aviso ?? '' } });
    } catch (error) {
      this.errorEliminar = error instanceof Error ? error.message : 'No se pudo eliminar el plan.';
    } finally {
      this.eliminando = false;
    }
  }

  /**
   * Maneja el cambio de sección desde el sidebar
   */
  handleSidebarChange(section: string): void {
    this.activeSection = section;
    // console.log('Sección activa:', section);
  }

  /**
   * Maneja el cambio de estado collapsed del sidebar
   */
  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

}
