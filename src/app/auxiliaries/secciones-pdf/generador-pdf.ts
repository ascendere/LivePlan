import jsPDF from 'jspdf';
import { SeccionData, ImagenSeccion } from '../../core/services/firebase.service';
import { AnexosFinancierosService, AnexosFinancieros, TablaAnexo, FilaAnexo } from '../../core/services/anexos-financieros.service';
import {
  ResumenFinancieroService,
  ResumenFinanciero,
  ResumenGrafica,
  TipoGrafica,
  EvaluacionFinanciera,
} from '../../core/services/resumen-financiero.service';
import { medirImagen } from '../../core/utils/imagen';
import { COLOR_CLARO, COLOR_GRIS_AZUL, COLOR_PRIMARIO, COLOR_PRIMARIO_OSCURO } from './pdf-estilos';
import { dibujarPortada, LogoPortada } from './portada-pdf';
import { esSeccionEconomica, normalizarTexto, usaTextoGeneral } from './secciones-util';

const TITULO_TABLA_RESUMEN: Record<TipoGrafica, string> = {
  estado: 'Estado de resultados proyectado: utilidad bruta, de operación y neta',
  balance: 'Balance general proyectado: activo, pasivo y capital contable',
  flujo: 'Flujo de efectivo proyectado: ingresos, egresos y flujo neto',
};

const TITULO_FIGURA_RESUMEN: Record<TipoGrafica, string> = {
  estado: 'Utilidad bruta, de operación y neta por año',
  balance: 'Activo, pasivo y capital contable por año',
  flujo: 'Ingresos, egresos y flujo de efectivo neto por año',
};

/** Entrada del índice del PDF: `pagina` es la página física (la numeración visible resta la portada). */
interface EntradaIndice {
  titulo: string;
  pagina: number;
  nivel: 0 | 1;
}

const LINEAS_POR_PAGINA_INDICE = 28;

/** Lo que el generador necesita saber de un plan para armar su PDF. */
export interface DatosPlanificacionPdf {
  nombrePlan: string;
  /** Texto opcional de la portada (p. ej. "2026-2027"). */
  periodoPortada: string;
  /** URL (o data URL) del logo de la portada; vacío = sin logo. */
  logoPortadaUrl: string;
  secciones: SeccionData[];
  /** Id del plan en el backend (de ahí salen las tablas y gráficas financieras). */
  planLogicoId: string;
  /**
   * Respuesta de /resumen_financiero ya pedida por quien llama. Si no se da, el generador la pide él y, si falla, el
   * PDF sale sin tablas financieras (lo que quiere la pantalla de Planificación).
   */
  respuestaFinanciera?: unknown;
}

/** Nombre de archivo del PDF a partir del nombre del proyecto. */
export function nombreArchivoPdf(nombrePlan: string): string {
  return `${(nombrePlan || 'plan').replace(/[^\w\-]+/g, '_')}.pdf`;
}

/**
 * Generador del PDF de Planificación. Es el mismo código que antes vivía dentro de la pantalla de Planificación,
 * separado para poder generar el PDF de cualquier plan (p. ej. desde la lista de usuarios del administrador).
 */
export class GeneradorPdfPlanificacion {
  private readonly nombrePlan: string;
  private readonly periodoPortada: string;
  private readonly logoPortadaUrl: string;
  private readonly secciones: SeccionData[];
  private readonly planLogicoId: string;
  private readonly respuestaFinanciera?: unknown;

  // Páginas del PDF en horizontal (los anexos con tablas mensuales); el resto va vertical.
  private paginasHorizontales = new Set<number>();

  constructor(
    datos: DatosPlanificacionPdf,
    private readonly resumenService: ResumenFinancieroService,
    private readonly anexosService: AnexosFinancierosService,
  ) {
    this.nombrePlan = datos.nombrePlan;
    this.periodoPortada = datos.periodoPortada;
    this.logoPortadaUrl = datos.logoPortadaUrl;
    this.secciones = datos.secciones;
    this.planLogicoId = datos.planLogicoId;
    this.respuestaFinanciera = datos.respuestaFinanciera;
  }

  /**
   * Arma el PDF completo (portada, índice, secciones, tablas y gráficas financieras, anexos) y lo devuelve; quien lo
   * llama decide qué hacer con él (descargarlo). Funciona con los datos de CUALQUIER plan: no depende de la pantalla.
   */
  async generar(): Promise<jsPDF> {
    this.paginasHorizontales = new Set<number>();

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const headerHeight = 16;
    const footerHeight = 14;
    const contentTop = headerHeight + 10;
    const contentBottom = pageHeight - footerHeight;
    const lineHeight = 6.5;
    const maxTextWidth = pageWidth - margin * 2;
    let y = contentTop;

    dibujarPortada(pdf, pageWidth, pageHeight, {
      titulo: this.nombrePlan,
      periodo: this.periodoPortada,
      logo: await this.prepararLogoPortada(),
    });

    // Índice al principio (después de la portada). Se reserva(n) la(s)
    // página(s) ahora y se dibuja al final, cuando ya se sabe en qué página
    // empieza cada sección y cada anexo. Entradas: secciones con título +
    // "Anexos" + los 4 anexos.
    const seccionesConTitulo = this.secciones.filter((sec) => sec.titulo && sec.titulo.trim() !== '');
    const entradasIndice: EntradaIndice[] = [];
    const paginasIndice = Math.max(1, Math.ceil((seccionesConTitulo.length + 5) / LINEAS_POR_PAGINA_INDICE));
    for (let i = 0; i < paginasIndice; i++) pdf.addPage();
    const paginaIndice = 2; // física; la numeración visible resta la portada

    pdf.addPage();
    y = contentTop;

    // Función PURA: no muta nada por fuera, devuelve la Y que corresponde
    // usar a partir de ahora (la misma si cabe, o el tope de una página
    // nueva si no). Todo el código de abajo reasigna "y = checkPageBreak(...)"
    // — así, cualquier función auxiliar (como dibujarImagenesSeccion, que
    // lleva su propia variable local "y") se entera de inmediato si hubo
    // salto de página, en vez de seguir dibujando en una posición vieja.
    const checkPageBreak = (yActual: number, requiredSpace: number = 20): number => {
      if (yActual + requiredSpace > contentBottom) {
        pdf.addPage();
        return contentTop;
      }
      return yActual;
    };

    // Numeración corrida de figuras (APA: "Figura 1", "Figura 2"...) en todo el documento.
    const figuras = { n: 0 };
    const tablas = { n: 0 };
    // Escribe un párrafo línea por línea, pasando a la hoja siguiente solo cuando
    // se llena la actual (un párrafo largo no deja un hueco en blanco al pie de
    // la hoja ni se corta). El avance entre líneas es el real de la letra
    // (10.5 pt × 1.15), no un valor fijo mayor, que dejaba espacios enormes.
    const interlineado = 10.5 * 1.15 * 0.3528;
    const escribirParrafo = (texto: string): void => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10.5);
      pdf.setTextColor(60, 60, 60);
      // trim: un espacio o salto de línea al final del texto del usuario generaba una
      // línea vacía extra (un hueco de más entre respuestas).
      const lineas = pdf.splitTextToSize(texto.trim(), maxTextWidth - 6) as string[];
      while (lineas.length > 0 && lineas[lineas.length - 1].trim() === '') lineas.pop();
      for (const linea of lineas) {
        if (y + interlineado > contentBottom) {
          pdf.addPage();
          y = contentTop;
        }
        pdf.text(linea, margin + 4, y);
        y += interlineado;
      }
      y += 3; // separación entre una respuesta y la siguiente
    };

    // Todo lo financiero (series de las tablas/gráficas de "Análisis
    // económico y Financiero" y las tablas de los anexos) viene del backend
    // en UNA sola petición, con los mismos números que el módulo de Gráficas
    // y Estados Financieros.
    let resumen: ResumenFinanciero | null = null;
    let anexos: AnexosFinancieros | null = null;
    let evaluacion: EvaluacionFinanciera | null = null;
    const planNumerico = Number(this.planLogicoId);
    if (Number.isFinite(planNumerico) && planNumerico > 0) {
      try {
        const respuesta = this.respuestaFinanciera ?? (await this.resumenService.pedir(planNumerico, true, true));
        resumen = this.resumenService.desdeRespuesta(respuesta);
        anexos = this.anexosService.desdeRespuesta(respuesta);
        evaluacion = this.resumenService.evaluacionDesdeRespuesta(respuesta);
      } catch (error) {
        console.warn('No se pudieron cargar los datos financieros para el PDF:', error);
      }
    }
    const alturaUtilPagina = contentBottom - contentTop;
    let primeraSeccion = true;
    for (const seccion of this.secciones) {
      // Saltar secciones sin título
      if (!seccion.titulo || seccion.titulo.trim() === '') continue;

      // Cada sección arranca en hoja nueva (la primera ya la tiene: la
      // portada dejó una página nueva lista).
      if (!primeraSeccion) {
        pdf.addPage();
        y = contentTop;
      }
      primeraSeccion = false;
      entradasIndice.push({ titulo: seccion.titulo.trim(), pagina: pdf.getNumberOfPages(), nivel: 0 });

      // Banda de título de sección. El tamaño/peso de letra debe fijarse
      // ANTES de splitTextToSize: esa función mide con la fuente activa en
      // ese momento, así que si se mide con la de la sección anterior (más
      // chica) el texto calza mal en la banda y se sale al dibujarlo grande.
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      const tituloLines = pdf.splitTextToSize(seccion.titulo, maxTextWidth - 6);
      const bandaAltura = tituloLines.length * 6 + 6;
      y = checkPageBreak(y, bandaAltura + 10);
      pdf.setFillColor(...COLOR_PRIMARIO);
      pdf.rect(margin, y, maxTextWidth, bandaAltura, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.text(tituloLines, margin + 4, y + 6.5);
      pdf.setFont('helvetica', 'normal');
      y += bandaAltura + 8;

      // NO incluir instrucción de secciones precargadas en el PDF

      // Texto general de la sección: solo lo usan las secciones propias (en las
      // precargadas el campo "Descripción General" ya no existe). Va primero,
      // como introducción, antes de las respuestas de sus etiquetas.
      if (usaTextoGeneral(seccion) && seccion.descripcion && seccion.descripcion.trim() !== '') {
        escribirParrafo(seccion.descripcion);
      }

      // Subsecciones: solo se imprime la respuesta. El título de la pregunta
      // (sub.pregunta) NO se incluye en el PDF, aunque esté respondida; las
      // preguntas sin respuesta no dejan nada.
      for (const sub of seccion.subsecciones) {
        if (sub.descripcion && sub.descripcion.trim() !== '') {
          escribirParrafo(sub.descripcion);
        }

        // Imágenes de esta pregunta, justo debajo de su respuesta.
        if (sub.imagenes && sub.imagenes.length > 0) {
          y = await this.dibujarImagenesSeccion(pdf, sub.imagenes, margin, y, maxTextWidth, alturaUtilPagina, checkPageBreak, figuras);
        }

        // Análisis económico y Financiero: primero la tabla y luego la
        // gráfica que corresponde a la pregunta.
        if (
          evaluacion &&
          esSeccionEconomica(seccion) &&
          normalizarTexto(sub.pregunta) === 'evaluacion financiera'
        ) {
          y = this.dibujarEvaluacionFinanciera(pdf, evaluacion, margin, y, maxTextWidth, checkPageBreak, tablas);
        }

        const tipo = esSeccionEconomica(seccion) ? this.tipoResumenDePregunta(sub.pregunta) : null;
        if (tipo && resumen) {
          y = this.dibujarTablaResumen(pdf, resumen[tipo], tipo, margin, y, maxTextWidth, lineHeight, checkPageBreak, tablas);
          const imagen = this.resumenService.graficaComoImagen(tipo, resumen[tipo].filas);
          if (imagen) {
            y = this.dibujarFigura(
              pdf, imagen.dataUrl, 'PNG', imagen.ancho, imagen.alto,
              TITULO_FIGURA_RESUMEN[tipo], 'Elaboración propia',
              margin, y, maxTextWidth, alturaUtilPagina, checkPageBreak, figuras,
            );
          }
        }
      }

      // Imágenes a nivel de sección (Análisis económico, secciones propias
      // sin preguntas e imágenes subidas antes de existir las de pregunta).
      const imagenes = seccion.imagenes || [];
      if (imagenes.length > 0) {
        y = await this.dibujarImagenesSeccion(pdf, imagenes, margin, y, maxTextWidth, alturaUtilPagina, checkPageBreak, figuras);
      }

    }

    // Anexos al final: Balance General, Estado de Resultados, Flujo de
    // Efectivo (módulo Estados Financieros) y Préstamo (módulo Préstamo).
    entradasIndice.push(...this.dibujarAnexos(pdf, anexos, margin, headerHeight, footerHeight, contentTop));

    this.dibujarIndice(pdf, entradasIndice, paginaIndice, paginasIndice, margin, contentTop, pageWidth, contentBottom);

    this.dibujarEncabezadoPie(pdf, pageWidth, pageHeight, margin, headerHeight, footerHeight);

    return pdf;
  }

  /** Carga el logo para dibujarlo en el PDF; si no se puede leer, el PDF sale igual, sin logo. */
  private async prepararLogoPortada(): Promise<LogoPortada | null> {
    if (!this.logoPortadaUrl) return null;
    try {
      const dataUrl = this.logoPortadaUrl.startsWith('data:')
        ? this.logoPortadaUrl
        : await this.convertirImagenUrlABase64(this.logoPortadaUrl);
      const { ancho, alto } = await medirImagen(dataUrl);
      return { dataUrl, ancho, alto };
    } catch (error) {
      console.warn('No se pudo cargar el logo de la portada; el PDF se genera sin él:', error);
      return null;
    }
  }

  /**
   * Encabezado y pie de página institucionales en todas las páginas de
   * contenido (todas menos la portada, página 1). Se dibuja al final, cuando
   * ya se conoce el total de páginas, para poder mostrar "Página X de Y".
   */
  private dibujarEncabezadoPie(pdf: jsPDF, pageWidthVertical: number, pageHeightVertical: number, margin: number, headerHeight: number, footerHeight: number): void {
    const totalPaginas = pdf.getNumberOfPages();
    for (let i = 2; i <= totalPaginas; i++) {
      pdf.setPage(i);
      // Las páginas de anexos con tablas mensuales son horizontales: intercambian ancho y alto.
      const horizontal = this.paginasHorizontales.has(i);
      const pageWidth = horizontal ? pageHeightVertical : pageWidthVertical;
      const pageHeight = horizontal ? pageWidthVertical : pageHeightVertical;

      pdf.setFillColor(...COLOR_PRIMARIO);
      pdf.rect(0, 0, pageWidth, headerHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('UTPL', margin, headerHeight / 2 + 2.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const tituloCorto = pdf.splitTextToSize(this.nombrePlan || 'Plan de Negocio', pageWidth - margin * 2 - 20)[0] || '';
      pdf.text(tituloCorto, pageWidth - margin, headerHeight / 2 + 2.5, { align: 'right' });

      pdf.setDrawColor(...COLOR_GRIS_AZUL);
      pdf.setLineWidth(0.3);
      pdf.line(margin, pageHeight - footerHeight, pageWidth - margin, pageHeight - footerHeight);
      pdf.setTextColor(120, 120, 120);
      pdf.setFontSize(8.5);
      pdf.text(`Página ${i - 1} de ${totalPaginas - 1}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
    }
  }

  // ============================================================
  //  ANEXOS
  // ============================================================

  /**
   * Anexos al final del PDF, en hojas horizontales para que quepan las
   * columnas mensuales (sin hoja de portada: el índice ya los lista):
   *   Anexo 1. Balance General     (módulo Estados Financieros)
   *   Anexo 2. Estado de Resultados (módulo Estados Financieros)
   *   Anexo 3. Flujo de Efectivo   (módulo Estados Financieros)
   *   Anexo 4. Préstamo            (módulo Préstamo)
   * Cada anexo empieza en hoja nueva; cada tabla anual va en su propia hoja
   * (las filas se reparten en varias hojas, repitiendo el encabezado, si no caben).
   */
  private dibujarAnexos(
    pdf: jsPDF,
    anexos: AnexosFinancieros | null,
    margin: number,
    headerHeight: number,
    footerHeight: number,
    contentTopVertical: number,
  ): EntradaIndice[] {
    const entradas: EntradaIndice[] = [];
    const definiciones: { num: number; titulo: string; origen: string; tablas: TablaAnexo[]; dinero: boolean }[] = [
      { num: 1, titulo: 'Balance General', origen: 'Módulo Estados Financieros', tablas: anexos?.balance.tablas ?? [], dinero: false },
      { num: 2, titulo: 'Estado de Resultados', origen: 'Módulo Estados Financieros', tablas: anexos?.estado.tablas ?? [], dinero: false },
      { num: 3, titulo: 'Flujo de Efectivo', origen: 'Módulo Estados Financieros', tablas: anexos?.flujo.tablas ?? [], dinero: false },
      { num: 4, titulo: 'Préstamo', origen: 'Módulo Préstamo', tablas: anexos?.prestamo?.tablas ?? [], dinero: true },
    ];

    // --- Anexos (horizontales)
    const W = 297;
    const H = 210;
    const contentTop = headerHeight + 8;
    const contentBottom = H - footerHeight;
    const ancho = W - margin * 2;
    let yH = contentTop;

    const nuevaPagina = (tituloAnexo: string, continuacion: boolean): void => {
      pdf.addPage('a4', 'l');
      this.paginasHorizontales.add(pdf.getNumberOfPages());
      pdf.setFillColor(...COLOR_PRIMARIO);
      pdf.rect(margin, contentTop, ancho, 9, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(continuacion ? `${tituloAnexo} (continuación)` : tituloAnexo, margin + 4, contentTop + 6.2);
      yH = contentTop + 9 + 6;
    };

    for (const d of definiciones) {
      const tituloAnexo = `Anexo ${d.num}. ${d.titulo}`;
      nuevaPagina(tituloAnexo, false);
      // "Anexos" no tiene hoja propia (el índice ya los lista): su entrada apunta al primer anexo.
      if (d.num === 1) entradas.push({ titulo: 'Anexos', pagina: pdf.getNumberOfPages(), nivel: 0 });
      entradas.push({ titulo: tituloAnexo, pagina: pdf.getNumberOfPages(), nivel: 1 });

      if (d.tablas.length === 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10.5);
        pdf.setTextColor(90, 90, 90);
        pdf.text('No hay datos disponibles para este anexo.', margin, yH + 4);
        continue;
      }

      let numTabla = 0;

      // Anexo 4: primero los datos generales del préstamo (una sola fila).
      if (d.num === 4 && anexos?.prestamo && anexos.prestamo.resumen.length > 0) {
        numTabla += 1;
        yH = this.dibujarResumenAnexo(pdf, anexos.prestamo.resumen, `Tabla A${d.num}.${numTabla}`, 'Datos del préstamo', margin, yH, ancho);
      }

      d.tablas.forEach((tabla, indice) => {
        numTabla += 1;
        const esAmortizacion = d.num === 4;
        // Estados financieros: cada tabla anual en hoja nueva. Préstamo: tablas
        // pequeñas, se acomodan varias por hoja.
        if (indice > 0 && !esAmortizacion) nuevaPagina(tituloAnexo, false);
        yH = this.dibujarTablaAnexo(
          pdf, tabla, `Tabla A${d.num}.${numTabla}`, d.dinero, margin, yH, ancho,
          contentBottom, () => nuevaPagina(tituloAnexo, true), () => yH,
        );
      });
    }

    return entradas;
  }

  /**
   * Dibuja el índice en la(s) página(s) reservada(s) después de la portada:
   * título de cada sección y anexo, puntos guía y número de página (el mismo
   * que muestra el pie de página, que no cuenta la portada).
   */
  private dibujarIndice(
    pdf: jsPDF,
    entradas: EntradaIndice[],
    primeraPagina: number,
    cantidadPaginas: number,
    margin: number,
    contentTop: number,
    pageWidth: number,
    contentBottom: number,
  ): void {
    const ancho = pageWidth - margin * 2;
    const alturaLinea = 8;
    let pagina = primeraPagina;
    pdf.setPage(pagina);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setFillColor(...COLOR_PRIMARIO);
    pdf.rect(margin, contentTop, ancho, 12, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text('Índice', margin + 4, contentTop + 8);
    let y = contentTop + 12 + 12;

    for (const e of entradas) {
      const sangria = e.nivel * 8;
      const tamano = e.nivel === 0 ? 11 : 10.5;
      const color: [number, number, number] = e.nivel === 0 ? COLOR_PRIMARIO_OSCURO : [60, 60, 60];
      const interlineado = tamano * 1.15 * 0.3528; // mm entre líneas de un título largo

      pdf.setFont('helvetica', e.nivel === 0 ? 'bold' : 'normal');
      pdf.setFontSize(tamano);
      const numero = String(e.pagina - 1); // el pie de página no cuenta la portada
      const anchoNumero = pdf.getTextWidth(numero);
      const lineas = pdf.splitTextToSize(e.titulo, ancho - sangria - anchoNumero - 8) as string[];

      if (y + lineas.length * interlineado > contentBottom && pagina < primeraPagina + cantidadPaginas - 1) {
        pagina += 1;
        pdf.setPage(pagina);
        y = contentTop;
      }

      pdf.setTextColor(...color);
      pdf.text(lineas, margin + sangria, y);

      // Puntos guía hasta el número de página, en la última línea del título.
      const yUltima = y + (lineas.length - 1) * interlineado;
      const finTexto = margin + sangria + pdf.getTextWidth(lineas[lineas.length - 1]) + 2;
      const inicioNumero = margin + ancho - anchoNumero;
      const cantidadPuntos = Math.floor((inicioNumero - 2 - finTexto) / pdf.getTextWidth('.'));
      if (cantidadPuntos > 0) {
        pdf.setTextColor(150, 150, 150);
        pdf.text('.'.repeat(cantidadPuntos), finTexto, yUltima);
      }
      pdf.setTextColor(...color);
      pdf.text(numero, margin + ancho, yUltima, { align: 'right' });

      y = yUltima + alturaLinea + (e.nivel === 0 ? 1.5 : 0);
    }
  }

  /** Dibuja los datos generales del préstamo como una tabla de una fila (estilo APA). */
  private dibujarResumenAnexo(
    pdf: jsPDF,
    resumen: { etiqueta: string; valor: string }[],
    numero: string,
    titulo: string,
    margin: number,
    yInicial: number,
    anchoDisponible: number,
  ): number {
    let y = yInicial;
    pdf.setTextColor(40, 40, 40);
    pdf.setFontSize(10.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text(numero, margin, y + 3.8);
    y += 5.2;
    pdf.setFont('helvetica', 'italic');
    pdf.text(titulo, margin, y + 3.8);
    y += 5.2 + 1.5;

    const colW = anchoDisponible / resumen.length;
    const linea = (yl: number, grosor: number) => {
      pdf.setDrawColor(40, 40, 40);
      pdf.setLineWidth(grosor);
      pdf.line(margin, yl, margin + anchoDisponible, yl);
    };
    linea(y, 0.4);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    resumen.forEach((r, i) => pdf.text(r.etiqueta, margin + colW * i + colW / 2, y + 5, { align: 'center' }));
    y += 7.5;
    linea(y, 0.2);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    resumen.forEach((r, i) => pdf.text(r.valor, margin + colW * i + colW / 2, y + 5.5, { align: 'center' }));
    y += 8;
    linea(y, 0.4);
    return y + 9;
  }

  /**
   * Tabla de anexo en estilo APA: "Tabla N" en negrita, título en cursiva,
   * solo líneas horizontales, "Nota." al pie. Si las filas no caben en la
   * hoja, sigue en una hoja nueva repitiendo el encabezado de columnas.
   * Devuelve la Y donde puede seguir dibujándose.
   */
  private dibujarTablaAnexo(
    pdf: jsPDF,
    tabla: TablaAnexo,
    numero: string,
    conSimboloDinero: boolean,
    margin: number,
    yInicial: number,
    anchoDisponible: number,
    contentBottom: number,
    nuevaPaginaContinuacion: () => void,
    leerY: () => number,
  ): number {
    const n = tabla.columnas.length;
    const denso = n >= 12;
    const alturaEncabezado = denso ? 6 : 7;
    const lh = 5.2;

    // Altura de fila: la deseada, pero si la tabla entera cabe en una hoja
    // apretando un poco las filas, se aprietan (mejor una tabla completa en
    // una hoja que 3 filas sueltas en la siguiente). Mínimo 3.6 mm; si ni así
    // cabe, continúa en la hoja siguiente repitiendo el encabezado.
    const filaDeseada = denso ? 5 : 5.6;
    const espacioFilas = contentBottom - (yInicial + lh * 2 + 1.5 + alturaEncabezado + 2.5 + lh + 3);
    const filaAjustada = tabla.filas.length > 0 ? espacioFilas / tabla.filas.length : filaDeseada;
    const alturaFila = Math.max(3.6, Math.min(filaDeseada, filaAjustada));
    const tamano = denso ? (alturaFila >= 4.8 ? 7.5 : alturaFila >= 4.2 ? 7 : 6.5) : 8.5;

    // Geometría: pocas columnas → anchas pero acotadas; muchas → reparten el ancho.
    const anchoColumna = n <= 6 ? 30 : undefined;
    const anchoConcepto = anchoColumna ? Math.min(110, anchoDisponible - n * anchoColumna) : denso && n > 13 ? 56 : 62;
    const colW = anchoColumna ?? (anchoDisponible - anchoConcepto) / n;
    const anchoTabla = anchoConcepto + colW * n;
    const xDerecha = margin + anchoTabla;

    let y = yInicial;
    const alturaMinima = lh * 2 + 1.5 + alturaEncabezado + alturaFila * 3 + 4;
    if (y + alturaMinima > contentBottom) {
      nuevaPaginaContinuacion();
      y = leerY();
    }

    // Leyenda
    pdf.setTextColor(40, 40, 40);
    pdf.setFontSize(10.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text(numero, margin, y + 3.8);
    y += lh;
    pdf.setFont('helvetica', 'italic');
    pdf.text(tabla.subtitulo, margin, y + 3.8);
    y += lh + 1.5;

    const linea = (yl: number, grosor: number, gris = 40) => {
      pdf.setDrawColor(gris, gris, gris);
      pdf.setLineWidth(grosor);
      pdf.line(margin, yl, xDerecha, yl);
    };
    const encabezado = () => {
      linea(y, 0.4);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(tamano);
      pdf.setTextColor(40, 40, 40);
      pdf.text('Concepto', margin + 1, y + alturaEncabezado - 1.9);
      tabla.columnas.forEach((col, i) => {
        pdf.text(col, margin + anchoConcepto + colW * (i + 1) - 1, y + alturaEncabezado - 1.9, { align: 'right' });
      });
      y += alturaEncabezado;
      linea(y, 0.2);
    };
    encabezado();

    const formato = (v: number): string => {
      if (Number.isNaN(v)) return '-';
      const texto = this.anexosService.formatoNumero(v);
      return conSimboloDinero ? (v < 0 ? `-$${texto.slice(1)}` : `$${texto}`) : texto;
    };

    for (const fila of tabla.filas) {
      if (y + alturaFila > contentBottom) {
        linea(y, 0.4);
        nuevaPaginaContinuacion();
        y = leerY();
        encabezado();
      }
      const negrita = fila.tipo === 'subtotal' || fila.tipo === 'total';
      if (fila.tipo === 'total') linea(y, 0.3);
      pdf.setFont('helvetica', negrita ? 'bold' : 'normal');
      pdf.setFontSize(tamano);
      pdf.setTextColor(fila.tipo === 'detalle' ? 90 : 40, fila.tipo === 'detalle' ? 90 : 40, fila.tipo === 'detalle' ? 90 : 40);

      const sangria = fila.tipo === 'detalle' ? 3 : 0;
      const lineas = pdf.splitTextToSize(fila.concepto, anchoConcepto - 3 - sangria) as string[];
      const concepto = lineas.length > 1 ? `${lineas[0].slice(0, -1)}…` : lineas[0];
      const baseline = y + alturaFila - 1.4;
      pdf.text(concepto, margin + 1 + sangria, baseline);
      fila.valores.forEach((v, i) => {
        pdf.text(formato(v), margin + anchoConcepto + colW * (i + 1) - 1, baseline, { align: 'right' });
      });
      y += alturaFila;
      linea(y, 0.1, 215);
    }
    linea(y, 0.4);

    // Nota
    y += 2.5;
    if (y + lh > contentBottom) {
      nuevaPaginaContinuacion();
      y = leerY();
    }
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    pdf.setFont('helvetica', 'italic');
    pdf.text('Nota.', margin, y + 3.5);
    const anchoNota = pdf.getTextWidth('Nota.');
    pdf.setFont('helvetica', 'normal');
    pdf.text(' Elaboración propia.', margin + anchoNota, y + 3.5);

    return y + lh + 5;
  }

  /**
   * Dibuja imágenes una debajo de otra (nunca dos a la misma altura), cada
   * una con su leyenda APA (ver dibujarFigura). Las imágenes antiguas sin
   * descripción/fuente se dibujan solas, sin número. Devuelve la nueva Y.
   */
  private async dibujarImagenesSeccion(
    pdf: jsPDF,
    imagenes: ImagenSeccion[],
    margin: number,
    yInicial: number,
    anchoDisponible: number,
    alturaUtilPagina: number,
    checkPageBreak: (yActual: number, espacio?: number) => number,
    figuras: { n: number },
  ): Promise<number> {
    let y = yInicial;
    for (const img of imagenes) {
      let base64: string;
      let dims: { width: number; height: number };
      try {
        base64 = await this.convertirImagenUrlABase64(img.url);
        dims = await this.obtenerDimensionesImagen(base64);
      } catch (error) {
        console.warn('Error al convertir o agregar imagen:', error);
        continue;
      }
      y = this.dibujarFigura(
        pdf, base64, this.formatoImagen(base64), dims.width, dims.height,
        img.descripcion || '', img.fuente || '',
        margin, y, anchoDisponible, alturaUtilPagina, checkPageBreak, figuras,
      );
    }
    return y;
  }

  /**
   * Dibuja una figura con su leyenda en formato APA 7:
   *
   *   Figura N                  (negrita)
   *   Descripción de la figura  (cursiva)
   *   [imagen]
   *   Nota. Fuente              ("Nota." en cursiva)
   *
   * La leyenda y la imagen se mantienen juntas en la misma página. Sin
   * descripción ni fuente se dibuja solo la imagen (sin número). Respeta la
   * proporción real de la imagen. Devuelve la nueva posición Y.
   */
  private dibujarFigura(
    pdf: jsPDF,
    base64: string,
    formato: 'PNG' | 'JPEG' | 'WEBP',
    ancho: number,
    alto: number,
    descripcionTexto: string,
    fuenteTexto: string,
    margin: number,
    yInicial: number,
    anchoDisponible: number,
    alturaUtilPagina: number,
    checkPageBreak: (yActual: number, espacio?: number) => number,
    figuras: { n: number },
  ): number {
    let y = yInicial;
    const gap = 3;
    const alturaMaxima = 90;
    const lh = 5.2;

    const descripcion = descripcionTexto.trim();
    const fuente = fuenteTexto.trim();
    const conLeyenda = descripcion !== '' || fuente !== '';

    // Medir la leyenda con la fuente que realmente se usará al dibujarla.
    pdf.setFontSize(10.5);
    pdf.setFont('helvetica', 'italic');
    const tituloLines = descripcion ? pdf.splitTextToSize(descripcion, anchoDisponible) : [];
    pdf.setFont('helvetica', 'normal');
    const notaLines = fuente ? pdf.splitTextToSize(`Nota. ${fuente}`, anchoDisponible) : [];

    const alturaEncabezado = conLeyenda ? lh + tituloLines.length * lh + 1.5 : 0;
    const alturaNota = notaLines.length > 0 ? gap + notaLines.length * lh : 0;

    // Proporción real; si no cabe a lo alto (incluida la leyenda) se achica.
    const alturaTope = Math.min(alturaMaxima, alturaUtilPagina - alturaEncabezado - alturaNota - 6);
    let w = anchoDisponible;
    let h = (alto / ancho) * w;
    if (h > alturaTope) {
      h = alturaTope;
      w = (ancho / alto) * h;
    }

    // Leyenda e imagen siempre juntas: si el bloque no cabe, página nueva.
    y = checkPageBreak(y, alturaEncabezado + h + alturaNota + 6);

    if (conLeyenda) {
      figuras.n += 1;
      pdf.setTextColor(40, 40, 40);
      pdf.setFontSize(10.5);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Figura ${figuras.n}`, margin, y + 3.8);
      y += lh;
      if (tituloLines.length > 0) {
        pdf.setFont('helvetica', 'italic');
        pdf.text(tituloLines, margin, y + 3.8);
        y += tituloLines.length * lh;
      }
      y += 1.5;
    }

    pdf.addImage(base64, formato, margin + (anchoDisponible - w) / 2, y, w, h, undefined, 'FAST');
    y += h;

    if (notaLines.length > 0) {
      y += gap;
      pdf.setFontSize(10.5);
      pdf.setTextColor(60, 60, 60);
      // "Nota." en cursiva y el resto de la primera línea en normal.
      pdf.setFont('helvetica', 'italic');
      pdf.text('Nota.', margin, y + 3.8);
      const anchoNota = pdf.getTextWidth('Nota.');
      pdf.setFont('helvetica', 'normal');
      pdf.text(notaLines[0].slice('Nota.'.length), margin + anchoNota, y + 3.8);
      if (notaLines.length > 1) {
        pdf.text(notaLines.slice(1), margin, y + 3.8 + lh);
      }
      y += notaLines.length * lh;
    }

    return y + 6;
  }

  /**
   * "Evaluación Financiera": las tablas del módulo Evaluación — conceptos por
   * año (Año 0 a 5), indicadores (VAN, TIR, TREMA) y la matriz del análisis
   * de sensibilidad con el par de variables que esté activo.
   */
  private dibujarEvaluacionFinanciera(
    pdf: jsPDF,
    ev: EvaluacionFinanciera,
    margin: number,
    yInicial: number,
    anchoDisponible: number,
    checkPageBreak: (yActual: number, espacio?: number) => number,
    tablas: { n: number },
  ): number {
    let y = yInicial;
    const dinero = (v: number) => this.resumenService.formatearMonedaDecimales(v);
    const porcentaje = (v: number) => `${v.toFixed(2)}%`;

    // 1) Conceptos de evaluación por año
    if (ev.conceptos.columnas.length > 0) {
      y = this.dibujarTablaTexto(pdf, {
        subtitulo: 'Conceptos de evaluación financiera',
        esquina: 'Concepto',
        columnas: ev.conceptos.columnas,
        filas: ev.conceptos.filas.map((f) => ({ etiqueta: f.concepto, celdas: f.valores.map(dinero) })),
        anchoConcepto: 48,
        tamano: 9,
      }, margin, y, anchoDisponible, checkPageBreak, tablas);
    }

    // 2) Indicadores del proyecto
    if (ev.indicadores) {
      y = this.dibujarTablaTexto(pdf, {
        subtitulo: 'Indicadores de rentabilidad del proyecto',
        esquina: 'Indicador',
        columnas: ['Valor'],
        filas: [
          { etiqueta: 'VAN', celdas: [dinero(ev.indicadores.van)] },
          { etiqueta: 'TIR', celdas: [ev.indicadores.tir === null ? 'No aplica' : porcentaje(ev.indicadores.tir)] },
          { etiqueta: 'TREMA', celdas: [porcentaje(ev.indicadores.trema)] },
        ],
        anchoConcepto: 60,
        anchoColumna: 40,
        tamano: 10,
      }, margin, y, anchoDisponible, checkPageBreak, tablas);
    }

    // 3) Matriz del análisis de sensibilidad (VAN)
    const m = ev.sensibilidad;
    if (m && m.filas.length > 0 && m.columnas.length > 0) {
      const etiqueta = (v: string) => ({ volumen: 'Volumen', precio: 'Precio', costo: 'Costo' } as Record<string, string>)[v] ?? v;
      y = this.dibujarTablaTexto(pdf, {
        subtitulo: `Análisis de sensibilidad del VAN: ${etiqueta(m.variableFila)} (filas) y ${etiqueta(m.variableColumna)} (columnas)`,
        esquina: etiqueta(m.variableFila),
        columnas: m.columnas.map((c) => `${c}%`),
        filas: m.filas.map((fila, i) => ({
          etiqueta: `${fila}%`,
          celdas: m.valores[i].map((v) => (v === null ? '-' : dinero(v))),
        })),
        anchoConcepto: 24,
        tamano: 8,
        nota: m.actualizada
          ? ''
          : 'La matriz de sensibilidad estaba pendiente de actualizar al generar este documento.',
      }, margin, y, anchoDisponible, checkPageBreak, tablas);
    }
    return y;
  }

  /**
   * Tabla de texto ya formateado en estilo APA 7 ("Tabla N" en negrita, título
   * en cursiva, solo líneas horizontales, "Nota." al pie). Se mantiene entera
   * en una página. `anchoColumna` fija el ancho de cada columna de valores; si
   * no se indica, las columnas reparten el ancho que deja la primera.
   */
  private dibujarTablaTexto(
    pdf: jsPDF,
    t: {
      subtitulo: string;
      esquina: string;
      columnas: string[];
      filas: { etiqueta: string; celdas: string[] }[];
      anchoConcepto: number;
      anchoColumna?: number;
      tamano: number;
      nota?: string;
    },
    margin: number,
    yInicial: number,
    anchoDisponible: number,
    checkPageBreak: (yActual: number, espacio?: number) => number,
    tablas: { n: number },
  ): number {
    const lh = 5.2;
    const alturaFila = 7;
    const colW = t.anchoColumna ?? (anchoDisponible - t.anchoConcepto) / t.columnas.length;
    const xDerecha = margin + t.anchoConcepto + colW * t.columnas.length;

    pdf.setFontSize(10.5);
    pdf.setFont('helvetica', 'italic');
    const tituloLines = pdf.splitTextToSize(t.subtitulo, anchoDisponible) as string[];
    const notaTexto = ('Elaboración propia. ' + (t.nota ?? '')).trim();
    pdf.setFont('helvetica', 'normal');
    const notaLines = pdf.splitTextToSize(`Nota. ${notaTexto}`, anchoDisponible) as string[];

    const alturaEncabezado = lh + tituloLines.length * lh + 1.5;
    const alturaTabla = alturaFila * (t.filas.length + 1);
    const alturaNota = 2.5 + notaLines.length * lh;

    let y = checkPageBreak(yInicial, alturaEncabezado + alturaTabla + alturaNota + 6);
    tablas.n += 1;

    pdf.setTextColor(40, 40, 40);
    pdf.setFontSize(10.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Tabla ${tablas.n}`, margin, y + 3.8);
    y += lh;
    pdf.setFont('helvetica', 'italic');
    pdf.text(tituloLines, margin, y + 3.8);
    y += tituloLines.length * lh + 1.5;

    const linea = (yl: number, grosor: number) => {
      pdf.setDrawColor(40, 40, 40);
      pdf.setLineWidth(grosor);
      pdf.line(margin, yl, xDerecha, yl);
    };
    const xCol = (i: number) => margin + t.anchoConcepto + colW * (i + 1) - 1;

    linea(y, 0.4);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(t.tamano);
    pdf.text(t.esquina, margin + 1, y + 4.8);
    t.columnas.forEach((c, i) => pdf.text(c, xCol(i), y + 4.8, { align: 'right' }));
    y += alturaFila;
    linea(y, 0.2);

    pdf.setFont('helvetica', 'normal');
    for (const fila of t.filas) {
      pdf.text(fila.etiqueta, margin + 1, y + 4.8);
      fila.celdas.forEach((c, i) => pdf.text(c, xCol(i), y + 4.8, { align: 'right' }));
      y += alturaFila;
    }
    linea(y, 0.4);

    // Nota (APA): "Nota." en cursiva, el resto en normal.
    y += 2.5;
    pdf.setFontSize(10.5);
    pdf.setTextColor(60, 60, 60);
    pdf.setFont('helvetica', 'italic');
    pdf.text('Nota.', margin, y + 3.8);
    const anchoNota = pdf.getTextWidth('Nota.');
    pdf.setFont('helvetica', 'normal');
    pdf.text(notaLines[0].slice('Nota.'.length), margin + anchoNota, y + 3.8);
    if (notaLines.length > 1) pdf.text(notaLines.slice(1), margin, y + 3.8 + lh);

    return y + notaLines.length * lh + 4;
  }

  /** Qué resumen financiero acompaña a cada pregunta de "Análisis económico y Financiero". */
  private tipoResumenDePregunta(pregunta: string): TipoGrafica | null {
    switch (normalizarTexto(pregunta)) {
      case 'plan de inversiones':
        return 'balance';
      case 'estado de resultados':
      case 'cuenta de resultados': // nombres anteriores de la etiqueta (planes ya guardados)
      case 'cuota de resultados':
        return 'estado';
      case 'flujo de efectivo':
        return 'flujo';
      default:
        return null;
    }
  }

  /**
   * Tabla del resumen financiero en estilo APA 7: "Tabla N" en negrita,
   * título en cursiva, solo líneas horizontales (arriba, bajo el encabezado
   * y al pie) y "Nota." debajo. Se mantiene completa en una sola página.
   */
  private dibujarTablaResumen(
    pdf: jsPDF,
    resumen: ResumenGrafica,
    tipo: TipoGrafica,
    margin: number,
    yInicial: number,
    anchoDisponible: number,
    lineHeight: number,
    checkPageBreak: (yActual: number, espacio?: number) => number,
    tablas: { n: number },
  ): number {
    const lh = 5.2;
    const alturaFila = 7;
    const anchoConcepto = 60;
    // Balance y Flujo traen además el "Año 0" (inicio del proyecto).
    const conAnio0 = resumen.filas.every((f) => f.anio0 !== undefined);
    const columnas = conAnio0 ? 6 : 5;
    const anchoAnio = (anchoDisponible - anchoConcepto) / columnas;
    const etiquetasAnios = conAnio0 ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];

    pdf.setFontSize(10.5);
    pdf.setFont('helvetica', 'italic');
    const tituloLines = pdf.splitTextToSize(TITULO_TABLA_RESUMEN[tipo], anchoDisponible);
    const alturaEncabezado = lh + tituloLines.length * lh + 1.5;
    const alturaTabla = alturaFila * (resumen.filas.length + 1);
    const alturaNota = lh + 3;

    let y = checkPageBreak(yInicial, alturaEncabezado + alturaTabla + alturaNota + 6);
    tablas.n += 1;

    pdf.setTextColor(40, 40, 40);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Tabla ${tablas.n}`, margin, y + 3.8);
    y += lh;
    pdf.setFont('helvetica', 'italic');
    pdf.text(tituloLines, margin, y + 3.8);
    y += tituloLines.length * lh + 1.5;

    const xDerecha = margin + anchoDisponible;
    const linea = (yLinea: number, grosor: number) => {
      pdf.setDrawColor(40, 40, 40);
      pdf.setLineWidth(grosor);
      pdf.line(margin, yLinea, xDerecha, yLinea);
    };

    // Encabezado
    linea(y, 0.4);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Concepto', margin + 1, y + 4.8);
    etiquetasAnios.forEach((anio, i) => {
      pdf.text(`Año ${anio}`, margin + anchoConcepto + anchoAnio * (i + 1) - 1, y + 4.8, { align: 'right' });
    });
    y += alturaFila;
    linea(y, 0.2);

    // Filas
    pdf.setFont('helvetica', 'normal');
    for (const fila of resumen.filas) {
      pdf.text(fila.concepto, margin + 1, y + 4.8);
      const valoresFila = conAnio0 ? [fila.anio0 as number, ...fila.valores] : fila.valores;
      valoresFila.forEach((valor, i) => {
        pdf.text(
          this.resumenService.formatearMoneda(valor),
          margin + anchoConcepto + anchoAnio * (i + 1) - 1,
          y + 4.8,
          { align: 'right' },
        );
      });
      y += alturaFila;
    }
    linea(y, 0.4);

    // Nota
    y += 2.5;
    pdf.setFontSize(10.5);
    pdf.setTextColor(60, 60, 60);
    pdf.setFont('helvetica', 'italic');
    pdf.text('Nota.', margin, y + 3.8);
    const anchoNota = pdf.getTextWidth('Nota.');
    pdf.setFont('helvetica', 'normal');
    pdf.text(' Elaboración propia.', margin + anchoNota, y + 3.8);

    return y + lh + 4;
  }

  /** Formato real de una imagen a partir de su data URL (para addImage). */
  private formatoImagen(base64: string): 'PNG' | 'JPEG' | 'WEBP' {
    const match = /^data:image\/(png|jpe?g|webp)/i.exec(base64);
    const tipo = match?.[1]?.toLowerCase();
    if (tipo === 'png') return 'PNG';
    if (tipo === 'webp') return 'WEBP';
    return 'JPEG';
  }

  /** Dimensiones reales (px) de una imagen a partir de su data URL. */
  private obtenerDimensionesImagen(base64: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
      img.onerror = reject;
      img.src = base64;
    });
  }

  private async convertirImagenUrlABase64(url: string): Promise<string> {
    // 'no-store' evita reutilizar una respuesta "opaca" que el navegador
    // haya cacheado al mostrar esta misma URL en un <img> (modo no-cors),
    // que de reusarse hace fallar este fetch (modo cors) con un falso error
    // de CORS aunque el servidor sí envíe los headers correctos.
    const response = await fetch(url, { cache: 'no-store' });
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
