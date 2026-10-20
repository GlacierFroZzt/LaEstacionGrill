/**
 * Utilidad de compresión y redimensionado de imágenes en el cliente mediante Canvas HTML5.
 * Optimizado para rendimiento móvil y almacenamiento en local/IndexedDB sin exceder límites de cuota.
 */

export interface OpcionesCompresionImagen {
  readonly maxAncho?: number;
  readonly maxAlto?: number;
  readonly calidad?: number; // 0.1 a 1.0
  readonly formato?: 'image/webp' | 'image/jpeg';
}

const OPCIONES_POR_DEFECTO: Required<OpcionesCompresionImagen> = {
  maxAncho: 640,
  maxAlto: 640,
  calidad: 0.82,
  formato: 'image/webp',
};

/**
 * Procesa un archivo de imagen, redimensionándolo proporcionalmente y comprimiéndolo a DataURL.
 * @param archivo Archivo de imagen seleccionado por el usuario.
 * @param opciones Configuración de dimensiones, calidad y formato.
 * @returns Promesa que resuelve al DataURL en formato WebP o JPEG.
 */
export async function comprimirImagenADataUrl(
  archivo: File,
  opciones: OpcionesCompresionImagen = {}
): Promise<string> {
  const { maxAncho, maxAlto, calidad, formato } = {
    ...OPCIONES_POR_DEFECTO,
    ...opciones,
  };

  if (!archivo.type.startsWith('image/')) {
    throw new Error(`El archivo proporcionado no es una imagen válida (${archivo.type}).`);
  }

  return new Promise((resolve, reject) => {
    const lector = new FileReader();

    lector.onerror = () => {
      const err = new Error('No se pudo leer el archivo de imagen desde el dispositivo.');
      console.error('[compresorImagenes.comprimirImagenADataUrl] Error al leer archivo:', err);
      reject(err);
    };

    lector.onload = () => {
      const img = new Image();

      img.onerror = () => {
        const err = new Error('No se pudo decodificar el contenido de la imagen.');
        console.error('[compresorImagenes.comprimirImagenADataUrl] Error decodificando imagen:', err);
        reject(err);
      };

      img.onload = () => {
        try {
          let ancho = img.naturalWidth || img.width;
          let alto = img.naturalHeight || img.height;

          // Escalado proporcional si excede los límites máximos
          if (ancho > maxAncho || alto > maxAlto) {
            const proporcion = Math.min(maxAncho / ancho, maxAlto / alto);
            ancho = Math.round(ancho * proporcion);
            alto = Math.round(alto * proporcion);
          }

          const canvas = document.createElement('canvas');
          canvas.width = ancho;
          canvas.height = alto;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('No se pudo inicializar el contexto 2D de Canvas para compresión.');
          }

          // Suavizado de imagen de alta calidad
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Dibujar sobre fondo neutro por si la imagen tiene transparencias y se usa JPEG
          if (formato === 'image/jpeg') {
            ctx.fillStyle = '#1c1917'; // Fondo oscuro rústico
            ctx.fillRect(0, 0, ancho, alto);
          }

          ctx.drawImage(img, 0, 0, ancho, alto);

          // Intentar exportar a WebP; si el navegador no lo soporta, fallback transparente
          let dataUrl = canvas.toDataURL(formato, calidad);
          if (formato === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', calidad);
          }

          resolve(dataUrl);
        } catch (error: unknown) {
          console.error('[compresorImagenes.comprimirImagenADataUrl] Excepción en compresión:', error);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };

      img.src = lector.result as string;
    };

    lector.readAsDataURL(archivo);
  });
}
