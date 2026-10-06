import { Injectable } from '@angular/core';
import { InversionService } from './inversion.service';

/** Una fila de una tabla de anexo. `valores` va en el mismo orden que `columnas`; NaN = sin dato. */
export interface FilaAnexo {
  concepto: string;
  tipo?: 'detalle' | 'subtotal' | 'total';
  valores: number[];
}

export interface TablaAnexo {
  subtitulo: string;
  columnas: string[];
  filas: FilaAnexo[];
}

export interface AnexoEstadoFinanciero {
  /** Una tabla por año (1..3, mensual) y una última con los totales de los 5 años. */
  tablas: TablaAnexo[];
}

export interface AnexoPrestamo {
  /** Datos del préstamo (monto, tasas, cuota...) como "etiqueta → texto ya formateado". */
  resumen: { etiqueta: string; valor: string }[];
  /** Tabla de amortización, una por año. */
  tablas: TablaAnexo[];
}

export interface AnexosFinancieros {
  balance: AnexoEstadoFinanciero;
  estado: AnexoEstadoFinanciero;
  flujo: AnexoEstadoFinanciero;
  prestamo: AnexoPrestamo | null;
}

/**
 * Tablas de los Anexos del PDF y de la exportación de Estados Financieros.
 * Las arma el backend (mismos totales, nombres de renglón y gastos abiertos
 * que las pantallas, en una sola petición); aquí solo se interpretan y se les
 * da formato.
 */
@Injectable({ providedIn: 'root' })
export class AnexosFinancierosService {
  constructor(private readonly inversionService: InversionService) {}

  async obtener(planId: number): Promise<AnexosFinancieros> {
    return this.desdeRespuesta(await this.inversionService.getResumenFinanciero(planId, true));
  }

  /** Interpreta la respuesta de `/resumen_financiero/{plan}?anexos=1`. */
  desdeRespuesta(respuesta: any): AnexosFinancieros {
    const a = respuesta?.anexos ?? {};
    const estadoFinanciero = (x: any): AnexoEstadoFinanciero => ({
      tablas: (x?.tablas ?? []).map((t: any) => this.tabla(t)),
    });

    const p = a.prestamo;
    return {
      balance: estadoFinanciero(a.balance),
      estado: estadoFinanciero(a.estado),
      flujo: estadoFinanciero(a.flujo),
      prestamo: p
        ? {
            resumen: (p.resumen ?? []).map((d: any) => ({ etiqueta: d.etiqueta, valor: this.formatoDato(d) })),
            tablas: (p.tablas ?? []).map((t: any) => this.tabla(t)),
          }
        : null,
    };
  }

  private tabla(t: any): TablaAnexo {
    return {
      subtitulo: t.subtitulo,
      columnas: t.columnas ?? [],
      filas: (t.filas ?? []).map((f: any) => ({
        concepto: f.concepto,
        ...(f.tipo ? { tipo: f.tipo } : {}),
        // null = mes sin dato (p. ej. sin cuota) → NaN, que el PDF y el Excel muestran como "-"
        valores: (f.valores ?? []).map((v: number | null) => (v === null || v === undefined ? NaN : Number(v))),
      })),
    };
  }

  private formatoDato(d: { valor: number; formato: string }): string {
    const n = Number(d.valor) || 0;
    switch (d.formato) {
      case 'moneda':
        return `$${this.formatoNumero(n)}`;
      case 'porcentaje':
        return `${n}%`;
      default:
        return `${n}`;
    }
  }

  /** "1,234.56" (2 decimales, miles con coma), igual que number:'1.2-2' en las pantallas. */
  formatoNumero(valor: number): string {
    return valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
