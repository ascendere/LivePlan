import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { InversionService, DatosStateService } from '../../core/services';

interface ConceptoEvaluacion {
  id: number;
  plan_negocio_id: number;
  anio: number;
  flujo_efectivo_nominal: string | number;
  valor_rescate: string | number;
  total_flujo_efectivo: string | number;
  valor_actual_flujos_futuros: string | number;
}

  interface EvaluacionProyecto {
    id: number;
    plan_negocio_id: number;
    van: number;
    tir: number;
    trema: number;
  }

  interface AnalisisSensibilidadItem {
    id: number;
    plan_negocio_id: number;
    volumen: number;
    costo: number;
    valor: number;
  }

@Component({
  selector: 'app-evaluacion',
  standalone: false,
  templateUrl: './evaluacion.html',
  styleUrl: './evaluacion.css'
})
export class Evaluacion implements OnInit, OnDestroy {
  activeSection = 'evaluacion';
  planId: number = 0; // ID del plan capturado de la ruta
  isSidebarCollapsed = false;

  cargando: boolean = false;
  conceptosEvaluacion: ConceptoEvaluacion[] = [];
  // Filas transformadas para la tabla compacta (concepto + valores por anio 0..5)
  evaluationRows: { concepto: string; valores: (string | number)[] }[] = [];
  evaluacionProyecto: EvaluacionProyecto | null = null;
  analisisSensibilidad: AnalisisSensibilidadItem[] = [];
  // matrix structure: headers = costos, rows = { volumen, valores[] }
  analisisCostos: number[] = [];
  analisisVolumenes: number[] = [];
  analisisMatrix: (number | string)[][] = [];

  // Estados para análisis de sensibilidad
  statusAnalisis: boolean | null = null; // null = no cargado, true = actualizado, false = pendiente
  cargandoStatus: boolean = false;
  cargandoRecalcular: boolean = false;
  mostrarModalConfirmacion: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inversionService: InversionService,
    private readonly datosStateService: DatosStateService
  ) {}

  ngOnInit(): void {
    // Captura el ID de la ruta
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
      console.log('ID del plan en Evaluación:', this.planId);
      if (this.planId) {
        this.suscribirseAlEstado();
        this.cargarConceptosEvaluacion();
        this.cargarEvaluacionProyecto();
        this.cargarAnalisisSensibilidad();
        this.cargarStatusAnalisis(); // Cargar el status
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Se suscribe a cambios en el estado que afectan la evaluación
   */
  private suscribirseAlEstado(): void {
    // Suscribirse a cambios en variables de sensibilidad
    // Usamos skip(1) para ignorar el valor inicial y solo reaccionar a cambios posteriores
    const variablesSub = this.datosStateService.variablesSensibilidad$
      .pipe(skip(1))
      .subscribe(variables => {
        if (variables && this.planId) {
          console.log('Variables de sensibilidad actualizadas, recargando evaluación...');
          // Marcar el análisis como pendiente de actualizar
          this.statusAnalisis = false;
          // Recargar datos de evaluación
          this.cargarConceptosEvaluacion();
          this.cargarEvaluacionProyecto();
          this.cargarAnalisisSensibilidad();
        }
      });

    this.subscriptions.push(variablesSub);
  }

  /**
   * Carga los conceptos de evaluación desde backend
   */
  cargarConceptosEvaluacion(): void {
    if (!this.planId) return;
    this.cargando = true;
    this.inversionService.getConceptosEvaluacion(this.planId)
      .then((response) => {
        // La respuesta esperada contiene { plan_negocio_id, conceptos: [...] }
        if (response && Array.isArray(response.conceptos)) {
          this.conceptosEvaluacion = response.conceptos.map((c: any) => ({
            id: c.id,
            plan_negocio_id: c.plan_negocio_id,
            anio: Number(c.anio),
            flujo_efectivo_nominal: c.flujo_efectivo_nominal,
            valor_rescate: c.valor_rescate,
            total_flujo_efectivo: c.total_flujo_efectivo,
            valor_actual_flujos_futuros: c.valor_actual_flujos_futuros
          }));
        } else if (Array.isArray(response)) {
          // Si el endpoint devuelve directamente el array
          this.conceptosEvaluacion = response.map((c: any) => ({
            id: c.id,
            plan_negocio_id: c.plan_negocio_id,
            anio: Number(c.anio),
            flujo_efectivo_nominal: c.flujo_efectivo_nominal,
            valor_rescate: c.valor_rescate,
            total_flujo_efectivo: c.total_flujo_efectivo,
            valor_actual_flujos_futuros: c.valor_actual_flujos_futuros
          }));
        } else {
          console.warn('Respuesta inesperada de conceptos de evaluación:', response);
        }

        // Construir filas para la tabla compacta
        this.buildEvaluationRows();
        this.cargando = false;
      })
      .catch((err) => {
        console.error('Error al obtener conceptos de evaluación:', err);
        this.cargando = false;
      });
  }

  /** Cargar evaluación resumen del proyecto (VAN/TIR/TREMA) */
  cargarEvaluacionProyecto(): void {
    if (!this.planId) return;
    // no bloquear el cargando principal; manejar estado propio si hace falta
    this.inversionService.getEvaluacionProyecto(this.planId)
      .then((resp) => {
        if (resp) {
          // si la respuesta está dentro de un objeto, extraer
          const data = resp && resp.id !== undefined ? resp : (Array.isArray(resp) && resp.length > 0 ? resp[0] : resp);
          this.evaluacionProyecto = data ? {
            id: Number(data.id),
            plan_negocio_id: Number(data.plan_negocio_id),
            van: Number(data.van) || 0,
            tir: Number(data.tir) || 0,
            trema: Number(data.trema) || 0
          } : null;
        }
      })
      .catch(err => console.error('Error al cargar evaluacionProyecto:', err));
  }

  /** Carga análisis de sensibilidad y construye matriz */
  cargarAnalisisSensibilidad(): void {
    if (!this.planId) return;
    this.inversionService.getAnalisisSensibilidad(this.planId)
      .then((resp) => {
        const data = resp && Array.isArray(resp.analisis) ? resp.analisis : (Array.isArray(resp) ? resp : []);
        this.analisisSensibilidad = data.map((r: any) => ({
          id: r.id,
          plan_negocio_id: r.plan_negocio_id,
          volumen: Number(r.volumen),
          costo: Number(r.costo),
          valor: Number(r.valor)
        }));
        this.buildAnalisisMatrix();
      })
      .catch(err => {
        console.error('Error al cargar analisis sensibilidad:', err);
        this.analisisSensibilidad = [];
      });
  }

  private buildAnalisisMatrix(): void {
    if (!this.analisisSensibilidad || this.analisisSensibilidad.length === 0) {
      this.analisisCostos = [];
      this.analisisVolumenes = [];
      this.analisisMatrix = [];
      return;
    }

    const costosSet = new Set<number>();
    const volumenSet = new Set<number>();
    for (const r of this.analisisSensibilidad) {
      costosSet.add(r.costo);
      volumenSet.add(r.volumen);
    }

    this.analisisCostos = Array.from(costosSet).sort((a,b)=>a-b);
    this.analisisVolumenes = Array.from(volumenSet).sort((a,b)=>a-b);

    // Build matrix rows: each row starts with costo label, then values for each volumen in analisisVolumenes
    const matrix: (number | string)[][] = [];
    for (const cos of this.analisisCostos) {
      const row: (number | string)[] = [cos];
      for (const vol of this.analisisVolumenes) {
        const found = this.analisisSensibilidad.find(x => x.volumen === vol && x.costo === cos);
        row.push(found ? found.valor : '-');
      }
      matrix.push(row);
    }

    this.analisisMatrix = matrix;
  }

  /**
   * Formatea porcentaje con 2 decimales
   */
  formatPercent(value: string | number): string {
    const n = Number(value) || 0;
    return `${n.toFixed(2)}%`;
  }

  /** Construye una matriz de filas donde cada fila es un concepto y columnas son años 0..5 */
  private buildEvaluationRows(): void {
    // conceptos que queremos mostrar como filas
    const keys = [
      { key: 'flujo_efectivo_nominal', label: 'Flujo Efectivo Nominal' },
      { key: 'valor_rescate', label: 'Valor Rescate' },
      { key: 'total_flujo_efectivo', label: 'Total Flujo Efectivo' },
      { key: 'valor_actual_flujos_futuros', label: 'Valor Actual Flujos Futuros' }
    ];

    // indexar conceptos por año para acceso rápido
    const porAnio: { [anio: number]: ConceptoEvaluacion } = {};
    for (const c of this.conceptosEvaluacion) {
      porAnio[c.anio] = c;
    }

    this.evaluationRows = keys.map(k => {
      const valores: (string | number)[] = [];
      for (let anio = 0; anio <= 5; anio++) {
        const row = porAnio[anio];
        const raw = row ? (row as any)[k.key] : 0;
        valores.push(raw !== undefined && raw !== null ? raw : 0);
      }
      return { concepto: k.label, valores };
    });
  }

  /**
   * Maneja el cambio de sección desde el sidebar
   */
  handleSidebarChange(section: string): void {
    this.activeSection = section;
    console.log('Sección activa:', section);
  }

  /**
   * Maneja el cambio de estado collapsed del sidebar
   */
  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  /** Formatea número/strings a moneda local (simple) */
  formatCurrency(value: string | number): string {
    const n = Number(value) || 0;
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
  }

  /**
   * Carga el estado del análisis de sensibilidad
   */
  private async cargarStatusAnalisis(): Promise<void> {
    if (!this.planId) {
      return;
    }

    try {
      this.cargandoStatus = true;
      const response = await this.inversionService.getAnalisisSensibilidadStatus(this.planId);
      this.statusAnalisis = response.status || false;
      console.log('Status del análisis:', this.statusAnalisis);
    } catch (error: any) {
      console.error('Error al cargar status:', error);
      this.statusAnalisis = false;
    } finally {
      this.cargandoStatus = false;
    }
  }

  /**
   * Obtiene el estado del análisis de sensibilidad y muestra el resultado
   */
  async obtenerStatus(): Promise<void> {
    if (!this.planId) {
      alert('Plan ID no disponible');
      return;
    }

    await this.cargarStatusAnalisis();
  }

  /**
   * Muestra el modal de confirmación para recalcular
   */
  ejecutarRecalcular(): void {
    if (!this.planId) {
      alert('Plan ID no disponible');
      return;
    }
    this.mostrarModalConfirmacion = true;
  }

  /**
   * Cancela el recálculo y cierra el modal
   */
  cancelarRecalcular(): void {
    this.mostrarModalConfirmacion = false;
  }

  /**
   * Confirma y ejecuta el recalcular2 para el análisis de sensibilidad
   */
  async confirmarRecalcular(): Promise<void> {
    this.mostrarModalConfirmacion = false;
    this.cargandoRecalcular = true;
    try {
      const response = await this.inversionService.ejecutarRecalcular2(this.planId);
      console.log('Recalcular2 completado:', response);
      // Actualizar el estado después de recalcular
      this.statusAnalisis = true;
      // Recargar el análisis de sensibilidad después de recalcular
      this.cargarAnalisisSensibilidad();
    } catch (error: any) {
      console.error('Error al ejecutar recalcular2:', error);
      alert('Error al ejecutar el recalcular2. Por favor intenta de nuevo.');
    } finally {
      this.cargandoRecalcular = false;
    }
  }

}