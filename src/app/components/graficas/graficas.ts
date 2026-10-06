import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ResumenFinancieroService, TipoGrafica, ResumenFinanciero, FilaResumen } from '../../core/services/resumen-financiero.service';

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

  // Datos del resumen para recrear gráficas en fullscreen
  private resumen: ResumenFinanciero | null = null;

  // Data tables for display
  estadoData: any[] = [];
  balanceData: any[] = [];
  flujoData: any[] = [];

  constructor(private route: ActivatedRoute, private resumenService: ResumenFinancieroService) {}

  ngOnInit(): void {
    // Captura el ID de la ruta
    this.route.paramMap.subscribe(params => {
      this.planId = Number(params.get('id')) || 0;
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

  /** Carga los datos del resumen financiero y renderiza las gráficas */
  private async loadAllDataAndRenderCharts(): Promise<void> {
    try {
      const resumen = await this.resumenService.obtener(this.planId);
      this.resumen = resumen;

      this.estadoData = this.aFilasTabla(resumen.estado.filas);
      this.balanceData = this.aFilasTabla(resumen.balance.filas);
      this.flujoData = this.aFilasTabla(resumen.flujo.filas);

      this.renderChart('estado', 'chart-estado');
      this.renderChart('balance', 'chart-balance');
      this.renderChart('flujo', 'chart-flujo');

      // Agregar listener para tecla ESC
      document.addEventListener('keydown', this.handleKeydown);

    } catch (error) {
      console.error('Error al cargar datos para gráficas:', error);
    }
  }

  /** Convierte las filas del resumen al formato que lee la tabla del HTML. */
  private aFilasTabla(filas: FilaResumen[]): any[] {
    return filas.map(f => ({
      concepto: f.concepto,
      ano0: f.anio0, ano1: f.valores[0], ano2: f.valores[1], ano3: f.valores[2], ano4: f.valores[3], ano5: f.valores[4]
    }));
  }

  private renderChart(tipo: TipoGrafica, canvasId: string): void {
    const ctx: any = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!ctx || !this.resumen) return;
    const config = this.resumenService.crearConfigGrafica(tipo, this.resumen[tipo].filas);
    switch (tipo) {
      case 'estado':
        try { this.chartEstado?.destroy?.(); } catch (e) {}
        this.chartEstado = new Chart(ctx, config);
        break;
      case 'balance':
        try { this.chartBalance?.destroy?.(); } catch (e) {}
        this.chartBalance = new Chart(ctx, config);
        break;
      case 'flujo':
        try { this.chartFlujo?.destroy?.(); } catch (e) {}
        this.chartFlujo = new Chart(ctx, config);
        break;
    }
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
    if (!ctx || !this.resumen) return;
    if (chartName !== 'estado' && chartName !== 'balance' && chartName !== 'flujo') return;

    try { this.chartFullscreen?.destroy?.(); } catch (e) {}

    const tipo = chartName as TipoGrafica;
    this.chartFullscreen = new Chart(
      ctx,
      this.resumenService.crearConfigGrafica(tipo, this.resumen[tipo].filas, { pantallaCompleta: true })
    );
  }

}
