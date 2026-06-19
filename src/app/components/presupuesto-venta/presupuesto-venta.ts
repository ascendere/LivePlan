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

  // Valores calculados por mes: { [productoId]: { [anio]: number[12] } }
  private ventasPorMes: { [id: number]: { [anio: number]: number[] } } = {};

  // --- Edición del AÑO 1 ---
  modoEdicion: boolean = false;
  guardando: boolean = false;
  // valores editables por producto: { [productoId]: number[12] }
  mesesEdit: { [id: number]: number[] } = {};
  private mesesOriginal: { [id: number]: number[] } = {};

  private subscriptions: Subscription[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inversionService: InversionService,
    private readonly datosStateService: DatosStateService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
      if (this.planId) {
        this.suscribirseAlEstado();
        this.cargarTodo();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private suscribirseAlEstado(): void {
    const recargar = () => { if (!this.modoEdicion) this.cargarTodo(); };
    const s1 = this.datosStateService.ventasDiarias$.subscribe(v => { if (v && v.length) recargar(); });
    const s2 = this.datosStateService.preciosProducto$.subscribe(p => { if (p && p.length) recargar(); });
    const s3 = this.datosStateService.variablesSensibilidad$.subscribe(va => { if (va) recargar(); });
    this.subscriptions.push(s1, s2, s3);
  }

  cargarTodo(): void {
    this.cargando = true;
    Promise.all([
      this.inversionService.getPresupuestoVenta(this.planId),
      this.inversionService.getVentasPorMes(this.planId),
    ])
      .then(([presup, ventas]) => {
        this.presupuestos = Array.isArray(presup) ? presup : [];
        this.agruparPorAnio();
        this.construirVentasPorMes(Array.isArray(ventas) ? ventas : []);
        this.cargando = false;
      })
      .catch((error) => {
        console.error('Error al cargar presupuesto de venta:', error);
        this.presupuestos = [];
        this.presupuestosAgrupados = [];
        this.cargando = false;
      });
  }

  private agruparPorAnio(): void {
    const aniosMap = new Map<number, PresupuestoVenta[]>();
    for (const p of this.presupuestos) {
      const anio = p.anio || 0;
      if (!aniosMap.has(anio)) aniosMap.set(anio, []);
      aniosMap.get(anio)!.push(p);
    }
    this.presupuestosAgrupados = Array.from(aniosMap.entries())
      .map(([anio, items]) => ({ anio, items }))
      .sort((a, b) => a.anio - b.anio);
  }

  private construirVentasPorMes(ventas: any[]): void {
    this.ventasPorMes = {};
    for (const v of ventas) {
      const pid = v.producto_id, anio = v.anio, mes = v.mes;
      if (pid == null || anio == null || mes == null || mes < 1 || mes > 12) continue;
      if (!this.ventasPorMes[pid]) this.ventasPorMes[pid] = {};
      if (!this.ventasPorMes[pid][anio]) this.ventasPorMes[pid][anio] = new Array(12).fill(0);
      this.ventasPorMes[pid][anio][mes - 1] = v.mensual ?? 0;
    }
  }

  // ============================================================
  //  DISPLAY
  // ============================================================

  /** Valor por mes para una fila. En edición, el año 1 muestra lo editable. */
  getValorMes(p: PresupuestoVenta, mes: number): number {
    if (p.producto_id == null || p.anio == null) return 0;
    const porAnio = this.ventasPorMes[p.producto_id];
    if (!porAnio || !porAnio[p.anio]) return 0;
    return porAnio[p.anio][mes - 1] ?? 0;
  }

  /** Total anual a mostrar. En edición (año 1) usa la suma en vivo de lo editado. */
  getTotalAnual(p: PresupuestoVenta): number {
    if (this.modoEdicion && p.anio === 1 && p.producto_id != null && this.mesesEdit[p.producto_id]) {
      return this.mesesEdit[p.producto_id].reduce((s, v) => s + (v || 0), 0);
    }
    return p.anual ?? 0;
  }

  esAnio1(anio: number): boolean { return anio === 1; }

  // ============================================================
  //  EDICIÓN DEL AÑO 1 (cantidades reales por producto)
  // ============================================================

  activarEdicion(): void {
    this.mesesEdit = {};
    this.mesesOriginal = {};
    const grupo1 = this.presupuestosAgrupados.find(g => g.anio === 1);
    if (grupo1) {
      for (const p of grupo1.items) {
        if (p.producto_id == null) continue;
        const arr = this.getMesesAnio1(p.producto_id).map(v => this.redondear2(v));
        this.mesesEdit[p.producto_id] = arr;
        this.mesesOriginal[p.producto_id] = [...arr];
      }
    }
    this.modoEdicion = true;
  }

  private getMesesAnio1(productoId: number): number[] {
    if (this.ventasPorMes[productoId] && this.ventasPorMes[productoId][1]) {
      return [...this.ventasPorMes[productoId][1]];
    }
    return new Array(12).fill(0);
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.mesesEdit = {};
    this.mesesOriginal = {};
  }

  onMesChange(productoId: number, indice: number, valor: string | number): void {
    const num = typeof valor === 'number' ? valor : parseFloat(valor);
    if (!this.mesesEdit[productoId]) return;
    this.mesesEdit[productoId][indice] = isNaN(num) || num < 0 ? 0 : num;
  }

  private filaCambiada(productoId: number): boolean {
    const a = this.mesesEdit[productoId], b = this.mesesOriginal[productoId];
    if (!a || !b) return false;
    for (let i = 0; i < 12; i++) {
      if (this.redondear2(a[i]) !== this.redondear2(b[i])) return true;
    }
    return false;
  }

  get hayCambios(): boolean {
    return Object.keys(this.mesesEdit).some(k => this.filaCambiada(Number(k)));
  }

  async confirmarCambios(): Promise<void> {
    const cambiados = Object.keys(this.mesesEdit).map(Number).filter(pid => this.filaCambiada(pid));
    if (cambiados.length === 0) { this.modoEdicion = false; return; }

    this.guardando = true;
    try {
      // Guarda cada producto modificado (sin recalcular fila por fila)
      for (const pid of cambiados) {
        const meses = this.mesesEdit[pid].map((valor, i) => ({ mes: i + 1, valor }));
        await this.inversionService.actualizarEstacionalidadProducto(pid, meses, false);
      }
      // Un solo recálculo de toda la cadena
      await this.inversionService.ejecutarRecalcular2(this.planId);
      this.modoEdicion = false;
      this.cargarTodo();
    } catch (error) {
      console.error('Error al guardar cantidades del año 1:', error);
    } finally {
      this.guardando = false;
    }
  }

  private redondear2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  handleSidebarChange(section: string): void { this.activeSection = section; }
  handleSidebarCollapse(collapsed: boolean): void { this.isSidebarCollapsed = collapsed; }
}