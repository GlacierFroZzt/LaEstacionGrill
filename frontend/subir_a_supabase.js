import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://idgyotujnoavliaqtuck.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ3lvdHVqbm9hdmxpYXF0dWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMjg4ODUsImV4cCI6MjEwNzYwNDg4NX0.ywXODlKIzn68R-5dzvQC-evagSsHa7iNkv82l68dJT8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function subirArchivos() {
  try {
    const rutaVersion = path.resolve('public', 'version.json');
    const contenidoVersion = fs.readFileSync(rutaVersion);
    const infoVersion = JSON.parse(contenidoVersion.toString());

    console.log(`🚀 Iniciando subida a Supabase Storage v${infoVersion.version}...`);

    // 1. Subir version.json
    console.log('Subiendo version.json...');
    const { data: resVersion, error: errVersion } = await supabase.storage
      .from('actualizaciones')
      .upload('version.json', contenidoVersion, {
        upsert: true,
        contentType: 'application/json',
        cacheControl: '30',
      });

    if (errVersion) {
      throw new Error(`Error al subir version.json: ${errVersion.message}`);
    }
    console.log('✅ version.json subido con éxito:', resVersion);

    // 2. Subir web-bundle.zip
    const rutaZip = path.resolve('..', 'servidor', 'web-bundle.zip');
    const contenidoZip = fs.readFileSync(rutaZip);
    console.log(`Subiendo web-bundle.zip (${(contenidoZip.length / 1024).toFixed(1)} KB)...`);

    const { data: resZip, error: errZip } = await supabase.storage
      .from('actualizaciones')
      .upload('web-bundle.zip', contenidoZip, {
        upsert: true,
        contentType: 'application/zip',
        cacheControl: '30',
      });

    if (errZip) {
      throw new Error(`Error al subir web-bundle.zip: ${errZip.message}`);
    }
    console.log('✅ web-bundle.zip subido con éxito:', resZip);

    // 3. Confirmar lectura pública
    const urlPublicaVersion = `${SUPABASE_URL}/storage/v1/object/public/actualizaciones/version.json?t=${Date.now()}`;
    const resp = await fetch(urlPublicaVersion);
    const versionRemota = await resp.json();

    console.log('\n🎉 ¡Despliegue OTA completado con éxito!');
    console.log('Versión pública en Supabase:', versionRemota);
  } catch (error) {
    console.error('❌ Error durante la subida a Supabase:', error);
    process.exit(1);
  }
}

subirArchivos();
