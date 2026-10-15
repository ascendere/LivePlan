/** Lado más largo (px) al que se reducen los logos antes de guardarlos: sobra para el PDF y pesan poco. */
export const LADO_MAXIMO_LOGO = 800;

export interface MedidaImagen {
  ancho: number;
  alto: number;
}

/** Carga una imagen (URL o data URL) para conocer su tamaño natural en píxeles. */
export function medirImagen(src: string): Promise<MedidaImagen> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ ancho: img.naturalWidth, alto: img.naturalHeight });
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = src;
  });
}

/**
 * Reduce una imagen para que su lado más largo no pase de `ladoMaximo` px (nunca la agranda). Conserva la
 * transparencia de los PNG y la calidad de los JPEG; el resto de formatos pasa a PNG.
 */
export async function reducirImagen(archivo: File, ladoMaximo = LADO_MAXIMO_LOGO): Promise<File> {
  const url = URL.createObjectURL(archivo);
  try {
    const { ancho, alto } = await medirImagen(url);
    const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto));
    const esJpeg = archivo.type === 'image/jpeg';
    // Ya es pequeña y de un formato que jsPDF lee sin problema: se deja tal cual.
    if (escala === 1 && (esJpeg || archivo.type === 'image/png')) return archivo;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(ancho * escala));
    canvas.height = Math.max(1, Math.round(alto * escala));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen.');
    if (esJpeg) {
      ctx.fillStyle = '#ffffff'; // JPEG no tiene transparencia
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const img = new Image();
    await new Promise<void>((ok, mal) => {
      img.onload = () => ok();
      img.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const tipo = esJpeg ? 'image/jpeg' : 'image/png';
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, 0.92));
    if (!blob) throw new Error('No se pudo procesar la imagen.');
    const extension = esJpeg ? 'jpg' : 'png';
    const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.' + extension;
    return new File([blob], nombre, { type: tipo });
  } finally {
    URL.revokeObjectURL(url);
  }
}
