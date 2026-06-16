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
  modoEdicion = false;
  guardandoCambios = false;
  editValues: Map<number, number[]> = new Map();
  cambiosPendientes: Set<number> = new Set();

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
  cargarPresupuestos(): Promise<void> {
    this.cargando = true;
    return this.inversionService
      .getPresupuestoVenta(this.planId)
      .then((response) => {
        this.presupuestos = Array.isArray(response) ? response : [];
        this.agruparPorAnio();
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

  getMesesValores(presupuesto: PresupuestoVenta): number[] {
    const base = presupuesto.mensual ?? 0;
    return [
      presupuesto.mes1, presupuesto.mes2, presupuesto.mes3,
      presupuesto.mes4, presupuesto.mes5, presupuesto.mes6,
      presupuesto.mes7, presupuesto.mes8, presupuesto.mes9,
      presupuesto.mes10, presupuesto.mes11, presupuesto.mes12,
    ].map(v => v ?? base);
  }

  toggleEdicion(): void {
    this.modoEdicion = !this.modoEdicion;
    if (this.modoEdicion) {
      this.inicializarEditValues();
    } else {
      this.cambiosPendientes.clear();
      this.editValues.clear();
    }
  }

  private inicializarEditValues(): void {
    this.editValues.clear();
    this.cambiosPendientes.clear();
    for (const grupo of this.presupuestosAgrupados) {
      for (const p of grupo.items) {
        this.editValues.set(p.id!, [...this.getMesesValores(p)]);
      }
    }
  }

  getEditVal(presupuesto: PresupuestoVenta, index: number): number {
    return this.editValues.get(presupuesto.id!)?.[index] ?? 0;
  }

  onMesInput(presupuesto: PresupuestoVenta, index: number, valor: number): void {
    const vals = this.editValues.get(presupuesto.id!) ?? [...this.getMesesValores(presupuesto)];
    vals[index] = isNaN(valor) ? 0 : valor;
    this.editValues.set(presupuesto.id!, vals);
    this.cambiosPendientes.add(presupuesto.id!);
  }

  getAnualEditado(presupuesto: PresupuestoVenta): number {
    const vals = this.editValues.get(presupuesto.id!);
    return vals ? vals.reduce((a, b) => a + b, 0) : (presupuesto.anual ?? 0);
  }

  get hayPendientes(): boolean {
    return this.cambiosPendientes.size > 0;
  }

  async guardarTodosCambios(): Promise<void> {
    if (!this.hayPendientes || this.guardandoCambios) return;
    this.guardandoCambios = true;
    try {
      const promesas = Array.from(this.cambiosPendientes).map(id => {
        const vals = this.editValues.get(id)!;
        const body: Partial<PresupuestoVenta> = { manual_override: true };
        vals.forEach((v, i) => { (body as any)[`mes${i + 1}`] = v; });
        body.anual = vals.reduce((a, b) => a + b, 0);
        return this.inversionService.patchPresupuestoVenta(id, body);
      });
      await Promise.all(promesas);
      this.cambiosPendientes.clear();
      await this.cargarPresupuestos();
      this.modoEdicion = false;
    } catch (error) {
      console.error('Error guardando cambios:', error);
    } finally {
      this.guardandoCambios = false;
    }
  }

  async quitarOverride(presupuesto: PresupuestoVenta): Promise<void> {
    const limpiar: Partial<PresupuestoVenta> = { manual_override: false };
    for (let i = 1; i <= 12; i++) (limpiar as any)[`mes${i}`] = null;
    await this.inversionService.patchPresupuestoVenta(presupuesto.id!, limpiar);
    presupuesto.manual_override = false;
    this.cambiosPendientes.delete(presupuesto.id!);
    this.cargarPresupuestos();
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
