import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { InversionService, DatosStateService } from '../../core/services';
import { GastosOperacion as GastosOperacionData, Mensuales } from '../../interfaces';

interface ConceptoMensual {
  meses: number[];
  totalAnio: number;
}

interface ConceptoGasto {
  concepto: string;
  gastoId?: number; // ID del gasto para poder actualizarlo
  referencia: number; // Valor mensual editable (referencia)
  anio1: ConceptoMensual;
  anio2: ConceptoMensual;
  anio3: ConceptoMensual;
  totalAnio4: number;
  totalAnio5: number;
  esEditable?: boolean; // Indica si este concepto es editable
}

@Component({
  selector: 'app-gastos-operacion',
  standalone: false,
  templateUrl: './gastos-operacion.html',
  styleUrl: './gastos-operacion.css',
})
export class GastosOperacion implements OnInit, OnDestroy {
  activeSection = 'gastos-operacion';
  planId: number = 0;
  isSidebarCollapsed = false;
  cargando: boolean = false;

  // Datos procesados para la tabla
  conceptosGastos: ConceptoGasto[] = [];
  
  // Array de meses para headers
  meses: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Control de edición
  valoresEditados: Map<number, number> = new Map(); // gastoId -> nuevo valor
  guardando: boolean = false;

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
        this.cargarGastosOperacion();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Se suscribe a cambios en variables de sensibilidad que afectan gastos de operación
   */
  private suscribirseAlEstado(): void {
    const variablesSub = this.datosStateService.variablesSensibilidad$.subscribe(variables => {
      if (variables && this.planId) {
        console.log('Variables de sensibilidad actualizadas, recargando gastos de operación...');
        this.cargarGastosOperacion();
      }
    });

    this.subscriptions.push(variablesSub);
  }

  /**
   * Carga los datos de gastos de operación desde la API
   */
  async cargarGastosOperacion(): Promise<void> {
    this.cargando = true;
    try {
      const data: GastosOperacionData = await this.inversionService.getGastosOperacion(this.planId);
      this.procesarGastosOperacion(data);
      console.log('Gastos de operación cargados y procesados:', data);
    } catch (error) {
      console.error('Error al cargar gastos de operación:', error);
    } finally {
      this.cargando = false;
    }
  }

  /**
   * Procesa los datos de gastos de operación para la tabla unificada
   */
  procesarGastosOperacion(data: GastosOperacionData): void {
    const mensuales = data.mensuales || [];
    const anuales = data.anuales || [];
    const gastos = data.gastos || [];

    // Crear conceptos principales (los 4 conceptos fijos + gastos individuales)
    this.conceptosGastos = [];

    // 1. Agregar gastos individuales de descripción
    // IMPORTANTE: Ordenar por ID para mantener consistencia en el orden de las filas
    const gastosOrdenados = [...gastos].sort((a, b) => a.id - b.id);
    
    gastosOrdenados.forEach(gasto => {
      const concepto = this.crearConceptoVacio(gasto.descripcion);
      
      // Marcar como editable y guardar ID
      concepto.esEditable = true;
      concepto.gastoId = gasto.id;
      concepto.referencia = gasto.mensual;
      
      // Asignar valor mensual fijo (el mismo para todos los meses de los primeros 3 años)
      for (let anio = 1; anio <= 3; anio++) {
        const conceptoAnio = anio === 1 ? concepto.anio1 : anio === 2 ? concepto.anio2 : concepto.anio3;
        conceptoAnio.meses = new Array(12).fill(gasto.mensual);
        conceptoAnio.totalAnio = gasto.anual;
      }
      
      // Para años 4 y 5, usar el total anual
      concepto.totalAnio4 = gasto.anual;
      concepto.totalAnio5 = gasto.anual;
      
      this.conceptosGastos.push(concepto);
    });

    // 2. Agregar conceptos calculados
    const conceptosCalculados = [
      { nombre: 'Gastos de Operación', campo: 'gastos_operacion_mensual' },
      { nombre: 'Intereses del Préstamo', campo: 'intereses_prestamo_mensual' },
      { nombre: 'Depreciación', campo: 'depreciacion_mensual' },
      { nombre: 'Amortización', campo: 'amortizacion_mensual' },
      { nombre: 'Total', campo: 'total_mensual' }
    ];

    conceptosCalculados.forEach(({ nombre, campo }) => {
      const concepto = this.crearConceptoVacio(nombre);
      
      // Asignar valores mensuales para años 1-3
      mensuales.forEach(item => {
        if (item.anio <= 3) {
          const conceptoAnio = item.anio === 1 ? concepto.anio1 : 
                               item.anio === 2 ? concepto.anio2 : concepto.anio3;
          conceptoAnio.meses[item.mes - 1] = (item as any)[campo] || 0;
        }
      });

      // Calcular totales anuales para años 1-3
      [concepto.anio1, concepto.anio2, concepto.anio3].forEach(anio => {
        anio.totalAnio = anio.meses.reduce((sum, val) => sum + val, 0);
      });

      // Asignar totales para años 4 y 5 desde anuales
      const anual4 = anuales.find(a => a.anio === 4);
      const anual5 = anuales.find(a => a.anio === 5);
      
      if (anual4) {
        concepto.totalAnio4 = this.getValorAnualPorCampo(anual4, nombre);
      }
      if (anual5) {
        concepto.totalAnio5 = this.getValorAnualPorCampo(anual5, nombre);
      }

      this.conceptosGastos.push(concepto);
    });
  }

  /**
   * Crea un concepto vacío inicializado
   */
  crearConceptoVacio(nombre: string): ConceptoGasto {
    return {
      concepto: nombre,
      referencia: 0,
      esEditable: false,
      anio1: { meses: new Array(12).fill(0), totalAnio: 0 },
      anio2: { meses: new Array(12).fill(0), totalAnio: 0 },
      anio3: { meses: new Array(12).fill(0), totalAnio: 0 },
      totalAnio4: 0,
      totalAnio5: 0
    };
  }

  /**
   * Obtiene el valor anual según el concepto
   */
  getValorAnualPorCampo(anual: any, concepto: string): number {
    switch (concepto) {
      case 'Gastos de Operación':
        return anual.gastos_operacion_anual || 0;
      case 'Intereses del Préstamo':
        return anual.intereses_prestamo_anual || 0;
      case 'Depreciación':
        return anual.depreciacion_anual || 0;
      case 'Amortización':
        return anual.amortizacion_anual || 0;
      case 'Total':
        return anual.total_anual || 0;
      default:
        return 0;
    }
  }

  /**
   * Maneja el cambio de sección desde el sidebar
   */
  handleSidebarChange(section: string): void {
    this.activeSection = section;
  }

  /**
   * Maneja el cambio de estado collapsed del sidebar
   */
  handleSidebarCollapse(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  /**
   * Maneja el cambio en un campo de referencia
   */
  onReferenciaChange(concepto: ConceptoGasto, nuevoValor: number): void {
    if (!concepto.gastoId) return;
    
    // Si el valor es diferente al original, guardarlo en el mapa de cambios
    if (nuevoValor !== concepto.referencia) {
      this.valoresEditados.set(concepto.gastoId, nuevoValor);
    } else {
      // Si volvió al valor original, quitarlo del mapa
      this.valoresEditados.delete(concepto.gastoId);
    }
  }

  /**
   * Verifica si hay cambios pendientes
   */
  hayCambiosPendientes(): boolean {
    return this.valoresEditados.size > 0;
  }

  /**
   * Cancela todos los cambios pendientes
   */
  cancelarCambios(): void {
    this.valoresEditados.clear();
    // Recargar para restaurar valores originales
    this.cargarGastosOperacion();
  }

  /**
   * Guarda todos los cambios pendientes
   */
  async guardarTodosLosCambios(): Promise<void> {
    if (!this.hayCambiosPendientes()) {
      return;
    }

    this.guardando = true;
    
    try {
      const cambios = Array.from(this.valoresEditados.entries());
      const totalCambios = cambios.length;

      console.log(`Guardando ${totalCambios} cambio(s) en gastos de operación...`);

      // Procesar cada cambio
      for (let i = 0; i < totalCambios; i++) {
        const [gastoId, nuevoValor] = cambios[i];
        const esUltimo = i === totalCambios - 1;

        console.log(`Actualizando gasto ${gastoId}: ${nuevoValor} (${i + 1}/${totalCambios}) recalc=${esUltimo}`);

        await this.inversionService.actualizarGastosOperacion(
          gastoId,
          nuevoValor,
          esUltimo // solo el último lleva recalc=true
        );
      }

      // Limpiar cambios pendientes
      this.valoresEditados.clear();
      
      console.log('Todos los cambios guardados exitosamente. Recargando datos...');
      
      // Recargar datos actualizados
      await this.cargarGastosOperacion();
      
      console.log('Cambios guardados exitosamente');
    } catch (error) {
      console.error('Error al guardar cambios:', error);
      console.log('Error al guardar los cambios. Por favor, intente nuevamente.');
    } finally {
      this.guardando = false;
    }
  }
}
