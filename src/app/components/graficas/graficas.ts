import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InversionService } from '../../core/services/inversion.service';

declare const Chart: any;

@Component({
  selector: 'app-graficas',
  standalone: false,
  templateUrl: './graficas.html',
  styleUrl: './graficas.css'
})
export class Graficas implements OnInit, OnDestroy {
  activeSection = 'dashboard';
  planId: number = 0; // ID del plan capturado de la ruta
  fullscreenChart: string | null = null; // Para controlar el modal fullscreen
  isSidebarCollapsed = false; // Estado del sidebar

  // Chart instances
  private chartEstado: any = null;
  private chartBalance: any = null;
  private chartFlujo: any = null;
  private chartFullscreen: any = null;

  // Datos guardados para recrear gráficas en fullscreen
  private savedChartData: {
    estado: { utilBruta: number[], utilOperacion: number[], utilNeta: number[] },
    balance: { activo: number[], pasivo: number[], capital: number[] },
    flujo: { ingresos: number[], egresos: number[], flujoCaja: number[] }
  } = {
    estado: { utilBruta: [], utilOperacion: [], utilNeta: [] },
    balance: { activo: [], pasivo: [], capital: [] },
    flujo: { ingresos: [], egresos: [], flujoCaja: [] }
  };

  // Data tables for display
  estadoData: any[] = [];
  balanceData: any[] = [];
  flujoData: any[] = [];

  constructor(private route: ActivatedRoute, private inversionService: InversionService) {}

  ngOnInit(): void {
    // Captura el ID de la ruta
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
      console.log('ID del plan en Gráficas:', this.planId);
      if (this.planId) {
        this.loadAllDataAndRenderCharts();
      }
    });
  }

  ngOnDestroy(): void {
    // destruir instancias de Chart.js si existen
    try { this.chartEstado?.destroy?.(); } catch (e) { /* ignore */ }
    try { this.chartBalance?.destroy?.(); } catch (e) { /* ignore */ }
    try { this.chartFlujo?.destroy?.(); } catch (e) { /* ignore */ }
    try { this.chartFullscreen?.destroy?.(); } catch (e) { /* ignore */ }
    // Remover event listener de ESC
    document.removeEventListener('keydown', this.handleKeydown);
  }

  private handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.fullscreenChart) {
      this.closeFullscreen();
    }
  };

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
    // Redimensionar gráficas después de la transición
    setTimeout(() => {
      this.chartEstado?.resize?.();
      this.chartBalance?.resize?.();
      this.chartFlujo?.resize?.();
    }, 350);
  }

  /** Carga los 3 endpoints y renderiza las gráficas */
  private async loadAllDataAndRenderCharts(): Promise<void> {
    try {
      const [estado, balance, flujo] = await Promise.all([
        this.inversionService.getEstadoResultados(this.planId).catch(() => null),
        this.inversionService.getBalanceGeneral(this.planId).catch(() => null),
        this.inversionService.getFlujoEfectivo(this.planId).catch(() => null)
      ]);

      const years = [1,2,3,4,5];

      // Estado de Resultados: Utilidad Bruta, Utilidad de Operación (utilidad_previo_int_imp), Utilidad Neta
      const utilBruta = this.extractSerieFromSumas(estado?.sumas_anuales, 'utilidad_bruta', years);
      const utilOperacion = this.extractSerieFromSumas(estado?.sumas_anuales, 'utilidad_previo_int_imp', years);
      const utilNeta = this.extractSerieFromSumas(estado?.sumas_anuales, 'utilidad_neta', years);

      // Balance General: buscar claves probables (activo, pasivo, capital)
      const balanceKeys = this.findBalanceKeys(balance?.sumas_anuales?.[0]);
      const activo = this.extractSerieFromSumas(balance?.sumas_anuales, balanceKeys.activoKey, years);
      const pasivo = this.extractSerieFromSumas(balance?.sumas_anuales, balanceKeys.pasivoKey, years);
      const capital = this.extractSerieFromSumas(balance?.sumas_anuales, balanceKeys.capitalKey, years);

      // Flujo de Efectivo: ingresos, egresos, flujo_caja
      const ingresos = this.extractSerieFromSumas(flujo?.sumas_anuales, 'ingresos', years);
      const egresos = this.extractSerieFromSumas(flujo?.sumas_anuales, 'egresos', years);
      const flujoCaja = this.extractSerieFromSumas(flujo?.sumas_anuales, 'flujo_caja', years);

      // Prepare data tables
      this.prepareEstadoTable(utilBruta, utilOperacion, utilNeta);
      this.prepareBalanceTable(activo, pasivo, capital);
      this.prepareFlujoTable(ingresos, egresos, flujoCaja);

      // Guardar datos para fullscreen
      this.savedChartData = {
        estado: { utilBruta, utilOperacion, utilNeta },
        balance: { activo, pasivo, capital },
        flujo: { ingresos, egresos, flujoCaja }
      };

      // Render charts
      this.renderEstadoChart(utilBruta, utilOperacion, utilNeta);
      this.renderBalanceChart(activo, pasivo, capital);
      this.renderFlujoChart(ingresos, egresos, flujoCaja);

      // Agregar listener para tecla ESC
      document.addEventListener('keydown', this.handleKeydown);

    } catch (error) {
      console.error('Error al cargar datos para gráficas:', error);
    }
  }

  /** Prepara la tabla de datos para Estado de Resultados */
  private prepareEstadoTable(utilBruta: number[], utilOperacion: number[], utilNeta: number[]): void {
    this.estadoData = [
      { concepto: 'Utilidad Bruta', ano1: utilBruta[0], ano2: utilBruta[1], ano3: utilBruta[2], ano4: utilBruta[3], ano5: utilBruta[4] },
      { concepto: 'Utilidad de Operación', ano1: utilOperacion[0], ano2: utilOperacion[1], ano3: utilOperacion[2], ano4: utilOperacion[3], ano5: utilOperacion[4] },
      { concepto: 'Utilidad Neta', ano1: utilNeta[0], ano2: utilNeta[1], ano3: utilNeta[2], ano4: utilNeta[3], ano5: utilNeta[4] }
    ];
  }

  /** Prepara la tabla de datos para Balance General */
  private prepareBalanceTable(activo: number[], pasivo: number[], capital: number[]): void {
    this.balanceData = [
      { concepto: 'Activo', ano1: activo[0], ano2: activo[1], ano3: activo[2], ano4: activo[3], ano5: activo[4] },
      { concepto: 'Pasivo', ano1: pasivo[0], ano2: pasivo[1], ano3: pasivo[2], ano4: pasivo[3], ano5: pasivo[4] },
      { concepto: 'Capital Contable', ano1: capital[0], ano2: capital[1], ano3: capital[2], ano4: capital[3], ano5: capital[4] }
    ];
  }

  /** Prepara la tabla de datos para Flujo de Efectivo */
  private prepareFlujoTable(ingresos: number[], egresos: number[], flujoCaja: number[]): void {
    this.flujoData = [
      { concepto: 'Ingresos', ano1: ingresos[0], ano2: ingresos[1], ano3: ingresos[2], ano4: ingresos[3], ano5: ingresos[4] },
      { concepto: 'Egresos', ano1: egresos[0], ano2: egresos[1], ano3: egresos[2], ano4: egresos[3], ano5: egresos[4] },
      { concepto: 'Flujo de Efectivo Neto', ano1: flujoCaja[0], ano2: flujoCaja[1], ano3: flujoCaja[2], ano4: flujoCaja[3], ano5: flujoCaja[4] }
    ];
  }

  /** Extrae una serie numérica de las sumas anuales (array de objetos con campo anio) */
  private extractSerieFromSumas(sumas: any[] | undefined, key: string | undefined, years: number[]): number[] {
    if (!Array.isArray(sumas) || !key) return years.map(() => 0);
    return years.map(y => {
      const s = sumas.find((it: any) => Number(it?.anio) === Number(y));
      if (!s) return 0;
      const val = s[key];
      return typeof val === 'number' ? val : (val ? Number(val) : 0);
    });
  }

  /** Intenta identificar claves probables dentro del objeto de sumas del balance */
  private findBalanceKeys(sample: any): { activoKey: string | undefined; pasivoKey: string | undefined; capitalKey: string | undefined } {
    if (!sample || typeof sample !== 'object') return { activoKey: undefined, pasivoKey: undefined, capitalKey: undefined };
    const keys = Object.keys(sample).map(k => k.toLowerCase());
    const keyMap = (candidates: string[]) => {
      for (const cand of candidates) {
        const found = Object.keys(sample).find(k => k.toLowerCase().includes(cand));
        if (found) return found;
      }
      // fallback: try first numeric field not anio
      const fallback = Object.keys(sample).find(k => k !== 'anio' && typeof sample[k] === 'number');
      return fallback;
    };

    return {
      activoKey: keyMap(['activo', 'activos', 'total_activo', 'totalactivo', 'activo_total']),
      pasivoKey: keyMap(['pasivo', 'pasivos', 'total_pasivo', 'pasivo_total']),
      capitalKey: keyMap(['capital', 'capital_contable', 'patrimonio', 'capitalcontable'])
    };
  }

  private renderEstadoChart(utilBruta: number[], utilOperacion: number[], utilNeta: number[]): void {
    const ctx: any = document.getElementById('chart-estado') as HTMLCanvasElement;
    if (!ctx) return;
    try { this.chartEstado?.destroy?.(); } catch (e) {}
    this.chartEstado = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Año 1','Año 2','Año 3','Año 4','Año 5'],
        datasets: [
          { label: 'Utilidad Bruta', data: utilBruta, borderColor: '#5B9BD5', backgroundColor: 'rgba(91,155,213,0.15)', borderWidth: 2, tension: 0.3, fill: true },
          { label: 'Utilidad de Operación', data: utilOperacion, borderColor: '#70AD47', backgroundColor: 'rgba(112,173,71,0.15)', borderWidth: 2, tension: 0.3, fill: true },
          { label: 'Utilidad Neta', data: utilNeta, borderColor: '#9DC3E6', backgroundColor: 'rgba(157,195,230,0.15)', borderWidth: 2, tension: 0.3, fill: true }
        ]
      },
      options: this.getChartOptions('line')
    });
  }

  private renderBalanceChart(activo: number[], pasivo: number[], capital: number[]): void {
    const ctx: any = document.getElementById('chart-balance') as HTMLCanvasElement;
    if (!ctx) return;
    try { this.chartBalance?.destroy?.(); } catch (e) {}
    this.chartBalance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Año 1','Año 2','Año 3','Año 4','Año 5'],
        datasets: [
          { label: 'Activo', data: activo, backgroundColor: 'rgba(91,155,213,0.75)', borderColor: '#5B9BD5', borderWidth: 1.5 },
          { label: 'Pasivo', data: pasivo, backgroundColor: 'rgba(237,125,49,0.75)', borderColor: '#ED7D31', borderWidth: 1.5 },
          { label: 'Capital Contable', data: capital, backgroundColor: 'rgba(112,173,71,0.75)', borderColor: '#70AD47', borderWidth: 1.5 }
        ]
      },
      options: this.getChartOptions('bar')
    });
  }

  private renderFlujoChart(ingresos: number[], egresos: number[], flujoCaja: number[]): void {
    const ctx: any = document.getElementById('chart-flujo') as HTMLCanvasElement;
    if (!ctx) return;
    try { this.chartFlujo?.destroy?.(); } catch (e) {}
    this.chartFlujo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Año 1','Año 2','Año 3','Año 4','Año 5'],
        datasets: [
          { 
            label: 'Ingresos', 
            data: ingresos, 
            backgroundColor: 'rgba(112,173,71,0.75)', 
            borderColor: '#70AD47', 
            borderWidth: 1.5
          },
          { 
            label: 'Egresos', 
            data: egresos, 
            backgroundColor: 'rgba(237,125,49,0.75)', 
            borderColor: '#ED7D31', 
            borderWidth: 1.5
          },
          { 
            label: 'Flujo de Efectivo Neto', 
            data: flujoCaja, 
            backgroundColor: 'rgba(91,155,213,0.75)', 
            borderColor: '#5B9BD5', 
            borderWidth: 1.5
          }
        ]
      },
      options: this.getChartOptions('bar-horizontal')
    });
  }

  /** Opciones comunes para las gráficas */
  private getChartOptions(type: 'line' | 'bar' | 'bar-horizontal'): any {
    const baseOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: { 
        legend: { 
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12 }
          }
        },
        zoom: {
          zoom: {
            wheel: { enabled: false }, // Deshabilitado scroll-zoom
            pinch: { enabled: false },
            mode: 'xy',
          },
          pan: {
            enabled: true,
            mode: 'xy',
          }
        }
      },
      scales: { 
        y: { 
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: function(value: any) {
              return '$' + value.toLocaleString();
            }
          }
        },
        x: {
          grid: { display: false }
        }
      }
    };

    if (type === 'bar-horizontal') {
      baseOptions.indexAxis = 'y';
      baseOptions.scales = {
        x: { 
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: function(value: any) {
              return '$' + value.toLocaleString();
            }
          }
        },
        y: {
          grid: { display: false }
        }
      };
      baseOptions.plugins.tooltip = {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            label += '$' + context.parsed.x.toLocaleString();
            return label;
          }
        }
      };
    }

    return baseOptions;
  }

  /** Obtiene la instancia de Chart por nombre */
  private getChartInstance(chartName: string): any {
    switch (chartName) {
      case 'estado': return this.chartEstado;
      case 'balance': return this.chartBalance;
      case 'flujo': return this.chartFlujo;
      default: return this.chartFullscreen;
    }
  }

  /** Zoom In */
  zoomIn(chartName: string): void {
    const chart = this.fullscreenChart ? this.chartFullscreen : this.getChartInstance(chartName);
    if (chart) {
      chart.zoom(1.2);
    }
  }

  /** Zoom Out */
  zoomOut(chartName: string): void {
    const chart = this.fullscreenChart ? this.chartFullscreen : this.getChartInstance(chartName);
    if (chart) {
      chart.zoom(0.8);
    }
  }

  /** Reset Zoom */
  resetZoom(chartName: string): void {
    const chart = this.fullscreenChart ? this.chartFullscreen : this.getChartInstance(chartName);
    if (chart) {
      chart.resetZoom();
    }
  }

  /** Abrir gráfica en pantalla completa */
  openFullscreen(chartName: string): void {
    this.fullscreenChart = chartName;
    // Esperar a que el modal se renderice
    setTimeout(() => {
      this.renderFullscreenChart(chartName);
    }, 100);
  }

  /** Cerrar pantalla completa */
  closeFullscreen(): void {
    try { this.chartFullscreen?.destroy?.(); } catch (e) {}
    this.chartFullscreen = null;
    this.fullscreenChart = null;
  }

  /** Obtener título de la gráfica */
  getChartTitle(chartName: string): string {
    switch (chartName) {
      case 'estado': return 'Estado de Resultados';
      case 'balance': return 'Balance General';
      case 'flujo': return 'Flujo de Efectivo';
      default: return 'Gráfica';
    }
  }

  /** Renderizar gráfica en modal fullscreen */
  private renderFullscreenChart(chartName: string): void {
    const ctx = document.getElementById('chart-fullscreen') as HTMLCanvasElement;
    if (!ctx) return;

    try { this.chartFullscreen?.destroy?.(); } catch (e) {}

    const data = this.savedChartData;
    let chartConfig: any;

    switch (chartName) {
      case 'estado':
        chartConfig = {
          type: 'line',
          data: {
            labels: ['Año 1','Año 2','Año 3','Año 4','Año 5'],
            datasets: [
              { label: 'Utilidad Bruta', data: data.estado.utilBruta, borderColor: '#5B9BD5', backgroundColor: 'rgba(91,155,213,0.15)', borderWidth: 3, tension: 0.3, fill: true, pointRadius: 6 },
              { label: 'Utilidad de Operación', data: data.estado.utilOperacion, borderColor: '#70AD47', backgroundColor: 'rgba(112,173,71,0.15)', borderWidth: 3, tension: 0.3, fill: true, pointRadius: 6 },
              { label: 'Utilidad Neta', data: data.estado.utilNeta, borderColor: '#9DC3E6', backgroundColor: 'rgba(157,195,230,0.15)', borderWidth: 3, tension: 0.3, fill: true, pointRadius: 6 }
            ]
          },
          options: this.getFullscreenChartOptions('line')
        };
        break;
      case 'balance':
        chartConfig = {
          type: 'bar',
          data: {
            labels: ['Año 1','Año 2','Año 3','Año 4','Año 5'],
            datasets: [
              { label: 'Activo', data: data.balance.activo, backgroundColor: 'rgba(91,155,213,0.75)', borderColor: '#5B9BD5', borderWidth: 2 },
              { label: 'Pasivo', data: data.balance.pasivo, backgroundColor: 'rgba(237,125,49,0.75)', borderColor: '#ED7D31', borderWidth: 2 },
              { label: 'Capital Contable', data: data.balance.capital, backgroundColor: 'rgba(112,173,71,0.75)', borderColor: '#70AD47', borderWidth: 2 }
            ]
          },
          options: this.getFullscreenChartOptions('bar')
        };
        break;
      case 'flujo':
        chartConfig = {
          type: 'bar',
          data: {
            labels: ['Año 1','Año 2','Año 3','Año 4','Año 5'],
            datasets: [
              { label: 'Ingresos', data: data.flujo.ingresos, backgroundColor: 'rgba(112,173,71,0.75)', borderColor: '#70AD47', borderWidth: 2 },
              { label: 'Egresos', data: data.flujo.egresos, backgroundColor: 'rgba(237,125,49,0.75)', borderColor: '#ED7D31', borderWidth: 2 },
              { label: 'Flujo de Efectivo Neto', data: data.flujo.flujoCaja, backgroundColor: 'rgba(91,155,213,0.75)', borderColor: '#5B9BD5', borderWidth: 2 }
            ]
          },
          options: this.getFullscreenChartOptions('bar-horizontal')
        };
        break;
    }

    if (chartConfig) {
      this.chartFullscreen = new Chart(ctx, chartConfig);
    }
  }

  /** Opciones para gráficas en fullscreen (más grandes) */
  private getFullscreenChartOptions(type: 'line' | 'bar' | 'bar-horizontal'): any {
    const options = this.getChartOptions(type);
    // Hacer fuentes más grandes para fullscreen
    options.plugins.legend.labels.font = { size: 14 };
    options.plugins.legend.labels.padding = 20;
    if (options.scales.y?.ticks) {
      options.scales.y.ticks.font = { size: 13 };
    }
    if (options.scales.x?.ticks) {
      options.scales.x.ticks.font = { size: 13 };
    }
    return options;
  }

}
