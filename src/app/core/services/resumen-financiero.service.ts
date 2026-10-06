import { Injectable } from '@angular/core';
import { InversionService } from './inversion.service';

declare const Chart: any;

export type TipoGrafica = 'estado' | 'balance' | 'flujo';

export interface FilaResumen {
  concepto: string;
  /** Un valor por año, años 1..5 en ese orden. */
  valores: number[];
  /**
   * Valor al inicio del proyecto ("Año 0" = mes 0 del Año 1 en Estados
   * Financieros). Solo existe en Balance General.
   */
  anio0?: number;
}

export interface ResumenGrafica {
  tipo: TipoGrafica;
  filas: FilaResumen[];
}

export interface ResumenFinanciero {
  estado: ResumenGrafica;
  balance: ResumenGrafica;
  flujo: ResumenGrafica;
}

const ETIQUETAS_ANIOS = [1, 2, 3, 4, 5].map((a) => `Año ${a}`);

// Colores por serie (borde); el relleno de las barras es el mismo con alfa.
const COLORES: Record<TipoGrafica, string[]> = {
  estado: ['#5B9BD5', '#70AD47', '#9DC3E6'],
  balance: ['#5B9BD5', '#ED7D31', '#70AD47'],
  flujo: ['#70AD47', '#ED7D31', '#5B9BD5'],
};

/**
 * Fuente única de los datos y las gráficas del resumen financiero (Estado de
 * Resultados, Balance General, Flujo de Efectivo). La usan el módulo de
 * Gráficas y el PDF de Planificación, para que ambos muestren exactamente lo
 * mismo.
 */
@Injectable({ providedIn: 'root' })
export class ResumenFinancieroService {
  constructor(private readonly inversionService: InversionService) {}

  /** Serie de Estado de Resultados, Balance General y Flujo de Efectivo (una petición). */
  async obtener(planId: number): Promise<ResumenFinanciero> {
    return this.desdeRespuesta(await this.pedir(planId, false));
  }

  /**
   * Respuesta cruda del backend. Con `conAnexos` incluye además las tablas de
   * los anexos (AnexosFinancierosService.desdeRespuesta las interpreta): el PDF
   * pide todo de una vez.
   */
  pedir(planId: number, conAnexos: boolean): Promise<any> {
    return this.inversionService.getResumenFinanciero(planId, conAnexos);
  }

  /**
   * El backend ya trae los totales anuales y los nombres de renglón; aquí solo
   * se completa lo que la pantalla necesita (el tipo de cada gráfica).
   * Balance General usa siempre los TOTALES (activo, pasivo, capital contable)
   * y es el único con "Año 0" (inicio del proyecto).
   */
  desdeRespuesta(respuesta: any): ResumenFinanciero {
    const r = respuesta?.resumen ?? {};
    const grupo = (tipo: TipoGrafica): ResumenGrafica => ({
      tipo,
      filas: (r[tipo]?.filas ?? []).map((f: any) => ({
        concepto: f.concepto,
        valores: (f.valores ?? []).map((v: unknown) => Number(v) || 0),
        ...(typeof f.anio0 === 'number' ? { anio0: f.anio0 } : {}),
      })),
    });
    return { estado: grupo('estado'), balance: grupo('balance'), flujo: grupo('flujo') };
  }

  /** Formato "$1,234" / "-$1,234" (igual que el pipe currency de la tabla de Gráficas). */
  formatearMoneda(valor: number): string {
    const redondeado = Math.round(valor);
    const texto = Math.abs(redondeado).toLocaleString('en-US');
    return `${redondeado < 0 ? '-' : ''}$${texto}`;
  }

  /**
   * Configuración de Chart.js para cada gráfica: Estado de Resultados y
   * Balance General en barras verticales; Flujo de Efectivo en barras
   * horizontales.
   */
  crearConfigGrafica(
    tipo: TipoGrafica,
    filas: FilaResumen[],
    opciones: { pantallaCompleta?: boolean; paraImpresion?: boolean } = {},
  ): any {
    const horizontal = tipo === 'flujo';
    const colores = COLORES[tipo];
    const borde = opciones.pantallaCompleta ? 2 : 1.5;

    // "-$1,234" (el signo antes del $), igual que en la tabla.
    const formatoMoneda = (valor: any) => {
      const n = Number(valor);
      return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString()}`;
    };
    const ejeValores: any = {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.05)' },
      ticks: { callback: formatoMoneda },
    };
    const ejeCategorias: any = { grid: { display: false } };
    if (opciones.pantallaCompleta) {
      ejeValores.ticks.font = { size: 13 };
      ejeCategorias.ticks = { font: { size: 13 } };
    }

    const plugins: any = {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: opciones.pantallaCompleta ? 20 : 15,
          font: { size: opciones.pantallaCompleta ? 14 : 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (contexto: any) => {
            const valor = horizontal ? contexto.parsed.x : contexto.parsed.y;
            const nombre = contexto.dataset.label ? `${contexto.dataset.label}: ` : '';
            return `${nombre}${formatoMoneda(valor)}`;
          },
        },
      },
    };
    if (!opciones.paraImpresion) {
      plugins.zoom = {
        zoom: { wheel: { enabled: false }, pinch: { enabled: false }, mode: 'xy' },
        pan: { enabled: true, mode: 'xy' },
      };
    }

    const config: any = {
      type: 'bar',
      data: {
        labels: ETIQUETAS_ANIOS,
        datasets: filas.map((fila, i) => ({
          label: fila.concepto,
          data: fila.valores,
          backgroundColor: this.conAlfa(colores[i], 0.75),
          borderColor: colores[i],
          borderWidth: borde,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        indexAxis: horizontal ? 'y' : 'x',
        plugins,
        scales: horizontal ? { x: ejeValores, y: ejeCategorias } : { y: ejeValores, x: ejeCategorias },
      },
    };

    if (opciones.paraImpresion) {
      // Sin animación ni redimensionado: la imagen debe estar completa en cuanto se crea.
      config.options.responsive = false;
      config.options.animation = false;
      config.options.devicePixelRatio = 3;
      config.plugins = [
        {
          id: 'fondoBlanco',
          beforeDraw: (chart: any) => {
            const ctx = chart.ctx;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
          },
        },
      ];
    }

    return config;
  }

  /**
   * Dibuja la gráfica fuera de pantalla y devuelve la imagen (PNG) con su
   * tamaño en px, para insertarla en el PDF. Devuelve null si Chart.js no
   * está disponible.
   */
  graficaComoImagen(
    tipo: TipoGrafica,
    filas: FilaResumen[],
  ): { dataUrl: string; ancho: number; alto: number } | null {
    if (typeof Chart === 'undefined') return null;

    const ancho = 700;
    const alto = tipo === 'flujo' ? 440 : 400;
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    // Chart.js con responsive=false toma el tamaño del propio canvas.
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;

    const chart = new Chart(canvas, this.crearConfigGrafica(tipo, filas, { paraImpresion: true }));
    try {
      return { dataUrl: chart.toBase64Image('image/png', 1), ancho, alto };
    } finally {
      chart.destroy();
    }
  }

  private conAlfa(hex: string, alfa: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`;
  }
}
