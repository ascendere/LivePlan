import { CLAVE_SECCION_ECONOMICA, SeccionData } from '../../core/services/firebase.service';

/** Minúsculas y sin acentos, para comparar nombres de preguntas. */
export function normalizarTexto(texto: unknown): string {
  return String(texto ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Se reconoce por su clave guardada, no por el título (que el usuario puede cambiar o repetir). */
export function esSeccionEconomica(seccion: SeccionData): boolean {
  return seccion?.clave === CLAVE_SECCION_ECONOMICA;
}

/** Sección creada por el usuario (no es una de las precargadas con instrucciones). */
export function esSeccionPropia(seccion: SeccionData): boolean {
  return !seccion?.clave && !seccion?.instruccion;
}

/**
 * ¿Se muestra el cuadro de texto general de la sección? Solo en secciones propias sin etiquetas (o con texto ya
 * escrito, para no esconderlo). En las precargadas el campo "Descripción General" ya no se usa.
 */
export function usaTextoGeneral(seccion: SeccionData): boolean {
  if ((seccion.subsecciones?.length ?? 0) === 0) return true;
  return esSeccionPropia(seccion) && !!seccion.descripcion?.trim();
}

/**
 * Deja las secciones de un plan guardado en el formato actual (imágenes por pregunta, claves, etiquetas renombradas...).
 * Lo usan la pantalla de Planificación al abrir un plan y el PDF del administrador.
 */
export function normalizarSecciones(seccionesData: any): SeccionData[] {
  const raw = Array.isArray(seccionesData)
    ? seccionesData
    : typeof seccionesData === 'object' && seccionesData !== null
      ? Object.values(seccionesData)
      : [];

  // Planes guardados antes de existir la clave: la sección económica se
  // reconoce UNA vez por su título (y por ser una sección precargada, con
  // instrucción) y desde entonces queda marcada con su clave.
  let claveEconomicaAsignada = raw.some((s: any) => s?.clave === CLAVE_SECCION_ECONOMICA);

  return raw.map((seccion: any) => {
    let clave: string | undefined = seccion.clave;
    if (
      !clave &&
      !claveEconomicaAsignada &&
      seccion.instruccion &&
      normalizarTexto(seccion.titulo) === 'analisis economico y financiero'
    ) {
      clave = CLAVE_SECCION_ECONOMICA;
      claveEconomicaAsignada = true;
    }
    const esEconomica = clave === CLAVE_SECCION_ECONOMICA;

    // Migrar el campo antiguo de una sola imagen al arreglo nuevo
    const imagenes = Array.isArray(seccion.imagenes)
      ? seccion.imagenes
      : seccion.imagenUrl
        ? [{ url: seccion.imagenUrl, nombre: seccion.imagenNombre }]
        : [];

    let subsecciones = Array.isArray(seccion.subsecciones) ? [...seccion.subsecciones] : [];
    // Correcciones de las etiquetas (preguntas) en planes ya guardados, sin tocar lo que el usuario escribió:
    // - "Cuota de resultados" y luego "Cuenta de resultados" pasaron a llamarse "Estado de resultados".
    // - Un error de tipeo de la plantilla: "nivel de de calidad".
    subsecciones = subsecciones.map((sub: any) => {
      let pregunta: string = sub?.pregunta ?? '';
      if (esEconomica && ['cuota de resultados', 'cuenta de resultados'].includes(normalizarTexto(pregunta))) {
        pregunta = 'Estado de resultados';
      }
      pregunta = pregunta.replace('nivel de de calidad', 'nivel de calidad');
      return pregunta === sub?.pregunta ? sub : { ...sub, pregunta };
    });
    // Planes guardados antes de existir la pregunta "Evaluación Financiera":
    // se agrega al final de "Análisis económico y Financiero" para que
    // aparezca su bloque de texto (se guarda con el siguiente cambio).
    if (
      esEconomica &&
      !subsecciones.some((sub: any) => normalizarTexto(sub?.pregunta) === 'evaluacion financiera')
    ) {
      subsecciones.push({ pregunta: 'Evaluación Financiera', descripcion: '' });
    }

    return {
      ...seccion,
      ...(clave ? { clave } : {}),
      subsecciones,
      imagenes,
      fechaCreacion: seccion.fechaCreacion || new Date(),
      fechaActualizacion: seccion.fechaActualizacion || new Date(),
    };
  });
}
