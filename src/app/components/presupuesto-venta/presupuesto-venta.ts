import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { InversionService, DatosStateService } from '../../core/services';
import { PresupuestoVenta } from '../../interfaces/presupuestoVenta.interface';

@Component({
  selector: 'app-presupuesto-venta',
  standalone: false,
  templateUrl: './presupuesto-venta.html',
  styleUrl: './presupuesto-venta.css'
})
export class PresupuestoVentaComponent implements OnInit, OnDestroy {
  activeSection = 'dashboard';
  planId: number = 0;
  isSidebarCollapsed = false;
  presupuestos: PresupuestoVenta[] = [];
  presupuestosAgrupados: { anio: number; items: PresupuestoVenta[] }[] = [];
  cargando: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inversionService: InversionService,
    private readonly datosStateService: DatosStateService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
      // console.log('ID del plan en Presupuesto de Venta:', this.planId);
      if (this.planId) {
        this.suscribirseAlEstado();
        this.cargarPresupuestos();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Se suscribe a los cambios en el estado que afectan al presupuesto de venta
   */
  private suscribirseAlEstado(): void {
    // Suscribirse a cambios en ventas diarias (afectan al presupuesto)
    const ventasSub = this.datosStateService.ventasDiarias$.subscribe(ventas => {
      if (ventas && ventas.length > 0) {
        // console.log('Ventas diarias actualizadas, recargando presupuesto...');
        this.cargarPresupuestos();
      }
    });

    // Suscribirse a cambios en precios (afectan al presupuesto)
    const preciosSub = this.datosStateService.preciosProducto$.subscribe(precios => {
      if (precios && precios.length > 0) {
        // console.log('Precios actualizados, recargando presupuesto...');
        this.cargarPresupuestos();
      }
    });

    // Suscribirse a cambios en variables de sensibilidad
    const variablesSub = this.datosStateService.variablesSensibilidad$.subscribe(variables => {
      if (variables) {
        // console.log('Variables de sensibilidad actualizadas, recargando presupuesto...');
        this.cargarPresupuestos();
      }
    });

    this.subscriptions.push(ventasSub, preciosSub, variablesSub);
  }

  /**
   * Carga los presupuestos de venta desde el backend
   */
  cargarPresupuestos(): void {
    this.cargando = true;
    this.inversionService
      .getPresupuestoVenta(this.planId)
      .then((response) => {
        // console.log('Presupuestos de venta cargados:', response);
        this.presupuestos = Array.isArray(response) ? response : [];
        this.agruparPorAnio();
        // console.log('Presupuestos agrupados por año:', this.presupuestosAgrupados);
        this.cargando = false;
      })
      .catch((error) => {
        console.error('Error al cargar presupuestos de venta:', error);
        this.presupuestos = [];
        this.presupuestosAgrupados = [];
        this.cargando = false;
      });
  }

  /**
   * Agrupa los presupuestos por año
   */
  agruparPorAnio(): void {
    const aniosMap = new Map<number, PresupuestoVenta[]>();
    
    for (const presupuesto of this.presupuestos) {
      const anio = presupuesto.anio || 0;
      if (!aniosMap.has(anio)) {
        aniosMap.set(anio, []);
      }
      aniosMap.get(anio)!.push(presupuesto);
    }
    
    // Convertir a array y ordenar por año
    this.presupuestosAgrupados = Array.from(aniosMap.entries())
      .map(([anio, items]) => ({ anio, items }))
      .sort((a, b) => a.anio - b.anio);
  }

  /**
   * Genera array con los 12 meses repitiendo el valor mensual
   */
  getMeses(mensual: number): number[] {
    return new Array(12).fill(mensual);
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