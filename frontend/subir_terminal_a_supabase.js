import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://idgyotujnoavliaqtuck.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ3lvdHVqbm9hdmxpYXF0dWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMjg4ODUsImV4cCI6MjEwNzYwNDg4NX0.ywXODlKIzn68R-5dzvQC-evagSsHa7iNkv82l68dJT8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function subirTerminal() {
  try {
    const rutaVersion = path.resolve(__dirname, '..', 'visor-logs', 'public', 'terminal-version.json');
    const contenidoVersion = fs.readFileSync(rutaVersion);
    const infoVersion = JSON.parse(contenidoVersion.toString());

    console.log(`🚀 Iniciando subida de Terminal OTA v${infoVersion.version}...`);

    // 1. Subir terminal-version.json
    console.log('Subiendo terminal-version.json...');
    const { data: resVersion, error: errVersion } = await supabase.storage
      .from('actualizaciones')
      .upload('terminal-version.json', contenidoVersion, {
        upsert: true,
        contentType: 'application/json',
        cacheControl: '15',
      });

    if (errVersion) {
      throw new Error(`Error al subir terminal-version.json: ${errVersion.message}`);
    }
    console.log('✅ terminal-version.json subido con éxito:', resVersion);

    // 2. Subir terminal-bundle.zip
    const rutaZip = path.resolve(__dirname, '..', 'terminal-bundle.zip');
    const contenidoZip = fs.readFileSync(rutaZip);
    console.log(`Subiendo terminal-bundle.zip (${(contenidoZip.length / 1024).toFixed(1)} KB)...`);

    const { data: resZip, error: errZip } = await supabase.storage
      .from('actualizaciones')
      .upload('terminal-bundle.zip', contenidoZip, {
        upsert: true,
        contentType: 'application/zip',
        cacheControl: '15',
      });

    if (errZip) {
      throw new Error(`Error al subir terminal-bundle.zip: ${errZip.message}`);
    }
    console.log('✅ terminal-bundle.zip subido con éxito:', resZip);

    console.log('\n🎉 ¡Despliegue OTA de Terminal completado con éxito!');
  } catch (error) {
    console.error('❌ Error durante la subida de Terminal a Supabase:', error);
    process.exit(1);
  }
}

subirTerminal();
