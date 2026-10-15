import jsPDF from 'jspdf';
import { COLOR_GRIS_AZUL, COLOR_PRIMARIO, COLOR_PRIMARIO_OSCURO } from './pdf-estilos';

/** Logo ya cargado para la portada: la imagen como data URL y su tamaño natural en píxeles. */
export interface LogoPortada {
  dataUrl: string;
  ancho: number;
  alto: number;
}

export interface DatosPortada {
  titulo: string;
  /** Texto opcional bajo "Plan de Negocio" (p. ej. "2026-2027"). Vacío = no se dibuja. */
  periodo?: string;
  /** Logo opcional bajo ese texto. */
  logo?: LogoPortada | null;
}

/** Caja máxima del logo en la portada (mm): ancho y alto. Se ajusta dentro sin deformarlo. */
export const LOGO_MAX_ANCHO_MM = 70;
export const LOGO_MAX_ALTO_MM = 38;
/** Espacio libre que se deja entre el logo y la fecha de generación del pie de la portada. */
const MARGEN_SOBRE_FECHA_MM = 18;

/**
 * Tamaño con el que se dibuja una imagen de `ancho`×`alto` dentro de una caja de `maxAncho`×`maxAlto`:
 * conserva la proporción y no la agranda más allá de su tamaño natural a 96 ppp (así un logo pequeño
 * no se ve borroso). Devuelve milímetros.
 */
export function ajustarEnCaja(
  ancho: number,
  alto: number,
  maxAncho: number,
  maxAlto: number,
): { ancho: number; alto: number } {
  if (!(ancho > 0) || !(alto > 0)) return { ancho: 0, alto: 0 };
  const PX_A_MM = 25.4 / 96;
  const escala = Math.min(maxAncho / ancho, maxAlto / alto, PX_A_MM);
  return { ancho: ancho * escala, alto: alto * escala };
}

/** Formato que jsPDF necesita según el tipo de la data URL (null = no soportado). */
export function formatoDeDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' | null {
  const mime = /^data:(image\/[a-z+.-]+);/i.exec(dataUrl)?.[1]?.toLowerCase();
  switch (mime) {
    case 'image/png':
      return 'PNG';
    case 'image/jpeg':
    case 'image/jpg':
      return 'JPEG';
    case 'image/webp':
      return 'WEBP';
    default:
      return null;
  }
}

/**
 * Portada institucional: banda superior con el nombre de la universidad, título del plan centrado, y debajo
 * "Plan de Negocio", el texto opcional (p. ej. el periodo) y el logo opcional; la fecha de generación va abajo.
 * Página 1, separada del contenido (que arranca en la página 2 con su propio encabezado/pie).
 */
export function dibujarPortada(pdf: jsPDF, pageWidth: number, pageHeight: number, datos: DatosPortada): void {
  pdf.setFillColor(...COLOR_PRIMARIO);
  pdf.rect(0, 0, pageWidth, 55, 'F');
  pdf.setFillColor(...COLOR_PRIMARIO_OSCURO);
  pdf.rect(0, 50, pageWidth, 5, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('UNIVERSIDAD TÉCNICA PARTICULAR DE LOJA', pageWidth / 2, 24, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text('Colaborador Interactivo de Planes de Negocio', pageWidth / 2, 34, { align: 'center' });

  pdf.setTextColor(...COLOR_PRIMARIO_OSCURO);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  const tituloLines = pdf.splitTextToSize(datos.titulo || 'Plan de Negocio', pageWidth - 50);
  pdf.text(tituloLines, pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });

  pdf.setDrawColor(...COLOR_GRIS_AZUL);
  pdf.setLineWidth(0.5);
  pdf.line(pageWidth / 2 - 30, pageHeight / 2 + 5, pageWidth / 2 + 30, pageHeight / 2 + 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(90, 90, 90);
  pdf.text('Plan de Negocio', pageWidth / 2, pageHeight / 2 + 15, { align: 'center' });

  // Texto opcional bajo "Plan de Negocio" (p. ej. "2026-2027").
  let siguienteY = pageHeight / 2 + 15;
  const periodo = (datos.periodo ?? '').trim();
  if (periodo) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...COLOR_PRIMARIO);
    const lineas: string[] = pdf.splitTextToSize(periodo, pageWidth - 60);
    pdf.text(lineas, pageWidth / 2, pageHeight / 2 + 25, { align: 'center' });
    siguienteY = pageHeight / 2 + 25 + (lineas.length - 1) * 5;
  }

  // Logo opcional, centrado debajo y ajustado a una caja para no romper la estética.
  const logo = datos.logo;
  const formato = logo ? formatoDeDataUrl(logo.dataUrl) : null;
  if (logo && formato) {
    const arriba = siguienteY + 12;
    const maxAlto = Math.min(LOGO_MAX_ALTO_MM, pageHeight - MARGEN_SOBRE_FECHA_MM - 20 - arriba);
    const t = ajustarEnCaja(logo.ancho, logo.alto, LOGO_MAX_ANCHO_MM, maxAlto);
    if (t.ancho > 0 && t.alto > 0) {
      pdf.addImage(logo.dataUrl, formato, (pageWidth - t.ancho) / 2, arriba + (maxAlto - t.alto) / 2, t.ancho, t.alto);
    }
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(90, 90, 90);
  const fecha = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
  pdf.setFontSize(10);
  pdf.text(`Generado el ${fecha}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
}
