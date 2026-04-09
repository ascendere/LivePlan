import { Component, EventEmitter, Input, Output, OnInit, HostBinding } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar implements OnInit {
  @Output() onItemChange = new EventEmitter<string>();
  @Output() onCollapsedChange = new EventEmitter<boolean>(); // Nuevo evento para notificar cambio de estado
  @Input() planId: number = 0; // ID del plan que viene del componente padre

  isCollapsed = false;
  activeItem = '';

  // Expone el estado collapsed como clase en el host
  @HostBinding('class.sidebar-collapsed') get collapsedClass() {
    return this.isCollapsed;
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Detectar la ruta actual al inicializar
    this.updateActiveItem(this.router.url);

    // Escuchar cambios de ruta
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateActiveItem(event.url);
    });
  }

  /**
   * Actualiza el item activo basado en la URL
   */
  private updateActiveItem(url: string): void {
    // Extraer la ruta base sin el ID
    const routeBase = url.split('/')[1]; // Obtiene 'planificacion', 'inversion', etc.
    
    const routeMap: { [key: string]: string } = {
      'planificacion': 'Planificacion',
      'inversion': 'inversion',
      'datos-iniciales': 'financiero',
      'depreciaciones': 'depreciaciones',
      'presupuesto-venta': 'marketing',
      'calculo-ventas': 'recursos',
      'costos-unitarios': 'operaciones',
      'prestamo': 'documentos',
      'materias-primas': 'materias',
      'gastos-operacion': 'gastos_operacion',
      'estados-financieros': 'estado_financiero',
      'evaluacion': 'evaluacion',
      'graficas': 'graficas',
      'costo-ventas': 'costo-ventas',
    };

    this.activeItem = routeMap[routeBase] || '';
    console.log('Ruta actual:', routeBase, '- Item activo:', this.activeItem);
  }

  /**
   * Alterna el estado de colapso del sidebar
   */
  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.onCollapsedChange.emit(this.isCollapsed); // Emitir el cambio
  }

  /**
   * Establece el item activo y emite el cambio
   */
  setActive(item: string): void {
    this.activeItem = item;
    this.onItemChange.emit(item);
    console.log('Navegando a:', item);
  }

  /**
   * Navega a la ruta especificada con el ID del plan
   */
  navigateTo(route: string): void {
    if (this.planId) {
      this.router.navigate([route, this.planId]);
    } else {
      console.error('No hay ID de plan disponible para navegar');
    }
  }
}
