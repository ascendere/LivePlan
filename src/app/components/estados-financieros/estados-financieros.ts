import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { EstadoResultados, Items, SumasAnuales } from '../../interfaces';
import { InversionService, DatosStateService } from '../../core/services';

interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface ConceptoEstadoResultados {
  concepto: string;
  // clave original del campo (ej: ingresos, egresos, flujo_caja)
  key?: string;
  // tipo para resaltar: 'ingreso' | 'egreso' | 'flujo' | 'efectivo' | undefined
  tipo?: string;
  anio1: ConceptoMensual;
  anio2: ConceptoMensual;
  anio3: ConceptoMensual;
  totalAnio4: number;
  totalAnio5: number;
}

interface ConceptoMensual {
  meses: number[];
  totalAnio: number;
}

@Component({
  selector: 'app-estados-financieros',
  standalone: false,
  templateUrl: './estados-financieros.html',
  styleUrl: './estados-financieros.css'
})
export class EstadosFinancieros implements OnInit, OnDestroy {
  activeSection = 'estados-financieros';
  planId: number = 0;
  isSidebarCollapsed = false;
  activeTab: string = 'estado-resultados';
  cargando: boolean = false;
  meses: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  // Para flujo de efectivo el Año 1 incluye mes 0 además de 1..12
  mesesFlujoAnio1: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Datos del Estado de Resultados
  estadoResultados: EstadoResultados | null = null;
  conceptosEstado: ConceptoEstadoResultados[] = [];
  // Datos del Flujo de Efectivo
  flujoEfectivo: any = null;
  conceptosFlujo: ConceptoEstadoResultados[] = [];
  // Datos del Balance General
  balanceGeneral: any = null;
  conceptosBalance: ConceptoEstadoResultados[] = [];

  private subscriptions: Subscription[] = [];

  // Definición de pestañas disponibles
  tabs: Tab[] = [
    { id: 'estado-resultados', label: 'Estado de Resultados', icon: '/estadoResultados_icon.svg' },
    { id: 'balance-general', label: 'Balance General', icon: '/balanceGeneral_icon.svg' },
    { id: 'flujo-efectivo', label: 'Flujo de Efectivo', icon: '/flujoEfectivo_icon.svg' }
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inversionService: InversionService,
    private readonly datosStateService: DatosStateService
  ) {}

  ngOnInit(): void {
    // Captura el ID de la ruta
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
      console.log('ID del plan en Estados Financieros:', this.planId);
      if (this.planId) {
        this.suscribirseAlEstado();
        this.cargarEstadoResultados();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Se suscribe a cambios en el estado que afectan los estados financieros
   */
  private suscribirseAlEstado(): void {
    // Suscribirse a cambios en variables de sensibilidad
    const variablesSub = this.datosStateService.variablesSensibilidad$.subscribe(variables => {
      if (variables && this.planId) {
        console.log('Variables de sensibilidad actualizadas, recargando estados financieros...');
        // Recargar la pestaña activa
        if (this.activeTab === 'estado-resultados') {
          this.cargarEstadoResultados();
        } else if (this.activeTab === 'flujo-efectivo') {
          this.cargarFlujoEfectivo();
        } else if (this.activeTab === 'balance-general') {
          this.cargarBalanceGeneral();
        }
      }
    });

    this.subscriptions.push(variablesSub);
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

  /**
   * Cambia la pestaña activa
   */
  selectTab(tabId: string): void {
    this.activeTab = tabId;
    console.log('Pestaña activa:', tabId);
    // Si se selecciona Flujo de Efectivo, cargar datos
    if (tabId === 'flujo-efectivo' && this.planId) {
      this.cargarFlujoEfectivo();
    }
    if (tabId === 'balance-general' && this.planId) {
      this.cargarBalanceGeneral();
    }
  }

  /**
   * Verifica si una pestaña está activa
   */
  isTabActive(tabId: string): boolean {
    return this.activeTab === tabId;
  }

  /**
   * Carga los datos del Estado de Resultados
   */
  cargarEstadoResultados(): void {
    this.cargando = true;
    
    this.inversionService.getEstadoResultados(this.planId)
      .then((response) => {
        this.estadoResultados = response;
        console.log('Estado de Resultados cargado:', this.estadoResultados);
        this.procesarEstadoResultados();
        this.cargando = false;
      })
      .catch((error) => {
        console.error('Error al cargar Estado de Resultados:', error);
        this.cargando = false;
      });
  }

  /**
   * Carga los datos del Flujo de Efectivo
   */
  cargarFlujoEfectivo(): void {
    // si ya están cargados, no volver a solicitar (puedes ajustar este comportamiento)
    if (this.conceptosFlujo && this.conceptosFlujo.length > 0) return;

    this.cargando = true;
    this.inversionService.getFlujoEfectivo(this.planId)
      .then((response) => {
        this.flujoEfectivo = response;
        console.log('Flujo de Efectivo cargado:', this.flujoEfectivo);
        this.procesarFlujoEfectivo();
        this.cargando = false;
      })
      .catch((error) => {
        console.error('Error al cargar Flujo de Efectivo:', error);
        this.cargando = false;
      });
  }

  /**
   * Carga los datos del Balance General
   */
  cargarBalanceGeneral(): void {
    if (this.conceptosBalance && this.conceptosBalance.length > 0) return;

    this.cargando = true;
    this.inversionService.getBalanceGeneral(this.planId)
      .then((response) => {
        this.balanceGeneral = response;
        console.log('Balance General cargado:', this.balanceGeneral);
        this.procesarBalanceGeneral();
        this.cargando = false;
      })
      .catch((error) => {
        console.error('Error al cargar Balance General:', error);
        this.cargando = false;
      });
  }

  /**
   * Procesa los datos del Balance General y los adapta al mismo formato de tabla
   */
  procesarBalanceGeneral(): void {
    if (!this.balanceGeneral) return;

    const items: any[] = Array.isArray(this.balanceGeneral.items) ? this.balanceGeneral.items : (Array.isArray(this.balanceGeneral) ? this.balanceGeneral : []);
    if (!items || items.length === 0) return;

    const omitKeys = ['id', 'plan_negocio_id', 'anio', 'mes'];
    const sample = items[0];
    const keys = Object.keys(sample).filter(k => !omitKeys.includes(k));

    const conceptos: ConceptoEstadoResultados[] = keys.map(k => ({
      concepto: this.humanizeKey(k),
      key: k,
      tipo: undefined,
      anio1: this.crearConceptoVacio(),
      anio2: this.crearConceptoVacio(),
      anio3: this.crearConceptoVacio(),
      totalAnio4: 0,
      totalAnio5: 0
    }));

    for (const item of items) {
      if (item.mes === 0) continue; // balance normalmente no tiene mes 0, pero respetamos si viene
      const anioKey = item.anio === 1 ? 'anio1' : item.anio === 2 ? 'anio2' : item.anio === 3 ? 'anio3' : null;
      if (!anioKey) continue;

      const mes = Number(item.mes);
      if (mes < 1 || mes > 12) continue;
      const mesIndex = mes - 1;

      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const value = Number(item[k]) || 0;
        conceptos[i][anioKey].meses[mesIndex] = value;
      }
    }

    const sumas = this.balanceGeneral.sumas_anuales || this.balanceGeneral.sumas || [];
    if (Array.isArray(sumas)) {
      for (const suma of sumas) {
        const anio = suma.anio;
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const total = Number(suma[k]) || 0;
          if (anio === 1) conceptos[i].anio1.totalAnio = total;
          else if (anio === 2) conceptos[i].anio2.totalAnio = total;
          else if (anio === 3) conceptos[i].anio3.totalAnio = total;
          else if (anio === 4) conceptos[i].totalAnio4 = total;
          else if (anio === 5) conceptos[i].totalAnio5 = total;
        }
      }
    }

    this.conceptosBalance = conceptos;
  }

  /**
   * Procesa los datos del Flujo de Efectivo y los adapta al formato de tabla usado en Estado de Resultados
   * Nota: este método es dinámico y crea una fila por cada campo numérico encontrado en los items (excluye id, plan_negocio_id, anio, mes)
   */
  procesarFlujoEfectivo(): void {
    if (!this.flujoEfectivo) return;

    const items: any[] = Array.isArray(this.flujoEfectivo.items) ? this.flujoEfectivo.items : (Array.isArray(this.flujoEfectivo) ? this.flujoEfectivo : []);
    if (!items || items.length === 0) return;

    // Determinar claves a mostrar (omitimos campos de control)
    const omitKeys = ['id', 'plan_negocio_id', 'anio', 'mes'];
    const sample = items[0];
    const keys = Object.keys(sample).filter(k => !omitKeys.includes(k));

    // Crear conceptos dinámicos a partir de keys
    const conceptos: ConceptoEstadoResultados[] = keys.map(k => ({
      concepto: this.humanizeKey(k),
      key: k,
      tipo: this.detectarTipoPorClave(k),
      // Para Año1 (flujo) permitimos mes 0..12 -> crearConceptoVacioFlujoAnio1
      anio1: this.crearConceptoVacioFlujoAnio1(),
      anio2: this.crearConceptoVacio(),
      anio3: this.crearConceptoVacio(),
      totalAnio4: 0,
      totalAnio5: 0
    }));

    // Rellenar valores mensuales
    for (const item of items) {
      const anioKey = item.anio === 1 ? 'anio1' : item.anio === 2 ? 'anio2' : item.anio === 3 ? 'anio3' : null;
      if (!anioKey) continue;

      if (item.anio === 1) {
        // Año 1 para flujo acepta mes 0..12 (mapeamos índice = mes)
        const mesIndex = Number(item.mes);
        if (mesIndex < 0 || mesIndex > 12) continue;
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const value = Number(item[k]) || 0;
          conceptos[i].anio1.meses[mesIndex] = value;
        }
      } else {
        // Años 2 y 3 mantienen 12 meses (1..12) mapeados a índices 0..11
        const mes = Number(item.mes);
        if (mes < 1 || mes > 12) continue;
        const mesIndex = mes - 1;
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const value = Number(item[k]) || 0;
          conceptos[i][anioKey].meses[mesIndex] = value;
        }
      }
    }

    // Procesar sumas anuales si vienen en la respuesta
    const sumas = this.flujoEfectivo.sumas_anuales || this.flujoEfectivo.sumas || [];
    if (Array.isArray(sumas)) {
      for (const suma of sumas) {
        const anio = suma.anio;
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const total = Number(suma[k]) || 0;
          if (anio === 1) conceptos[i].anio1.totalAnio = total;
          else if (anio === 2) conceptos[i].anio2.totalAnio = total;
          else if (anio === 3) conceptos[i].anio3.totalAnio = total;
          else if (anio === 4) conceptos[i].totalAnio4 = total;
          else if (anio === 5) conceptos[i].totalAnio5 = total;
        }
      }
    }

    this.conceptosFlujo = conceptos;
  }

  /** Convierte una key_snake_case a un label humano */
  private humanizeKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Detecta el tipo de fila para resaltar según la clave original */
  private detectarTipoPorClave(key: string): string | undefined {
    const k = key.toLowerCase();
    if (k.includes('ingres')) return 'ingreso';
    if (k.includes('egres')) return 'egreso';
    if (k.includes('flujo')) return 'flujo';
    if (k.includes('efectivo')) return 'efectivo';
    return undefined;
  }

  /**
   * Procesa los datos del Estado de Resultados para la tabla
   */
  procesarEstadoResultados(): void {
    if (!this.estadoResultados) return;

    const conceptos: ConceptoEstadoResultados[] = [
      { concepto: 'Ventas', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'Costos de Ventas', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'Utilidad Bruta', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'Gastos de Venta y Administración', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'Depreciación', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'Amortización', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'Utilidad Previo Int. e Imp.', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'Gastos Financieros', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'Utilidad Antes de PTU', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'PTU', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'Utilidad Antes de Impuestos', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'ISR', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 },
      { concepto: 'Utilidad Neta', anio1: this.crearConceptoVacio(), anio2: this.crearConceptoVacio(), anio3: this.crearConceptoVacio(), totalAnio4: 0, totalAnio5: 0 }
    ];

    // Procesar items mensuales (años 1-3)
    for (const item of this.estadoResultados.items) {
      if (item.mes === 0) continue; // Saltar mes 0 (inicial)
      
      const mesIndex = item.mes - 1;
      
      if (item.anio === 1 && mesIndex >= 0 && mesIndex < 12) {
        this.asignarValoresMensuales(conceptos, item, 'anio1', mesIndex);
      } else if (item.anio === 2 && mesIndex >= 0 && mesIndex < 12) {
        this.asignarValoresMensuales(conceptos, item, 'anio2', mesIndex);
      } else if (item.anio === 3 && mesIndex >= 0 && mesIndex < 12) {
        this.asignarValoresMensuales(conceptos, item, 'anio3', mesIndex);
      }
    }

    // Procesar sumas anuales
    for (const suma of this.estadoResultados.sumas_anuales) {
      if (suma.anio <= 3) {
        this.asignarTotalesAnuales(conceptos, suma, `anio${suma.anio}` as 'anio1' | 'anio2' | 'anio3');
      } else if (suma.anio === 4) {
        this.asignarTotalesAnio4(conceptos, suma);
      } else if (suma.anio === 5) {
        this.asignarTotalesAnio5(conceptos, suma);
      }
    }

    this.conceptosEstado = conceptos;
  }

  private crearConceptoVacio(): ConceptoMensual {
    return {
      meses: new Array(12).fill(0),
      totalAnio: 0
    };
  }

  /** Crear concepto vacío para flujo - Año 1 tiene mes 0..12 (13 columnas) */
  private crearConceptoVacioFlujoAnio1(): ConceptoMensual {
    return {
      meses: new Array(13).fill(0),
      totalAnio: 0
    };
  }

  private asignarValoresMensuales(conceptos: ConceptoEstadoResultados[], item: Items, anioKey: 'anio1' | 'anio2' | 'anio3', mesIndex: number): void {
    conceptos[0][anioKey].meses[mesIndex] = item.ventas;
    conceptos[1][anioKey].meses[mesIndex] = item.costos_ventas;
    conceptos[2][anioKey].meses[mesIndex] = item.utilidad_bruta;
    conceptos[3][anioKey].meses[mesIndex] = item.gastos_venta_adm;
    conceptos[4][anioKey].meses[mesIndex] = item.depreciacion;
    conceptos[5][anioKey].meses[mesIndex] = item.amortizacion;
    conceptos[6][anioKey].meses[mesIndex] = item.utilidad_previo_int_imp;
    conceptos[7][anioKey].meses[mesIndex] = item.gastos_financieros;
    conceptos[8][anioKey].meses[mesIndex] = item.utilidad_antes_ptu;
    conceptos[9][anioKey].meses[mesIndex] = item.ptu;
    conceptos[10][anioKey].meses[mesIndex] = item.utilidad_antes_impuestos;
    conceptos[11][anioKey].meses[mesIndex] = item.isr;
    conceptos[12][anioKey].meses[mesIndex] = item.utilidad_neta;
  }

  private asignarTotalesAnuales(conceptos: ConceptoEstadoResultados[], suma: SumasAnuales, anioKey: 'anio1' | 'anio2' | 'anio3'): void {
    conceptos[0][anioKey].totalAnio = suma.ventas;
    conceptos[1][anioKey].totalAnio = suma.costos_ventas;
    conceptos[2][anioKey].totalAnio = suma.utilidad_bruta;
    conceptos[3][anioKey].totalAnio = suma.gastos_venta_adm;
    conceptos[4][anioKey].totalAnio = suma.depreciacion;
    conceptos[5][anioKey].totalAnio = suma.amortizacion;
    conceptos[6][anioKey].totalAnio = suma.utilidad_previo_int_imp;
    conceptos[7][anioKey].totalAnio = suma.gastos_financieros;
    conceptos[8][anioKey].totalAnio = suma.utilidad_antes_ptu;
    conceptos[9][anioKey].totalAnio = suma.ptu;
    conceptos[10][anioKey].totalAnio = suma.utilidad_antes_impuestos;
    conceptos[11][anioKey].totalAnio = suma.isr;
    conceptos[12][anioKey].totalAnio = suma.utilidad_neta;
  }

  private asignarTotalesAnio4(conceptos: ConceptoEstadoResultados[], suma: SumasAnuales): void {
    conceptos[0].totalAnio4 = suma.ventas;
    conceptos[1].totalAnio4 = suma.costos_ventas;
    conceptos[2].totalAnio4 = suma.utilidad_bruta;
    conceptos[3].totalAnio4 = suma.gastos_venta_adm;
    conceptos[4].totalAnio4 = suma.depreciacion;
    conceptos[5].totalAnio4 = suma.amortizacion;
    conceptos[6].totalAnio4 = suma.utilidad_previo_int_imp;
    conceptos[7].totalAnio4 = suma.gastos_financieros;
    conceptos[8].totalAnio4 = suma.utilidad_antes_ptu;
    conceptos[9].totalAnio4 = suma.ptu;
    conceptos[10].totalAnio4 = suma.utilidad_antes_impuestos;
    conceptos[11].totalAnio4 = suma.isr;
    conceptos[12].totalAnio4 = suma.utilidad_neta;
  }

  private asignarTotalesAnio5(conceptos: ConceptoEstadoResultados[], suma: SumasAnuales): void {
    conceptos[0].totalAnio5 = suma.ventas;
    conceptos[1].totalAnio5 = suma.costos_ventas;
    conceptos[2].totalAnio5 = suma.utilidad_bruta;
    conceptos[3].totalAnio5 = suma.gastos_venta_adm;
    conceptos[4].totalAnio5 = suma.depreciacion;
    conceptos[5].totalAnio5 = suma.amortizacion;
    conceptos[6].totalAnio5 = suma.utilidad_previo_int_imp;
    conceptos[7].totalAnio5 = suma.gastos_financieros;
    conceptos[8].totalAnio5 = suma.utilidad_antes_ptu;
    conceptos[9].totalAnio5 = suma.ptu;
    conceptos[10].totalAnio5 = suma.utilidad_antes_impuestos;
    conceptos[11].totalAnio5 = suma.isr;
    conceptos[12].totalAnio5 = suma.utilidad_neta;
  }
}