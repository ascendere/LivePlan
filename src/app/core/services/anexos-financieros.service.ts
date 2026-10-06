import { Injectable } from '@angular/core';
import { InversionService } from './inversion.service';

/** Una fila de una tabla de anexo. `valores` va en el mismo orden que `columnas`. */
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

/** Renglón intermedio: valores por mes de cada año (1..3) y totales de los años 1..5. */
interface RenglonCrudo {
  concepto: string;
  tipo?: FilaAnexo['tipo'];
  /** meses[anio] = valores mensuales; el año 1 de balance/flujo incluye el mes 0 al inicio. */
  meses: { [anio: number]: number[] };
  totales: { [anio: number]: number };
}

const ETIQUETAS_EXCEL: Record<string, string> = {
  // Flujo de Efectivo
  ingresos_venta_contado: 'Ventas al Contado',
  ingresos_cobros_ventas_credito: 'Cobro de Ventas a Crédito',
  ingresos_otros_ingresos: 'Otros Ingresos',
  ingresos_prestamos: 'Préstamos',
  ingresos_aportes_capital: 'Aportaciones de Capital',
  ingresos: 'Total Ingresos',
  egresos_compras_costos_contado: 'Compras y Costos al Contado',
  egresos_compras_costos_credito: 'Pago de Compras y Costos a Crédito',
  egresos_gastos_operacion: 'Gastos de Venta y Administración',
  egresos_intereses: 'Intereses',
  egresos_pagos_prestamos: 'Pagos de Préstamos',
  egresos_pagos_sri: 'Pagos al SRI',
  egresos_pago_ptu: 'Pago de PTU',
  egresos: 'Total Egresos',
  aumento_inventarios: 'Aumento en Inventarios',
  flujo_caja: 'Flujo de Caja',
  efectivo_inicial: 'Efectivo al Inicio',
  efectivo_final: 'Efectivo al Final',
  // Balance General
  corrientes_efectivo: 'Efectivo',
  corrientes_cuentasx_cobrar: 'Cuentas por Cobrar (Clientes)',
  corrientes_inventarios: 'Inventarios',
  corrientes_otros: 'Otros',
  corrientes_suma: 'Suma de Activo Corriente',
  no_corrientes_suma: 'Suma de Activo No Corriente',
  total_activo: 'Total del Activo',
  pasivo_proveedores_corto_plazo: 'Proveedores',
  pasivo_prestamos_corto_plazo: 'Préstamos Bancarios',
  pasivo_cuentasx_pagar_corto_plazo: 'Cuentas por Pagar (SRI)',
  pasivo_otros_corto_plazo: 'Otros (PTU)',
  pasivo_corto_plazo_suma: 'Suma de Pasivo Corto Plazo',
  pasivo_prestamos_largo_plazo: 'Préstamos Bancarios',
  pasivo_otros_largo_plazo: 'Otros',
  pasivo_largo_plazo_suma: 'Suma de Pasivo de Largo Plazo',
  total_pasivo: 'Total del Pasivo',
  capital_social: 'Capital Social',
  capital_adicional: 'Capital Adicional (Superávit)',
  utilidades_retenidas: 'Utilidades Retenidas',
  utilidad_del_ejercicio: 'Utilidad del Ejercicio',
  total_capital_contable: 'Total de Capital Contable',
};

/** Renglones que se muestran como subtotal/total (en negrita). */
const CLAVES_SUBTOTAL = new Set([
  'ingresos', 'egresos', 'flujo_caja', 'efectivo_final',
  'corrientes_suma', 'no_corrientes_suma', 'pasivo_corto_plazo_suma', 'pasivo_largo_plazo_suma',
]);
const CLAVES_TOTAL = new Set(['total_activo', 'total_pasivo', 'total_capital_contable']);

/** Renglones fijos del Estado de Resultados (clave del API, etiqueta y tipo). */
const RENGLONES_ESTADO: { clave: string; concepto: string; tipo?: FilaAnexo['tipo'] }[] = [
  { clave: 'ventas', concepto: 'Ventas' },
  { clave: 'costos_ventas', concepto: 'Costos de Ventas' },
  { clave: 'utilidad_bruta', concepto: 'Utilidad Bruta', tipo: 'subtotal' },
  { clave: 'gastos_venta_adm', concepto: 'Gastos de Venta y Administración' },
  { clave: 'depreciacion', concepto: 'Depreciación' },
  { clave: 'amortizacion', concepto: 'Amortización' },
  { clave: 'utilidad_previo_int_imp', concepto: 'Utilidad Previo Int. e Imp.', tipo: 'subtotal' },
  { clave: 'gastos_financieros', concepto: 'Gastos Financieros' },
  { clave: 'utilidad_antes_ptu', concepto: 'Utilidad Antes de PTU', tipo: 'subtotal' },
  { clave: 'ptu', concepto: 'PTU' },
  { clave: 'utilidad_antes_impuestos', concepto: 'Utilidad Antes de Impuestos', tipo: 'subtotal' },
  { clave: 'isr', concepto: 'ISR' },
  { clave: 'utilidad_neta', concepto: 'Utilidad Neta', tipo: 'total' },
];

/**
 * Arma las tablas de los Anexos del PDF con los mismos datos y el mismo
 * criterio que las pantallas "Estados Financieros" (Balance General, Estado
 * de Resultados, Flujo de Efectivo) y "Préstamo".
 */
@Injectable({ providedIn: 'root' })
export class AnexosFinancierosService {
  constructor(private readonly inversionService: InversionService) {}

  async obtener(planId: number): Promise<AnexosFinancieros> {
    const [estado, balance, flujo, gastos, datosPrestamo, cuotas] = await Promise.all([
      this.inversionService.getEstadoResultados(planId).catch(() => null),
      this.inversionService.getBalanceGeneral(planId).catch(() => null),
      this.inversionService.getFlujoEfectivo(planId).catch(() => null),
      this.inversionService.getGastosOperacion(planId).catch(() => null),
      this.inversionService.getDatosPrestamo(planId).catch(() => null),
      this.inversionService.getCuotasPrestamo(planId).catch(() => null),
    ]);

    const gastosItems: { descripcion: string; mensual: number; anual: number }[] =
      (gastos as any)?.gastos ?? [];

    return {
      balance: this.armarEstadoFinanciero('Balance general', this.renglonesDinamicos(balance, true, null)),
      estado: this.armarEstadoFinanciero(
        'Estado de resultados',
        this.renglonesEstado(estado, gastosItems),
      ),
      flujo: this.armarEstadoFinanciero(
        'Flujo de efectivo',
        this.renglonesDinamicos(flujo, true, gastosItems),
      ),
      prestamo: this.armarPrestamo(datosPrestamo as any, cuotas as any),
    };
  }

  // ---------------------------------------------------------------- Estado de resultados

  private renglonesEstado(respuesta: any, gastosItems: { descripcion: string; mensual: number; anual: number }[]): RenglonCrudo[] {
    const items: any[] = Array.isArray(respuesta?.items) ? respuesta.items : [];
    const sumas: any[] = Array.isArray(respuesta?.sumas_anuales) ? respuesta.sumas_anuales : [];

    const renglones: RenglonCrudo[] = RENGLONES_ESTADO.map((r) => ({
      concepto: r.concepto,
      tipo: r.tipo,
      meses: { 1: new Array(12).fill(0), 2: new Array(12).fill(0), 3: new Array(12).fill(0) },
      totales: {},
    }));

    for (const item of items) {
      const anio = Number(item.anio);
      const mes = Number(item.mes);
      if (mes === 0 || anio < 1 || anio > 3 || mes < 1 || mes > 12) continue;
      RENGLONES_ESTADO.forEach((r, i) => {
        renglones[i].meses[anio][mes - 1] = Number(item[r.clave]) || 0;
      });
    }
    for (const suma of sumas) {
      const anio = Number(suma.anio);
      RENGLONES_ESTADO.forEach((r, i) => {
        renglones[i].totales[anio] = Number(suma[r.clave]) || 0;
      });
    }

    return this.desagruparGastos(
      renglones,
      (r) => r.concepto === 'Gastos de Venta y Administración',
      'Total Gastos de Venta y Administración',
      gastosItems,
      false,
    );
  }

  // ---------------------------------------------------------------- Balance / Flujo

  /**
   * Un renglón por cada campo numérico del API (igual que la pantalla). En
   * balance y flujo el año 1 incluye el mes 0 (foto inicial), así que trae 13
   * valores; los años 2 y 3 traen 12.
   */
  private renglonesDinamicos(
    respuesta: any,
    anio1ConMes0: boolean,
    gastosItems: { descripcion: string; mensual: number; anual: number }[] | null,
  ): RenglonCrudo[] {
    const items: any[] = Array.isArray(respuesta?.items) ? respuesta.items : Array.isArray(respuesta) ? respuesta : [];
    if (items.length === 0) return [];
    const sumas: any[] = respuesta?.sumas_anuales || respuesta?.sumas || [];

    const omitir = ['id', 'plan_negocio_id', 'anio', 'mes'];
    const claves = Object.keys(items[0]).filter((k) => !omitir.includes(k));

    const renglones: RenglonCrudo[] = claves.map((k) => ({
      concepto: ETIQUETAS_EXCEL[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      tipo: CLAVES_TOTAL.has(k) ? 'total' : CLAVES_SUBTOTAL.has(k) ? 'subtotal' : undefined,
      meses: {
        1: new Array(anio1ConMes0 ? 13 : 12).fill(0),
        2: new Array(12).fill(0),
        3: new Array(12).fill(0),
      },
      totales: {},
    }));

    for (const item of items) {
      const anio = Number(item.anio);
      const mes = Number(item.mes);
      if (anio < 1 || anio > 3) continue;
      let indice: number;
      if (anio === 1 && anio1ConMes0) {
        if (mes < 0 || mes > 12) continue;
        indice = mes;
      } else {
        if (mes < 1 || mes > 12) continue;
        indice = mes - 1;
      }
      claves.forEach((k, i) => {
        renglones[i].meses[anio][indice] = Number(item[k]) || 0;
      });
    }
    for (const suma of sumas) {
      const anio = Number(suma.anio);
      claves.forEach((k, i) => {
        renglones[i].totales[anio] = Number(suma[k]) || 0;
      });
    }

    if (!gastosItems) return renglones;
    // Flujo de efectivo: el renglón de gastos de operación se abre en sus conceptos.
    const etiquetaGastos = ETIQUETAS_EXCEL['egresos_gastos_operacion'];
    return this.desagruparGastos(
      renglones,
      (r) => r.concepto === etiquetaGastos,
      'Total Egresos Gastos Operación',
      gastosItems,
      anio1ConMes0,
    );
  }

  /**
   * Reemplaza el renglón agregado de gastos de operación por sus renglones
   * individuales (sueldos, publicidad, etc.) seguidos de un subtotal, igual
   * que en la pantalla. El monto de cada gasto es constante mes a mes.
   */
  private desagruparGastos(
    renglones: RenglonCrudo[],
    coincide: (r: RenglonCrudo) => boolean,
    etiquetaSubtotal: string,
    gastosItems: { descripcion: string; mensual: number; anual: number }[],
    anio1ConMes0: boolean,
  ): RenglonCrudo[] {
    const indice = renglones.findIndex(coincide);
    if (indice === -1 || gastosItems.length === 0) return renglones;

    const detalle: RenglonCrudo[] = gastosItems.map((g) => ({
      concepto: g.descripcion,
      tipo: 'detalle',
      meses: {
        1: anio1ConMes0 ? [0, ...new Array(12).fill(g.mensual)] : new Array(12).fill(g.mensual),
        2: new Array(12).fill(g.mensual),
        3: new Array(12).fill(g.mensual),
      },
      totales: { 1: g.anual, 2: g.anual, 3: g.anual, 4: g.anual, 5: g.anual },
    }));
    const subtotal: RenglonCrudo = { ...renglones[indice], concepto: etiquetaSubtotal, tipo: 'subtotal' };

    const resultado = [...renglones];
    resultado.splice(indice, 1, ...detalle, subtotal);
    return resultado;
  }

  /** Convierte los renglones en 3 tablas anuales (mensuales) + 1 de totales de los 5 años. */
  private armarEstadoFinanciero(nombre: string, renglones: RenglonCrudo[]): AnexoEstadoFinanciero {
    if (renglones.length === 0) return { tablas: [] };

    const tablas: TablaAnexo[] = [];
    for (const anio of [1, 2, 3]) {
      const meses = renglones[0].meses[anio];
      const tieneMes0 = meses.length === 13;
      const columnas = [
        ...meses.map((_, i) => `Mes ${tieneMes0 ? i : i + 1}`),
        'Total',
      ];
      tablas.push({
        subtitulo: `${nombre}, Año ${anio}: valores mensuales`,
        columnas,
        filas: renglones.map((r) => ({
          concepto: r.concepto,
          tipo: r.tipo,
          valores: [...r.meses[anio], r.totales[anio] ?? 0],
        })),
      });
    }

    tablas.push({
      subtitulo: `${nombre}: totales anuales`,
      columnas: [1, 2, 3, 4, 5].map((a) => `Año ${a}`),
      filas: renglones.map((r) => ({
        concepto: r.concepto,
        tipo: r.tipo,
        valores: [1, 2, 3, 4, 5].map((a) => r.totales[a] ?? 0),
      })),
    });
    return { tablas };
  }

  // ---------------------------------------------------------------- Préstamo

  private armarPrestamo(datos: any, cuotas: any): AnexoPrestamo | null {
    const d = Array.isArray(datos) ? datos[0] : datos;
    const lista: any[] = Array.isArray(cuotas) ? cuotas : [];
    if (!d && lista.length === 0) return null;

    const dinero = (n: any) => this.formatoNumero(Number(n) || 0);
    const resumen = d
      ? [
          { etiqueta: 'Monto del préstamo', valor: `$${dinero(d.monto)}` },
          { etiqueta: 'Tasa de interés anual', valor: `${d.tasa_anual ?? 0}%` },
          { etiqueta: 'Periodo de capitalización', valor: `${d.periodos_capitalizacion ?? ''}` },
          { etiqueta: 'Tasa de interés mensual', valor: `${d.tasa_mensual ?? 0}%` },
          { etiqueta: 'Periodos de amortización', valor: `${d.periodos_amortizacion ?? ''}` },
          { etiqueta: 'Cuota fija', valor: `$${dinero(d.cuota)}` },
        ]
      : [];

    const anios = Array.from(new Set(lista.map((c) => Number(c.anio) || 0))).sort((a, b) => a - b);
    const columnas = Array.from({ length: 12 }, (_, i) => `Mes ${i + 1}`);
    const tablas: TablaAnexo[] = anios.map((anio) => {
      const delAnio = lista.filter((c) => Number(c.anio) === anio);
      const porMes = (campo: string): number[] =>
        columnas.map((_, i) => {
          const cuota = delAnio.find((c) => Number(c.mes) === i + 1);
          return cuota ? Number(cuota[campo]) || 0 : NaN; // NaN = mes sin cuota ("-")
        });
      return {
        subtitulo: `Tabla de amortización del préstamo, Año ${anio}`,
        columnas,
        filas: [
          { concepto: 'Saldo Inicial', valores: porMes('saldo_inicial') },
          { concepto: 'Cuota Fija', valores: porMes('cuota_total') },
          { concepto: 'Intereses', valores: porMes('interes') },
          { concepto: 'Abono a Capital', valores: porMes('amortizacion') },
          { concepto: 'Saldo Final', tipo: 'subtotal', valores: porMes('saldo_pendiente') },
        ],
      };
    });

    return { resumen, tablas };
  }

  /** "1,234.56" (2 decimales, miles con coma), igual que number:'1.2-2' en las pantallas. */
  formatoNumero(valor: number): string {
    return valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
