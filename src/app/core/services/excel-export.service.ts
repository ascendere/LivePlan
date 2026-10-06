import { Injectable } from '@angular/core';

/** Formato numérico de una celda. */
export type FormatoCelda = 'entero' | 'decimal' | 'moneda' | 'porcentaje' | 'porcentaje2';

export interface CeldaExcel {
  /** Texto, número (se guarda como número real) o vacío. */
  v: string | number | null;
  negrita?: boolean;
  /** Encabezado de tabla: negrita, texto blanco sobre azul institucional, centrado. */
  encabezado?: boolean;
  formato?: FormatoCelda;
  alinear?: 'left' | 'center' | 'right';
}

export interface HojaExcel {
  /** Nombre de la pestaña (se limpia solo: máx. 31 caracteres, sin símbolos prohibidos). */
  nombre: string;
  filas: (CeldaExcel | null)[][];
  /** Celdas combinadas (índices base 0, ambos extremos incluidos). */
  combinadas?: { fila0: number; col0: number; fila1: number; col1: number }[];
  /** Filas / columnas que se quedan fijas al desplazarse. */
  congelarFilas?: number;
  congelarColumnas?: number;
}

/**
 * Exportación a Excel (.xlsx) sin dependencias externas: arma el libro con
 * el formato Office Open XML y lo empaqueta en un .zip sin compresión.
 *
 * Dos formas de usarlo:
 *  - `hojasDesdeDom(raiz)`: toma las tablas que el usuario está viendo en
 *    pantalla (con sus encabezados combinados, valores de los campos de
 *    texto, números reales, etc.), una hoja por tabla.
 *  - Armar las `HojaExcel` a mano cuando los datos no están todos en pantalla.
 */
@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  // ================================================================ DOM → hojas

  /** Convierte cada <table> visible dentro de `raiz` en una hoja, nombrada con el título que la precede. */
  hojasDesdeDom(raiz: Element | null): HojaExcel[] {
    if (!raiz) return [];
    const hojas: HojaExcel[] = [];
    let titulo = '';
    let n = 0;

    const nodos = Array.from(raiz.querySelectorAll('h1, h2, h3, h4, table'));
    for (const nodo of nodos) {
      if (nodo.tagName !== 'TABLE') {
        const texto = this.textoVisible(nodo).trim();
        if (texto) titulo = texto;
        continue;
      }
      const hoja = this.hojaDesdeTabla(nodo as HTMLTableElement, titulo || `Tabla ${n + 1}`);
      if (hoja) {
        n += 1;
        hojas.push(hoja);
      }
    }
    return hojas;
  }

  private hojaDesdeTabla(tabla: HTMLTableElement, titulo: string): HojaExcel | null {
    if (tabla.offsetParent === null && getComputedStyle(tabla).position !== 'fixed') return null; // oculta
    const filasDom = Array.from(tabla.rows);
    if (filasDom.length === 0) return null;

    const grilla: (CeldaExcel | null)[][] = [];
    const ocupada: boolean[][] = [];
    const combinadas: NonNullable<HojaExcel['combinadas']> = [];

    filasDom.forEach((tr, r) => {
      grilla[r] ??= [];
      ocupada[r] ??= [];
      let c = 0;
      for (const celda of Array.from(tr.cells)) {
        while (ocupada[r][c]) c++;
        const rowspan = Math.max(1, celda.rowSpan || 1);
        const colspan = Math.max(1, celda.colSpan || 1);

        const esEncabezado = celda.tagName === 'TH' || tr.parentElement?.tagName === 'THEAD';
        const texto = this.textoDeCelda(celda);
        const excel = this.celdaDesdeTexto(texto);
        excel.encabezado = esEncabezado || undefined;
        if (!esEncabezado && Number(getComputedStyle(celda).fontWeight) >= 600) excel.negrita = true;
        if (typeof excel.v !== 'number' && !esEncabezado && getComputedStyle(celda).textAlign === 'center') {
          excel.alinear = 'center';
        }

        grilla[r][c] = excel;
        for (let dr = 0; dr < rowspan; dr++) {
          for (let dc = 0; dc < colspan; dc++) {
            ocupada[r + dr] ??= [];
            ocupada[r + dr][c + dc] = true;
            if (dr > 0 || dc > 0) {
              grilla[r + dr] ??= [];
              grilla[r + dr][c + dc] = { v: null, encabezado: esEncabezado || undefined };
            }
          }
        }
        if (rowspan > 1 || colspan > 1) {
          combinadas.push({ fila0: r, col0: c, fila1: r + rowspan - 1, col1: c + colspan - 1 });
        }
        c += colspan;
      }
    });

    // Columnas totalmente vacías (p. ej. la de botones "eliminar") no aportan nada.
    const anchoMax = Math.max(...grilla.map((f) => f.length));
    const vacia = (col: number) =>
      grilla.every((f) => {
        const x = f[col];
        return !x || x.v === null || x.v === '';
      });
    const quitar = new Set<number>();
    for (let col = 0; col < anchoMax; col++) if (vacia(col)) quitar.add(col);
    const mapa = new Map<number, number>();
    let nuevo = 0;
    for (let col = 0; col < anchoMax; col++) if (!quitar.has(col)) mapa.set(col, nuevo++);

    const filas = grilla.map((f) => {
      const salida: (CeldaExcel | null)[] = [];
      for (let col = 0; col < anchoMax; col++) {
        if (quitar.has(col)) continue;
        salida[mapa.get(col)!] = f[col] ?? null;
      }
      return salida;
    });
    const merges = combinadas
      .map((m) => {
        const cols = Array.from({ length: m.col1 - m.col0 + 1 }, (_, i) => m.col0 + i).filter((x) => mapa.has(x));
        if (cols.length === 0) return null;
        return { fila0: m.fila0, fila1: m.fila1, col0: mapa.get(cols[0])!, col1: mapa.get(cols[cols.length - 1])! };
      })
      .filter((m): m is NonNullable<typeof m> => !!m && (m.fila1 > m.fila0 || m.col1 > m.col0));

    // Encabezados al inicio de la tabla (thead) → se quedan fijos.
    const filasEncabezado = Array.from(tabla.tHead?.rows ?? []).length;
    const primeraColumnaPegajosa = !!tabla.querySelector('.sticky-col');

    return {
      nombre: titulo,
      filas,
      combinadas: merges,
      congelarFilas: filasEncabezado || undefined,
      congelarColumnas: primeraColumnaPegajosa ? 1 : undefined,
    };
  }

  /** Texto "tal como se ve" dentro de una celda: valores de campos, sin botones ni íconos. */
  private textoDeCelda(celda: Element): string {
    return this.textoVisible(celda).replace(/\s+/g, ' ').trim();
  }

  private textoVisible(nodo: Node): string {
    if (nodo.nodeType === Node.TEXT_NODE) return nodo.textContent ?? '';
    if (nodo.nodeType !== Node.ELEMENT_NODE) return '';
    const el = nodo as HTMLElement;
    const etiqueta = el.tagName;
    if (['BUTTON', 'SVG', 'STYLE', 'SCRIPT', 'IMG', 'CANVAS'].includes(etiqueta.toUpperCase())) return '';
    if (etiqueta === 'INPUT') return (el as HTMLInputElement).value ?? '';
    if (etiqueta === 'TEXTAREA') return (el as HTMLTextAreaElement).value ?? '';
    if (etiqueta === 'SELECT') {
      const s = el as HTMLSelectElement;
      return s.options[s.selectedIndex]?.text ?? '';
    }
    if (el.classList.contains('no-exportar')) return '';
    if (etiqueta === 'BR') return ' ';
    return Array.from(el.childNodes).map((h) => this.textoVisible(h)).join('');
  }

  /** "$1,234.56", "-$12", "5%", "1,200" → número real con su formato; lo demás queda como texto. */
  private celdaDesdeTexto(texto: string): CeldaExcel {
    if (texto === '') return { v: null };
    const limpio = texto.replace(/\s/g, '');
    const m = /^(-?)(\$?)(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(%?)$/.exec(limpio);
    if (!m) return { v: texto };

    const negativo = m[1] === '-' || m[3] === '-';
    const entero = m[4].replace(/,/g, '');
    const decimales = m[5] ? m[5].length - 1 : 0;
    let valor = Number(entero + (m[5] ?? ''));
    if (negativo) valor = -valor;

    if (m[6] === '%') {
      return { v: valor / 100, formato: decimales > 0 ? 'porcentaje2' : 'porcentaje' };
    }
    if (m[2] === '$') return { v: valor, formato: 'moneda' };
    if (decimales > 0) return { v: valor, formato: 'decimal' };
    if (m[4].includes(',')) return { v: valor, formato: 'entero' };
    return { v: valor };
  }

  // ================================================================ Descarga

  descargar(nombreArchivo: string, hojas: HojaExcel[]): void {
    const bytes = this.crearXlsx(hojas);
    const blob = new Blob([bytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ================================================================ XLSX (Open XML)

  crearXlsx(hojas: HojaExcel[]): Uint8Array {
    const nombres = this.nombresUnicos(hojas.map((h) => h.nombre));
    const estilos = new Estilos();
    const xmlHojas = hojas.map((h) => this.xmlHoja(h, estilos));

    const archivos: { ruta: string; contenido: string }[] = [
      {
        ruta: '[Content_Types].xml',
        contenido:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          hojas
            .map(
              (_, i) =>
                `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
            )
            .join('') +
          '</Types>',
      },
      {
        ruta: '_rels/.rels',
        contenido:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>',
      },
      {
        ruta: 'xl/workbook.xml',
        contenido:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
          nombres.map((n, i) => `<sheet name="${this.xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
          '</sheets></workbook>',
      },
      {
        ruta: 'xl/_rels/workbook.xml.rels',
        contenido:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          hojas
            .map(
              (_, i) =>
                `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
            )
            .join('') +
          `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          '</Relationships>',
      },
      { ruta: 'xl/styles.xml', contenido: estilos.xml() },
      ...xmlHojas.map((contenido, i) => ({ ruta: `xl/worksheets/sheet${i + 1}.xml`, contenido })),
    ];

    return this.empaquetarZip(archivos);
  }

  private xmlHoja(hoja: HojaExcel, estilos: Estilos): string {
    const filas = hoja.filas;
    const anchoMax = Math.max(1, ...filas.map((f) => f.length));

    // Ancho de columna según el texto más largo (con tope).
    const anchos = new Array(anchoMax).fill(8);
    filas.forEach((f) =>
      f.forEach((c, i) => {
        if (!c || c.v === null || c.v === '') return;
        const largo = typeof c.v === 'number' ? this.largoNumero(c) : String(c.v).length;
        anchos[i] = Math.max(anchos[i], Math.min(largo + 2, 60));
      }),
    );
    // Los títulos combinados no deben ensanchar la columna donde empiezan.
    for (const m of hoja.combinadas ?? []) {
      if (m.col1 > m.col0) {
        const c = filas[m.fila0]?.[m.col0];
        if (c && typeof c.v === 'string') {
          anchos[m.col0] = Math.max(8, Math.min(anchos[m.col0], 14));
          // se recalcula con otras filas de esa columna
          let max = 8;
          filas.forEach((f, r) => {
            const x = f[m.col0];
            if (r !== m.fila0 && x && x.v !== null && x.v !== '') {
              max = Math.max(max, Math.min((typeof x.v === 'number' ? this.largoNumero(x) : String(x.v).length) + 2, 60));
            }
          });
          anchos[m.col0] = max;
        }
      }
    }

    let xml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

    const fijarF = hoja.congelarFilas ?? 0;
    const fijarC = hoja.congelarColumnas ?? 0;
    if (fijarF > 0 || fijarC > 0) {
      const panel = fijarF > 0 && fijarC > 0 ? 'bottomRight' : fijarF > 0 ? 'bottomLeft' : 'topRight';
      xml +=
        '<sheetViews><sheetView workbookViewId="0"><pane' +
        (fijarC > 0 ? ` xSplit="${fijarC}"` : '') +
        (fijarF > 0 ? ` ySplit="${fijarF}"` : '') +
        ` topLeftCell="${this.referencia(fijarF, fijarC)}" activePane="${panel}" state="frozen"/></sheetView></sheetViews>`;
    }

    xml += '<cols>' + anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';
    xml += '<sheetData>';
    filas.forEach((fila, r) => {
      xml += `<row r="${r + 1}">`;
      fila.forEach((celda, c) => {
        if (!celda) return;
        const s = estilos.indice(celda);
        const ref = this.referencia(r, c);
        if (celda.v === null || celda.v === '') {
          if (s > 0) xml += `<c r="${ref}" s="${s}"/>`;
        } else if (typeof celda.v === 'number' && Number.isFinite(celda.v)) {
          xml += `<c r="${ref}" s="${s}"><v>${celda.v}</v></c>`;
        } else {
          xml += `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${this.xml(String(celda.v))}</t></is></c>`;
        }
      });
      xml += '</row>';
    });
    xml += '</sheetData>';

    if (hoja.combinadas && hoja.combinadas.length > 0) {
      xml +=
        `<mergeCells count="${hoja.combinadas.length}">` +
        hoja.combinadas
          .map((m) => `<mergeCell ref="${this.referencia(m.fila0, m.col0)}:${this.referencia(m.fila1, m.col1)}"/>`)
          .join('') +
        '</mergeCells>';
    }
    return xml + '</worksheet>';
  }

  private largoNumero(c: CeldaExcel): number {
    const v = c.v as number;
    const base = c.formato === 'porcentaje' || c.formato === 'porcentaje2' ? v * 100 : v;
    const decimales = c.formato === 'decimal' || c.formato === 'moneda' || c.formato === 'porcentaje2' ? 2 : 0;
    return base.toLocaleString('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: Math.max(decimales, 2) }).length + (c.formato === 'moneda' ? 1 : 0);
  }

  /** Índices base 0 → "B3". */
  private referencia(fila: number, col: number): string {
    let letras = '';
    let n = col + 1;
    while (n > 0) {
      const resto = (n - 1) % 26;
      letras = String.fromCharCode(65 + resto) + letras;
      n = Math.floor((n - 1) / 26);
    }
    return `${letras}${fila + 1}`;
  }

  private xml(texto: string): string {
    return texto
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Nombres de pestaña válidos (≤31, sin []:*?/\) y sin repetirse. */
  private nombresUnicos(nombres: string[]): string[] {
    const usados = new Set<string>();
    return nombres.map((original, i) => {
      let base = (original || `Hoja ${i + 1}`).replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || `Hoja ${i + 1}`;
      let nombre = base;
      let k = 2;
      while (usados.has(nombre.toLowerCase())) {
        const sufijo = ` (${k++})`;
        nombre = base.slice(0, 31 - sufijo.length) + sufijo;
      }
      usados.add(nombre.toLowerCase());
      return nombre;
    });
  }

  // ================================================================ ZIP (sin compresión)

  private empaquetarZip(archivos: { ruta: string; contenido: string }[]): Uint8Array {
    const codificador = new TextEncoder();
    const partes: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let desplazamiento = 0;

    const ahora = new Date();
    const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
    const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();

    for (const a of archivos) {
      const nombre = codificador.encode(a.ruta);
      const datos = codificador.encode(a.contenido);
      const crc = this.crc32(datos);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true); // versión mínima
      local.setUint16(6, 0x0800, true); // nombres en UTF-8
      local.setUint16(8, 0, true); // sin compresión
      local.setUint16(10, hora, true);
      local.setUint16(12, fecha, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, datos.length, true);
      local.setUint32(22, datos.length, true);
      local.setUint16(26, nombre.length, true);
      local.setUint16(28, 0, true);
      partes.push(new Uint8Array(local.buffer), nombre, datos);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, hora, true);
      cd.setUint16(14, fecha, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, datos.length, true);
      cd.setUint32(24, datos.length, true);
      cd.setUint16(28, nombre.length, true);
      cd.setUint32(42, desplazamiento, true);
      central.push(new Uint8Array(cd.buffer), nombre);

      desplazamiento += 30 + nombre.length + datos.length;
    }

    const tamanoCentral = central.reduce((s, p) => s + p.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true);
    fin.setUint16(8, archivos.length, true);
    fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, tamanoCentral, true);
    fin.setUint32(16, desplazamiento, true);

    const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
    const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
    let pos = 0;
    for (const p of todo) {
      salida.set(p, pos);
      pos += p.length;
    }
    return salida;
  }

  private static tablaCrc: Uint32Array | null = null;

  private crc32(datos: Uint8Array): number {
    if (!ExcelExportService.tablaCrc) {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
      }
      ExcelExportService.tablaCrc = t;
    }
    const t = ExcelExportService.tablaCrc;
    let crc = 0xffffffff;
    for (let i = 0; i < datos.length; i++) crc = t[(crc ^ datos[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
}

/** Catálogo de estilos del libro: cada combinación de formato usada se registra una sola vez. */
class Estilos {
  private readonly combinaciones: string[] = ['||normal|']; // índice 0 = estilo por defecto
  private readonly detalle = new Map<string, number>([['||normal|', 0]]);

  indice(c: CeldaExcel): number {
    const clave = `${c.encabezado ? 'enc' : ''}|${c.negrita ? 'neg' : ''}|${c.formato ?? 'normal'}|${c.alinear ?? ''}`;
    let i = this.detalle.get(clave);
    if (i === undefined) {
      i = this.combinaciones.length;
      this.combinaciones.push(clave);
      this.detalle.set(clave, i);
    }
    return i;
  }

  xml(): string {
    // numFmt personalizados (id ≥ 164); 'entero' usa el incorporado 3 (#,##0).
    const idFormato: Record<string, number> = { entero: 3, decimal: 4, moneda: 164, porcentaje: 9, porcentaje2: 10 };
    const xfs = this.combinaciones
      .map((clave) => {
        const [enc, neg, formato, alinear] = clave.split('|');
        const fuente = enc ? 2 : neg ? 1 : 0;
        const relleno = enc ? 2 : 0;
        const numFmt = idFormato[formato] ?? 0;
        const alineacion = enc ? 'center' : alinear;
        return (
          `<xf numFmtId="${numFmt}" fontId="${fuente}" fillId="${relleno}" borderId="0" xfId="0"` +
          (numFmt ? ' applyNumberFormat="1"' : '') +
          (fuente ? ' applyFont="1"' : '') +
          (relleno ? ' applyFill="1"' : '') +
          (alineacion ? ` applyAlignment="1"><alignment horizontal="${alineacion}" vertical="center"${enc ? ' wrapText="1"' : ''}/></xf>` : '/>')
        );
      })
      .join('');

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts>' +
      '<fonts count="3">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF004271"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.combinaciones.length}">${xfs}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    );
  }
}
