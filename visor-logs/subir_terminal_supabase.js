import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://idgyotujnoavliaqtuck.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ3lvdHVqbm9hdmxpYXF0dWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMjg4ODUsImV4cCI6MjEwNzYwNDg4NX0.ywXODlKIzn68R-5dzvQC-evagSsHa7iNkv82l68dJT8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function subirTerminalArchivos() {
  try {
    const infoVersion = {
      version: '1.0.0',
      nombre: 'TERMINAL ADMIN - LA ESTACIÓN GRILL',
      timestamp: Date.now(),
      fecha: new Date().toLocaleDateString('es-MX'),
      notas: 'Versión oficial para monitoreo de auditoría, crasheos y notificaciones de alta prioridad.',
    };

    const contenidoVersion = Buffer.from(JSON.stringify(infoVersion, null, 2));

    console.log(`🚀 Iniciando subida de Terminal a Supabase Storage v${infoVersion.version}...`);

    // 1. Subir terminal-version.json
    console.log('Subiendo terminal-version.json...');
    const { data: resVersion, error: errVersion } = await supabase.storage
      .from('actualizaciones')
      .upload('terminal-version.json', contenidoVersion, {
        upsert: true,
        contentType: 'application/json',
        cacheControl: '30',
      });

    if (errVersion) {
      throw new Error(`Error al subir terminal-version.json: ${errVersion.message}`);
    }
    console.log('✅ terminal-version.json subido con éxito:', resVersion);

    // 2. Subir terminal-bundle.zip
    const rutaZip = path.resolve('terminal-bundle.zip');
    if (fs.existsSync(rutaZip)) {
      const contenidoZip = fs.readFileSync(rutaZip);
      console.log(`Subiendo terminal-bundle.zip (${(contenidoZip.length / 1024).toFixed(1)} KB)...`);

      const { data: resZip, error: errZip } = await supabase.storage
        .from('actualizaciones')
        .upload('terminal-bundle.zip', contenidoZip, {
          upsert: true,
          contentType: 'application/zip',
          cacheControl: '30',
        });

      if (errZip) {
        throw new Error(`Error al subir terminal-bundle.zip: ${errZip.message}`);
      }
      console.log('✅ terminal-bundle.zip subido con éxito:', resZip);
    }

    console.log('\n🎉 ¡Despliegue OTA de Terminal completado con éxito!');
  } catch (error) {
    console.error('❌ Error durante la subida de Terminal a Supabase:', error);
  }
}

subirTerminalArchivos();
