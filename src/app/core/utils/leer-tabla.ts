import { unzipSync } from 'fflate';

/** Tamaño máximo del archivo que se acepta (la carga masiva son unas cuantas columnas de texto). */
export const TAMANO_MAXIMO_ARCHIVO = 5 * 1024 * 1024;
const TAMANO_MAXIMO_HOJA_DESCOMPRIMIDA = 50 * 1024 * 1024;

const NS_RELACIONES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * Lee la primera hoja de un .xlsx o un .csv y devuelve las filas como texto (celdas vacías = '').
 * No interpreta nada: números, fechas y textos llegan tal como están guardados; el backend limpia y valida.
 */
export async function leerArchivoTabla(archivo: File): Promise<string[][]> {
  if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
    throw new Error('El archivo es demasiado grande (máximo 5 MB).');
  }
  const nombre = archivo.name.toLowerCase();
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) return leerCsv(new TextDecoder('utf-8').decode(bytes));
  if (nombre.endsWith('.xlsx')) return leerXlsx(bytes);
  throw new Error('Formato no soportado: sube un archivo .xlsx o .csv.');
}

// ------------------------------------------------------------------ CSV

export function leerCsv(texto: string): string[][] {
  texto = texto.replace(/^﻿/, '');
  // El separador lo decide la primera línea: Excel en español guarda con ";".
  const primera = texto.split(/\r?\n/, 1)[0] ?? '';
  const cuenta = (c: string) => primera.split(c).length - 1;
  const separador = [';', '\t', ','].reduce((mejor, c) => (cuenta(c) > cuenta(mejor) ? c : mejor), ',');

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        celda += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === separador) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else {
      celda += c;
    }
  }
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

// ------------------------------------------------------------------ XLSX

function leerXlsx(bytes: Uint8Array): string[][] {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(bytes, {
      filter: (f) =>
        f.originalSize <= TAMANO_MAXIMO_HOJA_DESCOMPRIMIDA &&
        (f.name === 'xl/workbook.xml' ||
          f.name === 'xl/_rels/workbook.xml.rels' ||
          f.name === 'xl/sharedStrings.xml' ||
          /^xl\/worksheets\/[^/]+\.xml$/.test(f.name)),
    });
  } catch {
    throw new Error('No se pudo leer el archivo: no es un .xlsx válido.');
  }
  const texto = (ruta: string) => (zip[ruta] ? new TextDecoder('utf-8').decode(zip[ruta]) : null);
  const xml = (ruta: string) => {
    const t = texto(ruta);
    return t ? new DOMParser().parseFromString(t, 'application/xml') : null;
  };

  const libro = xml('xl/workbook.xml');
  const rels = xml('xl/_rels/workbook.xml.rels');
  const primeraHoja = libro?.getElementsByTagName('sheet')[0];
  const idRel = primeraHoja?.getAttributeNS(NS_RELACIONES, 'id') ?? primeraHoja?.getAttribute('r:id');
  let rutaHoja = 'xl/worksheets/sheet1.xml';
  if (rels && idRel) {
    for (const r of Array.from(rels.getElementsByTagName('Relationship'))) {
      if (r.getAttribute('Id') === idRel) {
        const destino = r.getAttribute('Target') ?? '';
        rutaHoja = destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`;
      }
    }
  }
  const hoja = xml(rutaHoja);
  if (!hoja) throw new Error('El archivo no tiene hojas con datos.');

  // textos compartidos (las celdas de texto apuntan a esta lista)
  const compartidos: string[] = [];
  const doc = xml('xl/sharedStrings.xml');
  if (doc) {
    for (const si of Array.from(doc.getElementsByTagName('si'))) {
      compartidos.push(textoDe(si));
    }
  }

  const filas: string[][] = [];
  for (const fila of Array.from(hoja.getElementsByTagName('row'))) {
    const numeroFila = Number(fila.getAttribute('r')) || filas.length + 1;
    const celdas: string[] = [];
    for (const c of Array.from(fila.getElementsByTagName('c'))) {
      const col = columnaDe(c.getAttribute('r') ?? '');
      if (col < 0) continue;
      const tipo = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      let valor: string;
      if (tipo === 's') valor = compartidos[Number(v)] ?? '';
      else if (tipo === 'inlineStr') valor = textoDe(c.getElementsByTagName('is')[0]);
      else if (tipo === 'b') valor = v === '1' ? 'VERDADERO' : 'FALSO';
      else valor = v;
      while (celdas.length <= col) celdas.push('');
      celdas[col] = valor;
    }
    while (filas.length < numeroFila - 1) filas.push([]);
    filas[numeroFila - 1] = celdas;
  }
  return filas;
}

/** Texto de un <si> o <is>: une los <t> (texto con formato viene en varios) y salta la fonética (rPh). */
function textoDe(nodo: Element | undefined): string {
  if (!nodo) return '';
  let t = '';
  const recorrer = (n: Element) => {
    for (const h of Array.from(n.children)) {
      if (h.tagName === 'rPh') continue;
      if (h.tagName === 't') t += h.textContent ?? '';
      else recorrer(h);
    }
  };
  recorrer(nodo);
  return t;
}

/** "B3" → 1 (índice de columna base 0); -1 si no es una referencia válida. */
function columnaDe(referencia: string): number {
  const m = /^([A-Z]+)\d+$/.exec(referencia);
  if (!m) return -1;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
