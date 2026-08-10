import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
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
  diasxmes: number = 30;

  // Valores calculados por mes: { [productoId]: { [anio]: number[12] } }
  private ventasPorMes: { [id: number]: { [anio: number]: number[] } } = {};

  // --- Edición del AÑO 1 ---
  modoEdicion: boolean = false;
  guardando: boolean = false;
  // valores editables por producto: { [productoId]: number[12] }
  mesesEdit: { [id: number]: number[] } = {};
  private mesesOriginal: { [id: number]: number[] } = {};

  // % de sensibilidad activos actualmente (para el aviso que se muestra al editar)
  volumenSensibilidad: number = 0;
  precioSensibilidad: number = 0;

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
  @HostListener('window:beforeunload', ['$event'])
avisarSiRecalculando(event: BeforeUnloadEvent): void {
  if (this.guardando) {
    event.preventDefault();
    event.returnValue = '';
  }
}
  private suscribirseAlEstado(): void {
    const recargar = () => { if (!this.modoEdicion) this.cargarTodo(); };
    const s1 = this.datosStateService.ventasDiarias$.subscribe(v => { if (v && v.length) recargar(); });
    const s2 = this.datosStateService.preciosProducto$.subscribe(p => { if (p && p.length) recargar(); });
    const s3 = this.datosStateService.variablesSensibilidad$.subscribe(va => {
      this.volumenSensibilidad = va?.cantidad_volumen || 0;
      this.precioSensibilidad = va?.precio || 0;
      if (va) recargar();
    });
    this.subscriptions.push(s1, s2, s3);
  }

  /** Hay algún % de sensibilidad (Volumen o Precio) activo que afecte esta pantalla. */
  get haySensibilidadActiva(): boolean {
    return this.volumenSensibilidad !== 0 || this.precioSensibilidad !== 0;
  }

  cargarTodo(): void {
    this.cargando = true;
    Promise.all([
      this.inversionService.getPresupuestoVenta(this.planId),
      this.inversionService.getVentasPorMes(this.planId),
      this.inversionService.getMacros(this.planId),
    ])
      .then(([presup, ventas, macros]) => {
        this.presupuestos = Array.isArray(presup) ? presup : [];
        const dm = macros && (macros as any).diasxmes ? Number((macros as any).diasxmes) : 30;
        this.diasxmes = dm > 0 ? dm : 30;
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
    const mensual = porAnio[p.anio][mes - 1] ?? 0;
    return this.diasxmes > 0 ? mensual / this.diasxmes : mensual; // mostrar POR DÍA
  }

  /** Total anual a mostrar. En edición (año 1) usa la suma en vivo de lo editado. */
  getTotalAnual(p: PresupuestoVenta): number {
    if (this.modoEdicion && p.anio === 1 && p.producto_id != null && this.mesesEdit[p.producto_id]) {
      const sumaDia = this.mesesEdit[p.producto_id].reduce((s, v) => s + (v || 0), 0);
      return sumaDia * this.diasxmes; // mesesEdit son tasas POR DÍA
    }
    return p.anual ?? 0;
  }

  esAnio1(anio: number): boolean { return anio === 1; }

  // ============================================================
  //  EDICIÓN DEL AÑO 1 (cantidades reales por producto)
  // ============================================================

  async activarEdicion(): Promise<void> {
    this.mesesEdit = {};
    this.mesesOriginal = {};
    const grupo1 = this.presupuestosAgrupados.find(g => g.anio === 1);
    if (grupo1) {
      // Traer ventas por día directo del backend: no se puede depender de que
      // otra pantalla (Datos Iniciales) ya las haya cargado en el estado
      // compartido — si el usuario entra directo aquí, ese estado viene
      // vacío y todos los productos sin estacionalidad propia se ven en 0.
      const ventasDiarias = await this.inversionService
        .getVentasDiarias(this.planId)
        .catch(() => this.datosStateService.getVentasDiarias());
      for (const p of grupo1.items) {
        if (p.producto_id == null) continue;
        const arr = (await this.getMesesBaseAnio1(p.producto_id, ventasDiarias)).map(v => this.redondear2(v));
        this.mesesEdit[p.producto_id] = arr;
        this.mesesOriginal[p.producto_id] = [...arr];
      }
    }
    this.modoEdicion = true;
  }

  /**
   * Valores BASE (sin el % de Volumen/Precio de sensibilidad aplicado) del
   * año 1 para editar: la estacionalidad guardada si el producto la tiene, o
   * si no, la venta por día plana (modelo uniforme). Editar siempre muestra
   * lo que el usuario escribió originalmente, no el resultado ya escalado —
   * el % activo (si hay uno) se vuelve a aplicar solo, después de guardar.
   */
  private async getMesesBaseAnio1(productoId: number, ventasDiarias: { producto_servicio_id: number; venta_dia: number }[]): Promise<number[]> {
    try {
      const estacionalidad = await this.inversionService.getEstacionalidadProducto(productoId);
      if (Array.isArray(estacionalidad) && estacionalidad.length === 12) {
        const arr = new Array(12).fill(0);
        for (const m of estacionalidad) {
          if (m.mes >= 1 && m.mes <= 12) arr[m.mes - 1] = m.valor ?? 0;
        }
        return arr;
      }
    } catch {
      // sin estacionalidad guardada -> cae al modelo uniforme de abajo
    }
    const venta = ventasDiarias.find(v => v.producto_servicio_id === productoId);
    return new Array(12).fill(venta?.venta_dia ?? 0);
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
      // Guarda cada producto modificado; solo el último dispara el recálculo
      // real de todo el plan (Estado de Resultados, Flujo de Efectivo,
      // Balance, Evaluación). ejecutarRecalcular2() NO sirve aquí: ese
      // endpoint es el de la matriz de sensibilidad, corre cada combinación
      // dentro de una transacción que SIEMPRE se revierte, así que nunca deja
      // guardado el efecto real de este cambio sobre el plan.
      for (let i = 0; i < cambiados.length; i++) {
        const pid = cambiados[i];
        const meses = this.mesesEdit[pid].map((valor, idx) => ({ mes: idx + 1, valor }));
        const esUltimo = i === cambiados.length - 1;
        await this.inversionService.actualizarEstacionalidadProducto(pid, meses, esUltimo);
      }
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
