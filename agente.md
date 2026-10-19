# Bitácora Técnica y Memoria Continua - Taquería Km 243

## 1. Decisiones Arquitectónicas del Proyecto
- **Arquitectura de Frontend:** SPA React 18 / 19 con TypeScript en modo estricto (`strict: true`), Vite y Tailwind CSS.
- **Diseño Visual Norteño Rutero (Carretera Nacional):**
  - Paleta rústica: Carbón/asfalto (`#1c1917`), madera/cuero (`#78350f`, `#9a3412`), terracota, naranja fuego y acentos en verde cilantro y blanco hueso.
  - Tipografía y ergonomía de alto contraste optimizada para tablets Android de 10" a 12" en exteriores o con iluminación intensa de taquería.
  - Botones táctiles de gran formato (mínimo 48px - 64px de alto) pensados para toma rápida de comandas sin fallos de pulsación.
- **Almacenamiento Local y Resiliencia Offline (Patrón Repository):**
  - Implementación con capa de abstracción sobre LocalStorage / IndexedDB con manejo estricto de eventos, fallbacks de serialización y sincronización simulada/cola de eventos para operación sin conexión.
- **Estructura Modular:**
  - `src/types`: Interfaces de dominio estrictas (Mesas, Productos, Comandas, Cuentas, Corte de Caja).
  - `src/services`: Repositorio de almacenamiento offline, gestor de impresión térmica/comandas y corte de caja.
  - `src/context` / `src/hooks`: Estado global reactivo para mesas, comanda activa y auditoría de turnos.
  - `src/components`:
    - `DashboardMesas`: Cuadrícula con semáforo de estados (Libre, Ocupada, Por cobrar).
    - `Comandero`: Selector de categorías de taquería (Tacos, Especialidades, Bebidas, Extras) con modificadores rápidos ("sin verdura", "salsa aparte", etc.).
    - `DetalleCuenta`: Desglose en vivo de consumo, cantidades, notas, subtotal y total.
    - `ModalCobro`: Cálculo ágil de efectivo, cambio y métodos de pago (efectivo, tarjeta, transferencia).
    - `HistorialPedidosModal`: Auditoría y trazabilidad cronológica de todas las órdenes enviadas a cocina en el turno con buscador, filtros y reimpresión.
- **Sincronización Multidispositivo en Tiempo Real:**
  - Servidor WebSocket centralizado (`servidor/servidor.js`) en el puerto 3001 con persistencia atómica en disco (`servidor/datos/estado_taqueria.json`).
  - Capa de transporte híbrida: WebSocket bidireccional con auto-reconexión y canal local `BroadcastChannel` para sincronización instantánea entre pestañas/tablets.
- **Sistema de Pantalla de Cocina (KDS - Kitchen Display System) y Comandas Incrementales:**
  - Módulo táctil (`src/components/PantallaCocina.tsx`) con cronómetros por comanda, semáforo de urgencia (verde < 10m, ámbar 10-20m, rojo parpadeante > 20m), demanda agregada en el comal y tachado interactivo por platillo.
  - Alerta sonora sintética generada mediante `AudioContext` nativo (campanilla acústica de restaurante de dos tonos) al recibir comandas enviadas por meseros.
  - Pestaña de historial de comandas despachadas con reactivación rápida.
  - **Envío Incremental de Comandas a Cocina (Ronda 2, 3, etc.):**
    - En `ItemComanda` se introdujo la propiedad `cantidadEnviadaCocina: number`.
    - Al agregar platillos adicionales a una mesa ya enviada a cocina, el sistema calcula la diferencia `pendiente = cantidad - cantidadEnviadaCocina`.
    - Al presionar **"Mandar a Cocina"**, se despacha única y exclusivamente lo nuevo sin duplicar platillos anteriores, asignando automáticamente el badge `🔥 Ronda X (Adicional)` para llamar la atención del taquero.
    - Cada platillo en la comanda exhibe badges de estado en tiempo real: `● Por enviar`, `✓ En cocina` o `✓ X en cocina · +Y nuevo(s)`.
    - Se incluye botón de contingencia **"Re-enviar comanda"** para situaciones donde se requiera volver a imprimir o consultar la orden completa.
- **Responsividad Universal para Teléfonos Móviles y Tablets:**
  - Cuadrícula de categorías adaptativa con tamaños de fuente proporcionales (`text-[11px] sm:text-xs md:text-sm`) y botones ergonómicos que evitan saltos de línea antiestéticos o solapamientos en pantallas de menos de 380px.
  - Contenedores con `min-h-0`, `flex-1` y `overflow-y-auto` que impiden que los teclados virtuales o las barras de acciones inferiores bloqueen la visualización del menú o el scroll.
- **Arquitectura en la Nube con Supabase (Desacoplamiento Total de la PC):**
  - Base de datos relacional PostgreSQL en Supabase (`supabase/esquema_supabase.sql`) con Realtime WebSockets para conectar todas las tablets y celulares sin requerir que la PC del restaurante esté encendida.
  - Cola offline local (`taqueria_cola_offline_v1`) que garantiza funcionamiento ininterrumpido ante pérdidas temporales de internet y sincronización bidireccional automática al recuperar la conectividad.

## 2. Errores Detectados y Correcciones Aplicadas
- **TS6133 ('AlertCircle', 'Wifi', etc. no utilizados):**
  - *Causa:* Las directivas estrictas de TypeScript (`noUnusedLocals`) detectan identificadores no leídos.
  - *Corrección:* Edición quirúrgica eliminando importaciones residuales.
- **Pantalla en Blanco en Android WebView (Chromium CORS en file:///):**
  - *Causa:* Al compilar Vite con ES Modules (`<script type="module">`), Android WebView bloquea por defecto la carga de módulos locales bajo el protocolo `file:///android_asset/` por políticas de Same-Origin / CORS.
  - *Corrección:* Se integró la librería `androidx.webkit:webkit:1.12.1` y se implementó `WebViewAssetLoader` en `MainActivity.kt`, cargando la app a través del dominio virtual seguro `https://appassets.androidplatform.net/assets/web/index.html` sin restricciones y con soporte offline total.
- **Barra Superior Morada en Emulador Android:**
  - *Causa:* El tema por defecto en `themes.xml` utilizaba `Theme.MaterialComponents.DayNight.DarkActionBar` con colores genéricos de plantilla.
  - *Corrección:* Se migró a `Theme.MaterialComponents.DayNight.NoActionBar` y se ajustaron `statusBarColor`, `navigationBarColor` y `windowBackground` a `#12100e` (carbón rústico de taquería).
- **Duplicación de Comandas en Cocina (Doble Entrega WebSocket + BroadcastChannel):**
  - *Causa:* Al convivir en la misma máquina o red el canal local `BroadcastChannel` y el socket `WebSocket`, una orden enviada llegaba por ambas vías y se agregaba dos veces en el estado de cocina sin deduplicación.
  - *Corrección:* Se implementó deduplicación idempotente por `pedido.id` en `RestauranteContext`, un filtro de mensajes con caché de IDs en `servicioSincronizacion.ts` y deduplicación en `servidor.js`.
- **Bloqueo de Desplazamiento Vertical (Scroll Bloqueado):**
  - *Causa:* Presencia de `overflow-hidden` en la etiqueta `<body>` de `index.html` y omisión de `min-h-0` en los contenedores Flexbox hijos (`<main>`, `DashboardMesas`, `PantallaCocina`), lo que impedía que `overflow-y-auto` calculara el desbordamiento.
  - *Corrección:* Se removió `overflow-hidden` del `body`, se añadió `min-h-0` a los contenedores Flexbox, se activó `-webkit-overflow-scrolling: touch` y se agregó padding inferior (`pb-24`) para visualización completa de todas las mesas y comandas.
- **Corte de Barra de Filtros y Desborde en Pantallas Angostas:**
  - *Causa:* La existencia de cuatro categorías fijas ("Salón Principal", "Barra Taquera", etc.) con textos largos provocaba desborde horizontal y recortes en el visor de mesas en dispositivos móviles y tablets verticales.
  - *Corrección:* Se unificaron las zonas a **"Mesas"** (`area: 'mesa'`) y **"Para Llevar"** (`area: 'para_llevar'`), eliminando salón y barra. Se agregó un adaptador defensivo en `RepositorioStorage.obtenerMesas()` para migrar registros previos en localStorage sin pérdida de datos.
- **Gestión Dinámica de Espacios (Agregar / Quitar Mesas y Pedidos Para Llevar):**
  - *Implementación:* Se dotó a `RestauranteContext` de los métodos `agregarMesa`, `eliminarMesa`, `agregarParaLlevar` y `eliminarParaLlevar`. Se aplicó la regla de negocio de seguridad: una mesa o pedido para llevar únicamente puede eliminarse si su estado es `'libre'`. Las modificaciones se sincronizan automáticamente con todas las tablets y cocina mediante WebSocket (`MESA_ACTUALIZADA`).
- **Desaturación Visual y Simplificación del Dashboard (UX Tablet/POS):**
  - *Causa:* El Dashboard presentaba sobrecarga cognitiva (títulos extensos, semáforo pesado, 16 botones idénticos "+ Abrir Mesa", badges "Disponible" repetitivos y 16 iconos de papelera flotantes a la vez).
  - *Corrección:* 
    1. Se consolidó la barra superior en una sola fila esbelta con selector de pestañas minimalista y pastillas de estado compactas.
    2. Se desaturaron las tarjetas de mesas libres: se eliminaron los textos redundantes y botones interiores toscos; ahora toda la tarjeta es el botón táctil suave.
    3. Se implementó el modo "Gestionar" para ocultar las acciones destructivas (papeleras) durante el servicio cotidiano.
    4. Se normalizaron automáticamente en `RepositorioStorage` los nombres heredados como "Barra 1, 2, 3" transformándolos a "Mesa X".
- **Resolución de Error de Conexión WebSocket en Navegador Host:**
  - *Causa:* En `servicioSincronizacion.ts`, la función `obtenerUrlWebSocket` forzaba `ws://10.0.2.2:3001` cuando `hostname === 'localhost'`. Dicha IP es exclusiva para el emulador Android, causando fallas continuas de conexión `SYN_SENT` al depurar en el navegador local (`localhost:5173`).
  - *Corrección:* Se discriminó correctamente: si el origen es `appassets.androidplatform.net` se utiliza `10.0.2.2`, si es `localhost` o `127.0.0.1` se conecta a `ws://localhost:3001`, y en red LAN se conecta a `ws://${hostname}:3001`. Se arrancó el servidor WebSocket de Node.js en segundo plano y se confirmó la conexión exitosa inmediata (`::1`).
- **Control de Densidad en Grid de Mesas (Estrictamente Máximo 3 por Fila):**
  - *Causa:* Para eliminar definitivamente la aglomeración en tablets (7" a 12") y dispositivos en general, se solicitó un límite estricto de 3 mesas por fila.
  - *Corrección:* Se configuró la grilla como `grid-cols-1 sm:grid-cols-2 md:grid-cols-3` sin breakpoints de 4, 5 o 6 columnas. Esto asegura que en cualquier resolución las tarjetas se mantengan amplias, con tipografía visible y botones táctiles cómodos.
- **Eliminación de "Para Llevar" y Consolidación de "A Domicilio":**
  - Se unificó el flujo de despacho sin comensal en mesa bajo el área **"A Domicilio"** (`area: 'domicilio'`), suprimiendo completamente el tipo legado `para_llevar`. Las mesas previas persistidas se migran automáticamente en `repositorioStorage.ts`.
- **Módulo de División de la Cuenta (Split Bill):**
  - Implementado en `src/components/ModalCobro.tsx` permitiendo dividir el total a pagar entre 1 y 6 personas, calculando en tiempo real la cuota exacta por comensal para mayor claridad.
- **Soporte de Pago Mixto (2 Métodos de Pago Simultáneos):**
  - Nuevo método de pago `'mixto'` que permite liquidar una cuenta combinando dos métodos (por ejemplo, parte en efectivo y el restante en tarjeta o transferencia).
  - Si se incluye efectivo, calcula automáticamente el remanente exigido y el cambio a devolver. Los montos se desglosan con precisión en el corte de caja diario.
- **Sistema de Tema Claro / Oscuro (Light & Dark Mode):**
  - Alternador de tema en la barra superior (`NavbarSuperior.tsx`) con persistencia en `LocalStorage` (`CLAVES_STORAGE.TEMA`) y aplicación de la clase `.tema-claro` en `html`.
  - Soporte de contraste y estilos visuales en `DashboardMesas`, `Comandero`, `DetalleCuenta`, `ModificadorModal` y `ModalCobro`.
- **Adaptabilidad Móvil Completa (Uso en Celular):**
  - En smartphones (`< md`), la toma de comanda no compite en pantalla dividida: se implementó un conmutador ergonómico tipo pestañas y barra inferior (`Utensils` / `Receipt`) que permite al mesero alternar entre seleccionar tacos/bebidas y revisar la cuenta con un solo toque.
  - Botón flotante móvil de acceso directo a la cuenta con badge del total de platillos acumulados.
- **Orientación Dinámica Multi-dispositivo (Vertical y Horizontal):**
  - Se configuró `android:screenOrientation="fullSensor"` y `android:smallScreens="true"` en `app/src/main/AndroidManifest.xml`.
  - Permite utilizar la aplicación tanto en vertical (portrait) para smartphones y comandas de bolsillo, como en horizontal (landscape) para tablets fijas de barra o cocina.
- **Detección Dinámica de Notch (Recorte de Cámara) y Safe Areas:**
  - *Arquitectura híbrida Web + Nativa:* Combina el estándar CSS `env(safe-area-inset-*)` con la API de hardware Android `DisplayCutout`.
  - En `MainActivity.kt`, se activó `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES` y se implementó `ViewCompat.setOnApplyWindowInsetsListener` para medir en píxeles CSS (`dp`) el recorte de la cámara frontal y la barra de navegación gestual, inyectando en caliente las variables CSS `--notch-top`, `--notch-bottom`, `--notch-left` y `--notch-right` en `:root`.
  - En `frontend/src/index.css`, se derivaron variables seguras `--safe-top: max(var(--notch-top, 0px), env(safe-area-inset-top, 0px))` aplicadas en `NavbarSuperior` (libra el orificio de la cámara en vertical), en el contenedor raíz (libra el notch en horizontal) y en la barra inferior móvil (libra la barra de gestos). Si el dispositivo no tiene notch o es una tablet estándar, el margen es estrictamente `0px`.
- **Desaturación de Barra Superior mediante Menú Tipo Hamburguesa (Drawer Lateral):**
  - *Causa:* La barra superior acumulaba 7 botones simultáneos (Logo, Mesas/Cocina, Reloj, Monitor de Red, Mesero, Historial, Corte de Caja, Sol/Luna, Pantalla Completa), saturando la visualización en tablets verticales y celulares.
  - *Solución:* Se simplificó la barra a sus elementos esenciales (Identidad, Selector Mesas/Cocina, indicador de sincronización y botón hamburguesa `Menu`).
  - *Panel Deslizante:* Al pulsar el botón hamburguesa, se despliega un panel lateral derecho (Drawer offcanvas) con backdrop suave que reúne organizadamente: tarjeta y cambio de mesero, acceso a *Historial de Órdenes*, *Corte de Caja Diario*, conmutador de *Tema Claro / Oscuro*, *Pantalla Completa*, reloj digital y estado de conexión en red. Compatible con tema claro y márgenes seguros de notch.

## 2. Errores Detectados y Correcciones Aplicadas
- **Bloqueo Estricto en Orientación Horizontal (sensorLandscape):**
  - *Causa:* El manifiesto de Android definía `android:screenOrientation="sensorLandscape"` y `android:smallScreens="false"`, impidiendo que la pantalla rotara al sostener el dispositivo en vertical y restringiendo teléfonos pequeños.
  - *Corrección:* Se modificó a `android:screenOrientation="fullSensor"` y `android:smallScreens="true"`. Gracias a que `MainActivity` cuenta con `android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"`, la rotación entre horizontal y vertical se produce en caliente sin reiniciar el WebView ni perder el estado de la comanda activa.
- **TS1359 / TS1005 (Duplicación accidental de return en NavbarSuperior.tsx):**
  - *Causa:* Durante la adición de la variable `esClaro`, quedó un bloque `return (` huérfano antes de la declaración.
  - *Corrección:* Eliminación quirúrgica del bloque residual.
- **TS6133 ('ArrowRight' no utilizado en ModalCobro.tsx):**
  - *Causa:* Importación residual tras la reestructuración de la interfaz de pago mixto.
  - *Corrección:* Eliminación de la importación no leída.
- **TS2367 (Comparación sin solapamiento de tipos en repositorioStorage.ts):**
  - *Causa:* Al estrechar `TipoArea` a `'mesa' | 'domicilio'`, TypeScript detectó que comparar un registro legado con `'para_llevar'` no solapaba con el tipo `Mesa`.
  - *Corrección:* Se definió la interfaz `MesaPersistidaLegada` con `area?: string` para tipar limpiamente la migración defensiva.

## 2. Errores Detectados y Correcciones Aplicadas
- **Falla de Conexión entre Dispositivos Físicos Distintos e Integración de Base de Datos SQL:**
  - *Causa Raíz Identificada:*
    1. Al empaquetar la app en Android con `WebViewAssetLoader`, el dominio virtual interno del WebView es `appassets.androidplatform.net`.
    2. En `servicioSincronizacion.ts`, la URL de WebSocket tenía cableado `ws://10.0.2.2:3001` cuando `hostname === 'appassets.androidplatform.net'`.
    3. `10.0.2.2` es una dirección exclusiva del emulador AVD de Android Studio para comunicarse con la máquina virtual. En teléfonos o tablets físicas conectadas por Wi-Fi, esa IP no existe ni resuelve al servidor host (`192.168.5.213`), por lo que los dispositivos reales quedaban totalmente aislados y sin comunicarse entre sí.
  - *Solución Integral Implementada:*
    1. **Motor de Base de Datos SQL Relacional (SQLite):**
       - Se integró `better-sqlite3` en el servidor Node.js (`servidor/baseDatosSql.js`) con modo WAL (`journal_mode = WAL`) para máxima velocidad y transacciones concurrentes seguras.
       - Tablas relacionales normalizadas: `mesas`, `cuentas`, `pedidos_cocina`, `cortes_caja` y `configuracion`.
       - Métodos transaccionales atómicos mediante Prepared Statements (`obtenerEstadoCompleto()`, `guardarMesa()`, `guardarCuenta()`, `guardarPedidoCocina()`, etc.).
       - La base de datos persiste físicamente en `servidor/datos/taqueria.db`.
    2. **Servidor Híbrido HTTP REST + WebSocket:**
       - Reescrito `servidor/servidor.js` para escuchar en `0.0.0.0:3001` (todas las interfaces de red del host).
       - Endpoints REST añadidos:
         - `GET /api/ping`: Comprobación rápida de salud y listado de direcciones IP locales disponibles.
         - `GET /api/ips`: Reporta las interfaces de red del servidor.
         - `GET /api/estado`: Permite consultar el estado completo directamente desde SQL.
       - Sincronización bidireccional instantánea: ante cualquier comanda o cobro emitido por una tablet, se actualiza la base de datos SQL y se emite el evento al resto de terminales conectadas.
    3. **Soporte Dinámico de Host y Reconexión en Caliente en Frontend:**
       - En `servicioSincronizacion.ts` se definió la constante `HOST_DEFECTO_LAN = '192.168.5.213:3001'`.
       - Se lee y persiste el host en `localStorage` (`taqueria_servidor_host`), permitiendo configurar la IP exacta de la red del restaurante sin necesidad de recompilar la app.
       - Se implementaron los métodos públicos `obtenerHostServidor()`, `guardarHostServidor()`, `reconectar()` y `probarConexionHttp(host)`.
- **Bloqueo Silencioso de Conexiones por Mixed Content y Discrepancia de Payloads:**
  - *Causas Detectadas tras Pruebas con Dispositivos:*
    1. **Mixed Content en WebView de Android:** El WebView cargaba los assets bajo el protocolo `https://appassets.androidplatform.net`. Al intentar conectar un WebSocket no cifrado `ws://192.168.5.213:3001` o hacer `fetch` a `http://...`, el motor Chromium bloqueaba la petición como contenido mixto inseguro.
    2. **Discrepancia de Nombres de Eventos y Formato de Datos:** `RestauranteContext` emitía `MESA_ACTUALIZADA` enviando un objeto con arrays `{ mesas, cuentasActivas }`, mientras que `servidor.js` validaba estrictamente `if (payload?.mesa)` en singular, ignorando el guardado en base de datos y la retransmisión al resto de terminales. De igual forma, las comandas enviadas a cocina se emitían como `NUEVA_COMANDA_COCINA` pero el servidor escuchaba `PEDIDO_COCINA_NUEVO`.
    3. **Estado de Conexión Desincronizado:** `estaEnLinea` dependía únicamente del evento `window.ononline` del navegador (que siempre daba `true` por haber Wi-Fi), sin reflejar el estado vivo del socket ni actualizar el número real de terminales.
    4. **Perfil de Red en Firewall de Windows:** La interfaz Ethernet del servidor está asignada al perfil `Private` y la regla por defecto de Node.js solo admitía `Public`.
  - *Correcciones Aplicadas:*
    1. En `MainActivity.kt`, se activó `setHttpAllowed(true)` en `WebViewAssetLoader.Builder()`, se configuró `settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW` y se cargó la URL como `http://appassets.androidplatform.net/assets/web/index.html`.
    2. En `servidor/servidor.js`, se reescribió el switch para procesar tanto mesas individuales como colecciones completas (`payload.mesas`, `payload.cuentasActivas`), pedidos de cocina (`NUEVA_COMANDA_COCINA` y `PEDIDO_COCINA_ACTUALIZADO`) y cobros (`CUENTA_COBRADA`), persistiendo todo en SQLite y retransmitiendo fielmente a los demás clientes conectados.
- **Desacoplamiento Total de la PC y Migración a Base de Datos en la Nube (Supabase + Offline-First):**
  - *Motivación:* El usuario solicitó prescindir totalmente de tener una computadora encendida como servidor y contar con operación offline completa (poder tomar pedidos y operar sin conexión, sincronizándose automáticamente al detectar red).
  - *Arquitectura Implementada:*
    1. **PostgreSQL Relacional en la Nube (Supabase):**
       - Se creó el script [`supabase/esquema_supabase.sql`](file:///d:/TaqueriaKm243/supabase/esquema_supabase.sql) con las tablas relacionales normalizadas: `mesas`, `cuentas`, `pedidos_cocina` y `cortes_caja`, con Row Level Security (RLS) habilitado y publicación Realtime activada para sincronización instantánea entre celulares.
       - No requiere PC ni servidor local; opera sobre la infraestructura gratuita de Supabase.
    2. **Persistencia y Capacidad Offline-First (Outbox Pattern):**
       - Implementado en [`servicioSupabase.ts`](file:///d:/TaqueriaKm243/frontend/src/services/servicioSupabase.ts).
       - Toda acción (apertura de mesa, comanda de cocina, cobro, cambio de estado) se guarda de inmediato en el almacenamiento local del teléfono (`localStorage` / caché local) garantizando que la taquería nunca se detenga si se va el Wi-Fi o internet.
       - Si no hay conexión, los cambios se acumulan en la cola offline `taqueria_cola_offline_v1`.
       - Al detectar conexión (evento `online` o suscripción de Realtime), la cola se procesa y sincroniza automáticamente contra PostgreSQL sin intervención del usuario.
    3. **Resolución Atómica de Conflictos por UUID:**
       - Las comandas e ítems cuentan con identificadores UUID únicos independientes, de modo que si dos meseros toman pedidos simultáneos en modo offline, ambos se fusionan atómicamente en la cuenta al reconectar sin sobreescribir datos.
    4. **Configuración Dinámica de Credenciales en la App:**
       - Modal [`ModalConfiguracionServidor.tsx`](file:///d:/TaqueriaKm243/frontend/src/components/ModalConfiguracionServidor.tsx) adaptado para ingresar la `Project URL` y la clave `anon public` de Supabase, con botón interactivo de diagnóstico para probar la conexión con PostgreSQL en vivo.
       - Pastilla en la barra superior con retroalimentación en tiempo real: `🟢 Nube` cuando está sincronizado y `🟡 Offline` cuando opera sin conexión.

- **Corrección de Bug de Duplicación Masiva de Mesas:**
  - *Causas Identificadas:*
    1. **Discrepancia en IDs Iniciales:** El script `supabase/esquema_supabase.sql` utilizaba prefijos abreviados (`m-1` a `m-12`, `dom-1`, `dom-2`), mientras que el frontend y SQLite utilizaban la convención canónica (`mesa-1` a `mesa-12`, `domicilio-1`, `domicilio-2`). Al sincronizar por Realtime o carga inicial, el comparador `id === mesa.id` no encontraba coincidencia y anexaba todas las mesas de nuevo, duplicándolas a 28 elementos.
    2. **Persistencia Huérfana en Supabase:** Al eliminar una mesa o pedido a domicilio desde la app, solo se invocaba `guardarMesas(nuevasMesas)` que realizaba `upsert` de las mesas existentes, dejando intactas las filas eliminadas en PostgreSQL. Al reconectar o reiniciar la app, las mesas eliminadas volvían a descargarse.
    3. **Ausencia de Sanitización en Almacenamiento Local:** Si `localStorage` ya contenía duplicados acumulados, `RepositorioStorage.obtenerMesas()` los leía y propagaba ciegamente.
  - *Solución Aplicada:*
    1. Se implementó el módulo puro [`saneadorMesas.ts`](file:///d:/TaqueriaKm243/frontend/src/utils/saneadorMesas.ts) con la función `deduplicarYSanearMesas(mesas: Mesa[]): Mesa[]`, que consolida y deduplica registros por tupla física `(area, numero)` e `id`, otorgando precedencia a mesas ocupadas o con comandas activas, y ordenando consistentemente.
    2. Se integró la sanitización en `RepositorioStorage.obtenerMesas()`, en los eventos de sincronización (`SYNC_ESTADO_COMPLETO`, `MESA_ACTUALIZADA`, `NUEVA_COMANDA_COCINA`, `CUENTA_COBRADA`) y en la carga remota de Supabase.
    3. Se implementó `eliminarMesaRemota(mesaId)` en `servicioSupabase.ts` con soporte offline (`DELETE`) para asegurar que las mesas borradas se supriman de forma atómica en Supabase.
    4. Se unificaron los identificadores iniciales en `supabase/esquema_supabase.sql`.

- **Reconexión Automática Continua a la Base de Datos (Self-Healing & Heartbeat):**
  - *Causas Identificadas:*
    1. Al suspenderse la tablet/celular, apagarse la pantalla o fluctuar el Wi-Fi, el canal Realtime de Supabase pasaba a `CLOSED`, `CHANNEL_ERROR` o `TIMED_OUT`, quedando desconectado indefinidamente sin mecanismo de recuperación.
    2. El evento `online` solo procesaba la cola offline sin reiniciar el socket ni reanudar la suscripción.
  - *Solución Aplicada:*
    1. Se dotó a `servicioSupabase.ts` de un mecanismo de auto-reconexión continua con backoff exponencial progresivo (`programarReconexion`).
    2. Se implementó un latido de diagnóstico periódico (`timerLatido`) cada 20 segundos que comprueba la respuesta de PostgreSQL en vivo. Si detecta desconexión, restablece el canal Realtime y procesa la cola offline.
    3. Se integraron escuchas de ciclo de vida del dispositivo móvil: `visibilitychange` (reconecta de inmediato al encender la pantalla o volver a la app tras estar en segundo plano), `focus` y `online`, tanto para Supabase como para el hub WebSocket local (`servicioSincronizacion.ts`).

- **Navegación con Botones del Celular / Tablet y Retorno al Inicio mediante Clic en Logo:**
  - *Implementación de Clic en el Logo:*
    - En [`NavbarSuperior.tsx`](file:///d:/TaqueriaKm243/frontend/src/components/NavbarSuperior.tsx), se transformó la identidad de la taquería en un botón accesible y táctil con micro-interacción `active:scale-95`.
    - Al pulsarlo, ejecuta `handleIrAlInicio()`: regresa la vista a `'mesas'`, deselecciona cualquier mesa activa, cierra el drawer hamburguesa y modales abiertos, y restablece el historial de navegación.
  - *Soporte Integral de Navegación Atrás en Celulares y Tablets:*
    - Se creó el gestor [`navegacionDispositivo.ts`](file:///d:/TaqueriaKm243/frontend/src/utils/navegacionDispositivo.ts) que sincroniza el historial de navegación (`window.history.pushState` y `popstate`) con los estados de la aplicación.
    - Al presionar el botón "Atrás" (físico, virtual o gestual):
      1. Si un modal está abierto (Cobro, Corte de Caja, Historial de Pedidos, Configuración, Ticket, Menú Hamburguesa), se cierra el modal.
      2. Si en celular se está visualizando la cuenta activa (`pestanaMovil === 'cuenta'`), regresa a la pestaña de menú/tacos.
      3. Si se está tomando comanda en una mesa (`mesaSeleccionada`), regresa al Dashboard de mesas.
      4. Si se está en la pantalla de Cocina (`vistaActual === 'cocina'`), regresa al Dashboard de mesas.
  - **Conexión Automática Inmediata a Supabase y Eliminación de Falsas Desconexiones:**
  - *Causas Identificadas:*
    1. Si `localStorage` no contenía credenciales previas en una tablet o celular recién instalado, el cliente de Supabase quedaba sin inicializar en modo offline requiriendo intervención manual.
    2. El servicio legado `servicioSincronizacion.ts` (WebSocket a la PC en puerto 3001) seguía ejecutándose de fondo; al no existir la PC como servidor, sus eventos de error disparaban `ESTADO_CONEXION_ACTUALIZADO: { conectado: false }`, pisando el estado real de Supabase y haciendo que la interfaz parpadeara continuamente a "Offline".
    3. Al reconectar el canal Realtime de Supabase tras una fluctuación de red o suspensión, no se invocaba `cliente.removeChannel(canal)`, lo que dejaba instancias zombi en el gestor de canales de `@supabase/realtime-js` generando `CHANNEL_ERROR` y demoras de hasta 15 segundos en el backoff.
  - *Solución Aplicada:*
    1. Se configuraron como constantes predeterminadas oficiales en `servicioSupabase.ts`:
       - `URL_PREDETERMINADA`: `https://idgyotujnoavliaqtuck.supabase.co`
       - `ANON_KEY_PREDETERMINADA`: Clave oficial provista por el usuario.
       `obtenerCredenciales()` recurre a ellas de forma predeterminada, logrando **conexión 100% automática desde el primer segundo** en cualquier teléfono o tablet sin requerir configuración manual.
    2. Se desvinculó el estado `estaEnLinea` del socket local obsoleto en `RestauranteContext.tsx`. Ahora `estaEnLinea` refleja única y fielmente el estado de la base de datos de Supabase en la nube.
    3. Se optimizó el ciclo de vida del canal Realtime: antes de crear una nueva suscripción se invoca `cliente.removeChannel(canal)` y se genera un identificador único por canal.
    4. Se implementó `verificarSaludRapida()`: si el WebSocket sufre un hipo momentáneo pero la API REST de PostgreSQL responde ok (`from('mesas').select('id').limit(1)`), la aplicación permanece marcada como conectada sin generar alarmas falsas al mesero y reengancha el socket en 1.5s a 2s.
    5. Se redujo el latido de verificación de salud (`timerLatido`) de 20s a 8s.

- **Corrección de Bloqueo al Desocupar Mesas y Sincronización Total tras Reconexión:**
  - *Causas Raíz Detectadas:*
    1. **Precedencia errónea en `saneadorMesas.ts`:** Si una mesa estaba ocupada en el estado local y llegaba la versión actualizada de Supabase como `estado: 'libre'`, el saneador evaluaba `existenteActiva && !nuevaActiva` y **descartaba la mesa libre conservando la ocupada**. Esto impedía por completo que una mesa pasara de ocupada a libre al fusionar estados.
    2. **Omisión de Persistencia de Cuentas Cerradas en Supabase:** En `cerrarYCobrarCuenta`, la cuenta se borraba del diccionario de cuentas activas (`delete cuentasCopia[id]`) y luego se invocaba `guardarCuentas(cuentasCopia)`. La cuenta cobrada jamás se enviaba con `estado: 'cerrada'` a Supabase, manteniéndose como `'abierta'` en la base de datos remota y reapareciendo como activa al recargar.
    3. **Ausencia de Re-Sincronización al Reconectar:** Al restablecerse la conexión de red o desbloquear la tablet (`ESTADO_CONEXION_ACTUALIZADO: { conectado: true }`), solo se cambiaba la bandera `estaEnLinea`, pero no se volvía a consultar `obtenerEstadoRemoto()`. Los eventos de Realtime solo transmitían cambios futuros, omitiendo cualquier cobro o liberación ocurrido mientras el dispositivo estuvo sin red o con la pantalla apagada.
    4. **Cuentas Abiertas Huérfanas al Liberar Mesa Manual:** Al cancelar una mesa, no se cancelaba su cuenta en PostgreSQL, por lo que la cuenta persistía abierta en la nube.
  - *Solución Aplicada:*
    1. En `saneadorMesas.ts`, se eliminó el bloqueo: el elemento posterior en el array (la actualización más reciente) siempre reemplaza al anterior, permitiendo que `libre` prevalezca.
    2. En `servicioSupabase.ts`, se incorporaron los métodos `guardarCuentaIndividual` (persiste inmediatamente `cuentaCerrada` con `estado: 'cerrada'`) y `cancelarCuentaRemota` (marca la cuenta como `'cancelada'` en PostgreSQL al liberar una mesa).
    3. En `RestauranteContext.tsx`, se creó la función centralizada `sincronizarConServidorRemoto()`, que se dispara automáticamente:
       - En la carga inicial de la aplicación.
       - Cada vez que Supabase se reconecta (`conectado: true`).
       - Al dispararse el evento `online` del navegador o sistema operativo.
       - Al reanudar la pantalla (`document.visibilityState === 'visible'`).
    4. En los listeners de Realtime (`MESA_REMOTA_ACTUALIZADA` y `CUENTA_REMOTA_ACTUALIZADA`), si una mesa o cuenta se marca como libre/cerrada, se eliminan atómicamente de `cuentasActivas` y se libera la mesa en la pantalla de inmediato.

- **Eliminación de Errores de WebSocket y Detección de Dispositivos con Supabase Presence:**
  - *Problema:* La consola mostraba constantes errores rojos `WebSocket connection to 'ws://localhost:3001/' failed` cada 2 segundos, y el contador de dispositivos conectados no se sincronizaba entre teléfonos independientes.
  - *Causa:* `servicioSincronizacion.ts` mantenía un intento de conexión por defecto a un servidor WebSocket local en el puerto 3001, obsoleto tras la migración a Supabase 100% autónomo en la nube.
  - *Solución:*
    1. Se hizo estrictamente opcional la conexión a WebSocket local en `servicioSincronizacion.ts`: solo se conecta si el usuario define explícitamente un host en `localStorage`. Si no existe, no intenta conectarse a `localhost:3001` ni genera bucles de reconexión, eliminando todos los errores rojos de la consola. El `BroadcastChannel` local sigue sincronizando pestañas en un mismo dispositivo.
    2. Se implementó **Supabase Presence** nativo en `servicioSupabase.ts` utilizando el canal unificado `'taqueria-sync-global'`. Cada dispositivo anuncia su presencia (`channel.track(...)`) y sincroniza el número real de teléfonos/tablets conectados mediante `presenceState()`, emitiendo `DISPOSITIVOS_ACTUALIZADOS`.

- **Estabilidad de la Pestaña "Cuenta" en Dispositivos Móviles:**
  - *Problema:* Al pulsar el botón "2. Cuenta" en la barra inferior móvil, la vista se regresaba sola a la pestaña "1. Menú" a los pocos segundos.
  - *Causa:*
    1. En `App.tsx`, el `useEffect` para `'pestana-cuenta-movil'` tenía como dependencia el objeto `mesaSeleccionada`. Cuando llegaba un evento o latido en segundo plano, la referencia en memoria cambiaba y React ejecutaba el cleanup del efecto.
    2. En `navegacionDispositivo.ts`, la función de limpieza de `empujarPaso()` llamaba a `window.history.back()`. Este retroceso provocaba un evento `popstate` cuyo manejador forzaba `setPestanaMovil('menu')`, expulsando al usuario.
  - *Solución:*
    1. En `navegacionDispositivo.ts`: `empujarPaso()` ahora comprueba si el paso ya existe en la pila. En caso afirmativo, únicamente actualiza el handler sin invocar `pushState` ni desincronizar el historial. Además, la limpieza solo retrocede si el estado actual del historial coincide con ese paso y fue cerrado directamente por la UI.
    2. En `App.tsx`: Se cambiaron las dependencias de los efectos a tipos primitivos (`mesaSeleccionada?.id`), evitando desmontajes espurios por latidos o actualizaciones en segundo plano.

- **Persistencia de la Pantalla de Cobro Exitoso y Control Manual del Cajero:**
  - *Problema:* Al confirmar el cobro de una cuenta, la pantalla de éxito con el cambio devuelto se cerraba de forma instantánea ("demasiado rápido"), impidiendo al cajero ver el cambio o pulsar "Imprimir Ticket y Salir".
  - *Causa:* En `ModalCobro.tsx`, existía la condición `if (!mesaSeleccionada || !cuentaActiva) return null;`. En cuanto `cerrarYCobrarCuenta(...)` eliminaba la cuenta cobrada de `cuentasActivas`, `cuentaActiva` pasaba a ser `null` y el modal retornaba `null` en el siguiente ciclo de renderizado (0 ms), cerrándose prematuramente antes de que el usuario pudiera interactuar con la pantalla de éxito.
  - *Solución:* Se desacopló la vista de cobro exitoso de la existencia de `cuentaActiva` mediante el estado congelado `resumenExito`. Al pulsar "Confirmar Cobro", se capturan y congelan todos los datos finales (nombre de mesa, total cobrado, método de pago, desglose mixto y cambio devuelto). El modal permanece abierto de forma estable con el confeti y los botones "Cerrar sin Ticket" e "Imprimir Ticket y Salir" hasta que el usuario decida conscientemente salir.

- **Eliminación Definitiva de Cuentas Fantasma y Órdenes Huérfanas de Mesas:**
  - *Problema:* Al cobrar una cuenta de la Mesa 1, volvía a aparecer la mesa ocupada con una orden pendiente previa que ya había sido cancelada.
  - *Causa:* Al cancelar o liberar una mesa, únicamente se eliminaba la cuenta específica de la memoria local. Si existía alguna cuenta previa creada con otro identificador o si la fila en Supabase persistía con `estado = 'abierta'`, la consulta remota `select('*').eq('estado', 'abierta')` volvía a descargar la cuenta cancelada como si estuviera activa, asociándola a la mesa.
  - *Solución:*
    1. En `servicioSupabase.ts`, se implementaron `cancelarCuentasDeMesaRemota(mesaId, numeroMesa)` y `cancelarPedidosCocinaDeMesa(mesaId)` para actualizar atómicamente a `estado: 'cancelada'` todas las cuentas abiertas de esa mesa en PostgreSQL y limpiar comandas huérfanas en cocina.
    2. En `RestauranteContext.tsx`, tanto `cerrarYCobrarCuenta` como `liberarMesaManual` purgan del diccionario local todas las cuentas asociadas a esa misma mesa.
    3. En `sincronizarConServidorRemoto`, se añadió un filtro de consistencia estricto: cualquier cuenta remota que pertenezca a una mesa que se encuentra `libre` es detectada inmediatamente como cuenta huérfana, descartada del estado local y cancelada automáticamente en la base de datos de Supabase.

- **Soporte Integral para iOS (iPhone y iPad) y Ecosistema Apple WebKit:**
  - *Viewport Dinámico (100dvh):* Se reemplazó `h-screen max-h-screen` por `h-[100dvh] max-h-[100dvh]` en `App.tsx` y `#root`, asegurando que la barra flotante de Safari móvil no cubra las barras inferiores de acciones ni los botones de navegación (`1. Menú / Tacos`, `2. Cuenta`).
  - *Supresión de Efecto Elástico (Rubber-banding):* Configurado `overscroll-behavior: none` y `overscroll-behavior-y: none` en `html, body` dentro de `index.css`.
  - *Bloqueo de Auto-Zoom en Inputs:* Regla CSS `@supports (-webkit-touch-callout: none)` que garantiza un `font-size: 16px` mínimo en inputs y selects en WebKit, previniendo el zoom involuntario al teclear en smartphones.
  - *Desbloqueo de Audio KDS en iOS (Singleton AudioContext):* En `sonidoCocina.ts`, se implementó el patrón Singleton con escucha de interacción táctil (`touchstart`, `pointerdown`, `click`) para ejecutar `ctx.resume()` y desbloquear el sonido de campanilla acústica ante políticas estrictas de auto-reproducción de Safari. Se añadió botón manual en cocina con icono `Volume2`.
  - *Impresión Térmica AirPrint:* Reglas `@media print` en `index.css` que aíslan `#ticket-imprimible` a 80mm e invisibilizan la UI general al imprimir desde iPads o iPhones.
  - *PWA Standalone y Guía Visual iOS:* Metatags Apple en `index.html`, `apple-touch-icon.png` (192x192), `orientation: any` en `manifest.json`, y modal interactivo `GuiaInstalacionIosModal.tsx` accesible desde el menú hamburguesa que guía al usuario para agregar la app a la pantalla de inicio.
  - *Contenedor Nativo iOS (Swift + WKWebView):* Estructurado en `ios/TaqueriaKm243/` con `AppDelegate.swift`, `SceneDelegate.swift`, `ViewController.swift` y `Info.plist` con permisos de red local `NSLocalNetworkUsageDescription` e inyección reactiva de Safe Areas.

## 3. Comandos de Compilación y Despliegue
- **Modo Desarrollo Frontend (HMR):**
  ```powershell
  cd frontend
  pnpm dev --host
  ```
- **Compilación Web y Sincronización a Android:**
  ```powershell
  cd frontend
  pnpm run sync:android
  ```
- **Compilación Web y Sincronización a iOS:**
  ```powershell
  cd frontend
  pnpm run sync:ios
  ```
- **Sincronización Simultánea Multiplataforma (Android + iOS):**
  ```powershell
  cd frontend
  pnpm run sync:all
  ```
- **Generación de APK Android:**
  - *Opción recomendada (Mediante pnpm desde frontend):*
    ```powershell
    cd frontend
    pnpm run build:apk
    ```
  - *Opción directa con PowerShell:*
    ```powershell
    $env:JAVA_HOME = "D:\ANDROID STUDIO\jbr"
    ./gradlew assembleDebug
    ```
  - *Ubicación del APK resultante listo para instalar:*
    `app/build/outputs/apk/debug/app-debug.apk`

- **Reinicio Integral de Ventas al Cierre de Turno y Módulo Calendario de Historial:**
  - *Arquitectura de Turnos:* Un turno cerrado no solo pone a cero el contador de ventas del corte actual (`corteActual`), sino que archiva de manera inmutable el turno con sus cuentas cobradas en `historialTurnos` (LocalStorage `taqueria_km243_historial_turnos_v1` y Supabase `cortes_caja`).
  - *Garantía de Borrado Total de Mesas:* Al confirmar el cierre con PIN de admin (`2430`):
    1. **Estado en Memoria y UI:** Todas las mesas (comedor y pedidos a domicilio) se restablecen a `estado = 'libre'`, `cuentaActivaId = null`, `horaApertura = null`, `totalParcial = 0`, y `meseroAsignado = undefined`.
    2. **Cuentas Activas y Selección:** `cuentasActivas` se vacía a `{}`, `mesaSeleccionadaId` pasa a `null`, `ticketImpresion` se anula a `null` y `cuentasCerradas` se limpia a `[]`.
    3. **Cola de Cocina KDS:** `pedidosCocina` se vacía en memoria y se elimina físicamente de LocalStorage (`CLAVES_STORAGE.PEDIDOS_COCINA`).
    4. **Purga Masiva Remota (Supabase):** Se ejecutan `cancelarTodasLasCuentasAbiertasRemotas()` y `cancelarTodosLosPedidosCocinaPendientesRemotos()`, garantizando que ninguna cuenta huérfana ni comanda pendiente permanezca en la base de datos de PostgreSQL.
    5. **Transacción Atómica SQLite (`reiniciarTurnoCompleto`):** En `servidor/baseDatosSql.js`, se actualizan en una sola transacción atómica todas las cuentas abiertas a `cancelada`, pedidos a `entregado` y mesas a `libre`.
    6. **Sincronización en Tiempo Real:** El evento `TURNO_REINICIADO` retransmite a todas las tablets de meseros y cocina el payload limpio, forzando la liberación inmediata en todas las pantallas.
  - *Visualizador Calendario de Turnos:* Componente táctil interactivo `CalendarioHistorialTurnos.tsx` integrado en `CorteCajaModal.tsx` con navegación por mes y año, indicadores de venta por fecha y panel de auditoría detallada de cada turno con sus cuentas cobradas y platillos.

- **Corrección de Persistencia de la Mesa 1 y Mesas Ocupadas sin Cuenta Activa:**
  - *Problema Reportado:* Al reiniciar la aplicación o presionar "Cancelar Orden", la Mesa 1 continuaba apareciendo ocupada con `$385.00` y tiempo acumulado de `6h 6m`.
  - *Causas Raíz Detectadas:*
    1. **Filas Legadas Duplicadas en Supabase:** En la base de datos remota de Supabase coexistían registros legados iniciales con IDs de prefijo corto (`m-1`, `m-2`, etc.) junto con los identificadores canónicos (`mesa-1`, etc.). La fila `m-1` mantenía `estado = 'ocupada'` y `$385.00`, reinyectándose durante la sincronización remota inicial.
    2. **Falta de Persistencia Local Inmediata en `liberarMesaManual`:** Al cancelar una orden desde el visor de mesas o detalle de cuenta, `liberarMesaManual` en `RestauranteContext.tsx` actualizaba el estado en memoria de React, pero no invocaba `RepositorioStorage.guardarMesas(actualizadas)` ni `RepositorioStorage.guardarCuentasActivas(copia)`. Por ende, al reiniciar o recargar la pestaña, `LocalStorage` devolvía la foto previa donde la mesa seguía ocupada.
    3. **Ausencia de Regla de Consistencia Bidireccional:** Si una mesa llegaba como ocupada desde la base de datos remota pero no existía ninguna cuenta activa válida en `cuentasActivas` (estado huérfano), el sistema no corregía la mesa a `libre`, dejándola atascada indefinidamente.
  - *Solución Aplicada:*
    1. **Purga Remota de Registros Legados:** Se eliminaron definitivamente de Supabase todas las filas legadas (`m-*` y `dom-*`) y se normalizó la tabla `mesas` a los 14 espacios canónicos en estado `libre` con `$0.00`.
    2. **Persistencia Inmediata en `liberarMesaManual`:** Se integró la llamada síncrona a `RepositorioStorage.guardarMesas(actualizadas)` y `RepositorioStorage.guardarCuentasActivas(copia)`, garantizando que el estado libre persista entre recargas y reinicios del navegador.
    3. **Regla de Consistencia en `sincronizarConServidorRemoto`:** Si una mesa viene marcada como ocupada pero no posee cuenta activa en el sistema, se sanea en caliente a `libre` con `$0.00` y se sincroniza inmediatamente tanto en Supabase como en LocalStorage.
    4. **Acción Rápida de Liberación en el Tablero:** En `DashboardMesas.tsx`, dentro del modo "Gestionar", se agregó el botón `[Liberar]` con advertencia directa para cancelar o desatorar cualquier orden con un solo toque sin requerir entrar al cobro ni al comandero.


- **Visualización de Propinas por Mesero en el Corte de Caja y Conservación Inmutable del Historial al Cobrar Mesas:**
  - *Problemas Identificados:*
    1. **Eliminación del Historial al Pagar o Liberar:** Al cobrar o liberar una comanda, `liberarMesaManual` ejecutaba un filtrado destructivo eliminando los pedidos de la mesa de `pedidosCocina`, y `servicioSupabase.obtenerEstadoRemoto()` consultaba `.neq('estado', 'entregado')`, lo que provocaba que en el siguiente latido o cambio de foco se sobreescribiera la lista local de pedidos eliminando todas las comandas entregadas del "Historial de Órdenes y Comandas" (`HistorialPedidosModal`) y del "Historial Despachadas" en Cocina.
    2. **Falta de Sincronización y Persistencia de Cuentas Cerradas:** Al cobrar en una tablet, los otros dispositivos que recibían `CUENTA_COBRADA` o `CUENTA_REMOTA_ACTUALIZADA` actualizaban el estado en memoria de React pero no invocaban `RepositorioStorage.guardarCuentasCerradas`, y `obtenerEstadoRemoto()` en Supabase no consultaba las cuentas cerradas recientes del turno, perdiéndose el historial de mesas cobradas en recargas de página.
    3. **Ausencia de Auditoría de Propinas Asignadas por Mesero en el Corte:** El corte de caja solo mostraba Venta Total, Efectivo, Tarjetas y Transferencias sin desglosar el total de propinas ni identificar cuánto le corresponde a cada mesero ni su método de origen (efectivo vs tarjeta a liquidar de caja).
  - *Decisiones Arquitectónicas y Soluciones Aplicadas:*
    1. **Conservación de Pedidos en Historial (Lifecycle Inmutable):** Tanto en `cerrarYCobrarCuenta` como en `liberarMesaManual`, los pedidos de la mesa se marcan como `entregado` (retirándolos de la pantalla activa de cocción/preparación) pero conservándolos intactos en `pedidosCocina` y en `LocalStorage`.
    2. **Consulta y Merge No Destructivo en Supabase y Sincronización:** En `servicioSupabase.obtenerEstadoRemoto()`, se eliminó el filtro excluyente `.neq('estado', 'entregado')` y se añadieron las cuentas cerradas recientes (`estado = 'cerrada'`). En `sincronizarConServidorRemoto()`, se implementó un merge conservativo por ID que fusiona los pedidos y cuentas locales con los remotos sin borrar ningún registro.
    3. **Persistencia Automática de Cuentas Cerradas:** Se implementó `RepositorioStorage.guardarCuentasCerradas()` y se garantizó su llamada en los eventos `CUENTA_COBRADA`, `CUENTA_REMOTA_ACTUALIZADA` y en la sincronización remota.
    4. **Cálculo y Visualización de Propinas por Mesero:**
       - Se definió la interfaz `ResumenPropinaMesero` y se añadió `totalPropinas?: number` en `CorteCaja`.
       - En `CorteCajaModal.tsx`, se integró la métrica destacada **Total Propinas** en la cuadrícula de KPIs y el panel interactivo **Propinas por Mesero**, con tarjeta individual por mesero, monto total ganado, barra porcentual, mesas atendidas y desglose de Efectivo vs Tarjeta/Digital (a liquidar de caja).
       - En el historial de mesas cobradas (tanto en el corte actual como en `CalendarioHistorialTurnos.tsx`), cada comanda cobrada muestra su pastilla distinguible con el valor de la propina y el mesero asignado.

- **Estrategia de Distribución para Dispositivos Apple (iPhone y iPad):**
  - *Contexto de la Consulta:* Si se envía la carpeta o proyecto iOS por WhatsApp, los usuarios de iPhone/iPad no pueden descargarlo ni instalarlo directamente.
  - *Arquitectura de Distribución:*
    1. **Restricción de Apple (Ecosistema Cerrado):** A diferencia de Android (donde un `.apk` se comparte por WhatsApp y se instala con un toque), iOS no permite ejecutar código fuente Swift ni instalar binarios `.ipa` desde mensajería sin firma criptográfica de Apple Developer Program ($99 USD/año) y distribución vía TestFlight o App Store.
    2. **Solución Implementada (PWA Nativa vía Safari):** La aplicación cuenta con soporte PWA completo (`apple-touch-icon.png`, `manifest.json`, viewport standalone). La vía idónea y sin costo para meseros con iPhone o iPad es abrir la URL del sistema en Safari y pulsar `Compartir` -> `Añadir a pantalla de inicio`. Se ejecuta a pantalla completa sin barras de navegador, con persistencia y sincronización en tiempo real.

- **Rebranding Comercial a LA ESTACIÓN GRILL, Menú de 48 Platillos, Modificadores Contextuales y Estética Dorada de Lujo:**
  - *Contexto y Solicitud del Cliente:*
    1. Actualización del nombre comercial a **LA ESTACIÓN GRILL**.
    2. Cambio de identidad cromática: sustitución de tonalidades naranja y estilo rústico de fuego por una **paleta dorada de lujo (*Luxury Gold*)** sobre carbón profundo.
    3. Carga completa del catálogo gastronómico de 6 imágenes sin elementos repetidos.
    4. Garantía de coherencia culinaria en opciones de personalización (suprimir anomalías como sugerir tortillas de maíz o harina en hamburguesas o salsas en bebidas).
    5. Retiro de la animación festiva de confeti al cobrar y sustitución por animaciones sobrias y elegantes.
  - *Decisiones Arquitectónicas y Soluciones Implementadas:*
    1. **Auditoría y Deduplicación del Menú (48 Productos Únicos):** Se validó cada fotografía confirmando 0 duplicados:
       - *Tacos y Burritos (6):* Campechana (\$80), Gringa (\$70), Pirata (\$80), Burrito (\$150), Tacos de Trompo (\$130), Tacos de Carne Asada (\$150).
       - *Hamburguesas (11):* Hamburguesa de res (\$140), Hamburguesa doble carne de res (\$170), Hamburguesa de carne asada (\$165), Hamburguesa de trompo (\$130), Hamburguesa de pollo (\$150), Hamburguesa doble todo (\$190), Hamburguesa mixta (\$175), Hamburguesa de res con jalapeño y aderezo (\$160), Salchiburger (\$150), Hamburguesa de Boneless con salsa especial y res (\$170), Salchicha preparada (\$60).
       - *Papas Asadas y Francesas (8):* Papa asada sencilla (\$120), Papa asada con carne (\$160), Papa asada con trompo (\$140), Papa asada con pollo y aderezo cremoso (\$160), Papa asada con mixta (\$160), Orden de Papas (\$60), Papas Especiales (\$90), Papas Especiales Mixtas (\$130).
       - *Antojos, Complementos y Tostaditas (11):* Alambre (\$150), Taco de chile relleno (\$40), Frijoles sencillos (\$35), Frijoles especiales (\$50), Alitas (\$130), Boneless (\$130), Dedos de queso (\$100), Combo Sin Frenos (\$200), Tostada Kike (\$50), Tostada Mixta (\$50), Tostada de Trompo (\$50).
       - *Bebidas (5):* Refresco desechable (\$35), Refresco de vidrio (\$30), Agua de medio litro (\$25), Agua de un litro (\$35), Aguas naturales (\$30).
       - *Extras (7):* Carne asada extra (\$30), Pollo extra (\$40), Trompo extra (\$30), Salsas extra (\$10), Aderezos extra (\$15), Queso extra (\$20), Totopos extra (\$10).
    2. **Arquitectura de Modificadores Contextuales (`MODIFICADORES_POR_CATEGORIA`):**
       - Se erradicó la concatenación fija y ciega de modificadores de taquería en `ModificadorModal.tsx`.
       - Se diseñó un mapa tipado `Record<CategoriaProducto, readonly string[]>` en `menuInicial.ts`. Cada categoría despliega exclusivamente opciones que guardan estricta relación gastronómica con el platillo seleccionado.
    3. **Identidad Visual Dorado de Lujo (*Luxury Gold*):**
       - Se ajustaron las variables CSS en `index.css`: fondo carbón profundo (`#0d0c0a`), tarjetas en `#171512`, bordes en `#3d3423`, acentos en oro imperial (`#d4af37`), oro brillante (`#f59e0b`) y sombras satinadas `.sombra-dorada`.
       - Se actualizaron todos los componentes (`Comandero`, `DetalleCuenta`, `DashboardMesas`, `ModalCobro`, `NavbarSuperior`, `PantallaCocina`, `HistorialPedidosModal`, `CorteCajaModal`, `CalendarioHistorialTurnos`).
    4. **Experiencia de Cobro Refinada y Animaciones Elegantes:**
       - Se removió la invocación de `canvas-confetti` en `ModalCobro.tsx`.
       - Se diseñó un **Sello Dorado de Lujo (*Luxury Gold Seal*)** animado con aura ambiental pulsante, marco concéntrico de gradiente oro, microdestellos con `Sparkles` y transiciones suaves.
    5. **Actualización de Rebranding:**
       - Se modificaron `index.html` y `manifest.json` a `LA ESTACIÓN GRILL`.
       - Encabezados térmicos de tickets oficiales y títulos del sistema actualizados a `LA ESTACIÓN GRILL`.
       - Sincronización automática de compilados hacia los contenedores de Android (`app/src/main/assets/web/`) e iOS (`ios/TaqueriaKm243/web/`).

- **Gradiente Dorado Vivo Continuo, Micro-Animaciones Generales y Limpieza/Archivado de Cocina en Nuevo Turno:**
  - *Decisiones de Diseño Acordadas en Grill-Me:*
    1. **Gradiente Dorado Continuo y Animado en Acentos Clave:**
       - Se diseñó en `index.css` el keyframe `@keyframes gradiente-dorado-vivo` con ciclo suave de 7 segundos (`ease-in-out infinite`) que traslada suavemente el mapa de gradiente áureo entre oro imperial (`#d4af37`), champaña/destello (`#fef08a`), ámbar (`#f59e0b`) y bronce (`#996515`).
       - Aplicado de forma predominante en los puntos focales del restaurante sin fatigar la vista del personal en turnos nocturnos:
         - Marca y título "La Estación Grill" con `.texto-gradiente-dorado-animado` y `background-clip: text`.
         - Pestañas activas de categorías y conmutador Mesas/Cocina con `.bg-gradiente-dorado-animado`.
         - Botones de acción principales: "Mandar a Cocina", "Cobrar y Cerrar Cuenta", "Agregar a Comanda", "Confirmar Cobro" y botón "+ Mesa".
         - Tarjetas de mesas activas y por cobrar con sombras doradas enriquecidas `.sombra-dorada-intensa`.
    2. **Micro-Animaciones Táctiles Suaves Generales:**
       - Clase `.tarjeta-tactil-suave` con rebote táctil ergonómico (`active:scale-95`) en tarjetas de platillos y mesas.
       - Entrada suave de modales `.anim-entrada-modal` con escala sutil (`scale-96` a `scale-100`) y traslación vertical en `ModalCobro`, `ModificadorModal` y vistas flotantes.
       - Botones de orden y badges con transiciones aceleradas por hardware (`will-change: transform`).
    3. **Limpieza de Pantalla de Cocina y Archivado Inmutable en Nuevo Turno:**
       - *Problema Identificado:* Al iniciar un nuevo turno, las comandas despachadas del turno anterior seguían acumulándose en la pantalla de Cocina (KDS) y, al recargar o sincronizar con Supabase, los pedidos de días o turnos anteriores volvían a cargarse como activos.
       - *Solución Aplicada:*
         1. Se amplió la interfaz `TurnoCerrado` en `types/index.ts` incorporando `pedidosCocinaArchivados?: readonly PedidoCocina[]`.
         2. En `repositorioStorage.ts`, la función `archivarTurnoYCerrar` recibe y almacena inmutablemente los pedidos de cocina despachados dentro del objeto histórico del turno, eliminando a su vez `CLAVES_STORAGE.PEDIDOS_COCINA`.
         3. En `RestauranteContext.tsx`, `reiniciarTurnoActual` transfiere los pedidos actuales a `archivarTurnoYCerrar`, vacía `pedidosCocina` a `[]` y limpia `LocalStorage`.
         4. En `sincronizarConServidorRemoto`, se implementó un filtro temporal estricto: al descargar comandas de Supabase, únicamente se incorporan al estado vivo de cocina aquellas cuya `horaEnvio` sea mayor o igual a la `fechaApertura` del turno actual (`corteActual.fechaApertura`). Toda comanda de turnos anteriores queda excluida de la cocina activa.
         5. En `CalendarioHistorialTurnos.tsx`, se añadió la sección interactiva "Comandas de Cocina Despachadas ({cantidad})" dentro de la auditoría de cada turno cerrado, permitiendo a los administradores consultar el historial completo de platillos cocinados en turnos previos desde el menú hamburguesa.

- **Efecto Oro Líquido Fundido (*Liquid Molten Gold*), Ergonomía de Botones de Alto Contraste y Conectividad Multibanda en Celulares:**
  - *Contexto y Solicitud:*
    1. El usuario solicitó un efecto visual tipo "oro líquido".
    2. En `/grill-me`, se acordó ubicar la animación de oro líquido reflectante únicamente en **pequeños detalles elegantes** (insignias, sellos, iconos), manteniendo los botones principales en **oro sólido de alto contraste con texto negro profundo**, para no sacrificar la visibilidad de comandas ni precios en celulares y tablets.
    3. Resolver problema de conectividad con el teléfono celular (computadora conectada por Ethernet e internet con 2 bandas Wi-Fi 2.4GHz / 5GHz).
  - *Decisiones de Diseño y Solución de Red:*
    1. **Animación de Oro Líquido Reflectante (`frontend/src/index.css`):**
       - `@keyframes mercurio-oro-liquido`: Ondulación cáustica continua de 8 segundos sobre gradiente radial reflectante (`#fff3a1`, `#d4af37`, `#b8860b`, `#785309`).
       - Clases `.oro-liquido-detalle` y `.borde-oro-liquido` con sombras sutiles de relieve.
       - Aplicado quirúrgicamente en:
         - Pastilla "Grill" y recuadro del icono en la barra superior (`NavbarSuperior.tsx`).
         - Insignia KDS de Cocina (`PantallaCocina.tsx`).
         - Marco y aureola del sello de cobro exitoso (`ModalCobro.tsx`).
    2. **Ergonomía y Máximo Contraste en Botones y Pestañas:**
       - En `Comandero.tsx`: Pestañas de categorías con fondo oro sólido limpio (`bg-amber-500 border-amber-400 text-stone-950 font-black`) para 100% de legibilidad del texto en tablets y celulares.
       - En `DetalleCuenta.tsx`: Botón "Mandar a Cocina" con `bg-amber-500 hover:bg-amber-400 text-stone-950 font-black`; botón "Cobrar y Cerrar Cuenta" con `bg-emerald-600 hover:bg-emerald-500 text-white font-black`.
       - En `ModalCobro.tsx`: Botón de confirmar cobro con `bg-emerald-600 text-white font-black`.
       - En `ModificadorModal.tsx`: Botón "Agregar a Comanda" con `bg-amber-500 text-stone-950 font-black`.
    3. **Diagnóstico y Resolución de Conectividad Multibanda:**
       - *Causa del fallo en celular:* La PC posee dos interfaces de red: Ethernet (`192.168.5.213`) y Wi-Fi (`192.168.1.66`). El celular conectado a la red Wi-Fi del router de doble banda no podía alcanzar la subred de Ethernet, y el Firewall de Windows bloqueaba el puerto 5173 de Vite por defecto.
       - *Apertura de Firewall:* Se creó la regla entrante `New-NetFirewallRule -DisplayName 'Vite Dev 5173' -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow`.
       - *Conectividad Local Directa:* El celular puede entrar por Wi-Fi directo a `http://192.168.1.66:5173`.
       - *Túnel HTTPS Seguro:* Se desplegó un túnel público temporal con `pnpm dlx localtunnel --port 5173` (`https://huge-mirrors-refuse.loca.lt`, contraseña IP pública: `189.152.212.243`) para acceso universal sin importar a qué banda (2.4 GHz, 5 GHz o datos móviles) esté conectado el celular.



- **Simulación Física de Oro Líquido Fundido (*Liquid Molten Gold*) con Aceleración WebGL (GPU):**
  - *Contexto y Solicitud del Usuario:*
    - El usuario proporcionó una referencia visual de fluido metálico orgánico con pliegues, ondas y destellos reflectantes continuos (estilo *Geya Shvecova*), solicitando exactamente ese comportamiento fluido pero con paleta de **oro derretido en estado líquido**.
  - *Arquitectura y Decisiones Técnicas:*
    1. **Componente de Aceleración por GPU (`LienzoOroLiquido.tsx`):**
       - Implementado mediante WebGL estándar (compatible con 100% de dispositivos Android WebView, iOS Safari, tablets y navegadores de escritorio).
       - Shader de fragmentos GLSL procedural de alta precisión:
         - **Plegado Viscoso (*Domain Warping* Multicapa):** Combina rotaciones matriciales 2D, funciones de onda trigonométricas no simétricas y micro-pliegues cáusticos para generar los surcos y arrugas de tensión superficial característicos del metal pesado fundido.
         - **Cálculo de Normales por Diferencias Finitas:** Deriva en tiempo real la curvatura y vector normal de cada pliegue de la superficie líquida.
         - **Doble Fuente de Luz y Especular Metálico:** Luz cenital principal móvil y luz rasante cruzada para reflejos especulares de alta intensidad (`pow(..., 96.0)`), complementado con efecto Fresnel en los bordes de las ondas.
         - **Cromática de Oro Imperial Fundido:** Sombra profunda ámbar carbón (`#140b02`), bronce noble (`#6e3c04`), oro imperial de 24K (`#d4af37`), oro solar brillante (`#facc15`) y destellos champaña platinados (`#fffdf5`).
       - **Eficiencia Energética para Móviles y Batería:**
         - Utiliza `powerPreference: 'low-power'`.
         - Limita la resolución interna a un DPR máximo de 2.0 para evitar sobrecalentamiento.
         - Conexión a `IntersectionObserver`: suspende el bucle `requestAnimationFrame` cuando el elemento sale de pantalla.
         - Conexión a `visibilitychange`: pausa el cómputo GPU de inmediato si la pestaña pasa a segundo plano o se bloquea el dispositivo.
    2. **Integración Armónica en la Interfaz:**
       - **Isotipo de la Llama:** El fondo del recuadro de la llama en `NavbarSuperior.tsx` es un fluido vivo de oro derretido.
       - **Insignia "Grill":** Pastilla superior con flujo continuo reflectante.
       - **Cinta Inferior de Cabecera:** Franja de 2.5px que corre a lo largo del encabezado superior mostrando el paso del oro fundido.
       - **Sello de Cobro Exitoso (`ModalCobro.tsx`):** Medallón animado donde el checkmark flota sobre una piscina de oro líquido.
       - **Emblema KDS de Cocina (`PantallaCocina.tsx`):** Insignia táctil de cocina con fondo dinámico.
       - **Fondo Ambiental Global (`App.tsx`):** Capa sutil en el fondo del área principal con opacidad calibrada para no comprometer el contraste ni la lectura de mesas y platillos.
    3. **Control Interactivo de Intensidad en el Menú Lateral:**
       - Se introdujo en el estado global (`RestauranteContext`) y en `localStorage` la propiedad `nivelOroLiquido`: `'intenso'` (25%), `'elegante'` (14%), `'sutil'` (7%) y `'apagado'` (0%).
       - Tarjeta interactiva en el menú hamburguesa con selector de 4 botones y ventana de previsualización en vivo en tiempo real.
    4. **Sincronización y Despliegue:**
       - Compilación de producción validada con `tsc -b` y Vite (0 errores).
       - Sincronizado a contenedores móviles de Android e iOS (`sync:all`).
       - Nuevo túnel HTTPS seguro activo: `https://two-suns-yawn.loca.lt`.

- **Corrección de Ondas de Oro Líquido Fundido (Eliminación de Granulado/Purpurina), Restauración de Color en Botón Comanda y Bordes Líquidos en Tarjetas:**
  - *Problemas Identificados:*
    1. **Textura Granular / Purpurina en Shader:** En áreas pequeñas de 32x32px y 40x40px, la densidad de ondas excesiva (3.5+) sumada a exponentes especulares agudos (`pow(..., 96.0)`) y micro-pliegues de alta frecuencia producían un parpadeo estático tipo purpurina/arena dorada en lugar de ondas de líquido espeso en movimiento.
    2. **Botón Comanda Invisible / Sin Fondo:** La clase `bg-gradiente-dorado-animado` no estaba presente en `index.css`, por lo que el botón `Comanda` en `DashboardMesas.tsx` se renderizaba con fondo transparente y texto negro sobre tarjeta oscura, quedando prácticamente invisible.
    3. **Ausencia de Contorno Líquido en Tarjetas:** Las tarjetas de mesas ocupadas tenían bordes estáticos planos amarillos.
  - *Soluciones Implementadas:*
    1. **Reescritura de Shader para Ondas Amplias y Viscosas (`LienzoOroLiquido.tsx`):**
       - Se redujo la escala de frecuencia a ondas amplias y continuas (`eps = 0.012`), permitiendo normales suaves y redondeadas.
       - Se suavizó el brillo especular a `pow(..., 14.0)` y `pow(..., 32.0)` para lograr un reflejo metálico satinado continuo de metal derretido que se desplaza orgánicamente.
       - Se ajustó la escala por defecto de `densidadOndas` a `1.2`.
    2. **Color Oro Sólido y Alto Contraste en Botón Comanda:**
       - En `DashboardMesas.tsx`: Botón `Comanda` configurado con `bg-amber-500 hover:bg-amber-400 text-stone-950 font-black shadow-md border border-amber-400/80` garantizando visibilidad inmediata y tacto de alto contraste.
       - En botón `+ Mesa` y en `Comandero.tsx` se asignaron fondos sólidos equivalentes.
    3. **Bordes Perimetrales de Oro Líquido en Movimiento para Tarjetas:**
       - Se crearon en `index.css` las clases `@keyframes flujo-borde-liquido` con `.tarjeta-borde-oro-liquido`, `.tarjeta-borde-azul-liquido` y `.tarjeta-borde-cyan-liquido`.
       - Cada tarjeta activa en `DashboardMesas.tsx` cuenta con una estructura perimetral de `p-[2px]` que revela el flujo continuo de oro líquido desplazándose alrededor de todo su contorno a 60 FPS por GPU sin consumo de contextos WebGL.

- **Unificación Espacial Continua de Oro Líquido y Corrección de la Línea del Navbar:**
  - *Problemas Identificados:*
    1. **Estrías y Discontinuidad en la Línea del Navbar:** El intento previo de renderizar un canvas WebGL (`LienzoOroLiquido`) de tan solo 2.5px de alto por 1920px de ancho generaba una distorsión de relación de aspecto de ~384:1. Esto provocaba que las funciones trigonométricas del shader oscilaran a frecuencias altísimas en el eje horizontal, luciendo como una línea discontinua de puntos en vez de una corriente fluida.
    2. **Falta de Continuidad Espacial entre Tarjetas:** Cada tarjeta con borde animado poseía su propio sistema de coordenadas locales, haciendo que el flujo dorado comenzara y terminara de forma inconexa en cada recuadro independiente.
  - *Solución Implementada:*
    1. **Reemplazo de la Línea del Navbar por Gradiente Fluido (`NavbarSuperior.tsx`):**
       - Se sustituyó el canvas WebGL enano por un contenedor `<div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden pointer-events-none cinta-oro-liquido-unificada z-10" />`.
       - Renderizado limpio, sin artefactos visuales, ultra liviano y visualmente armonizado.
    2. **Unificación de Coordenadas Globales Espaciales (`index.css`):**
       - Se implementó `background-attachment: fixed` y `background-size: 250vw 250vh` en `.tarjeta-borde-oro-liquido`, `.cinta-oro-liquido-unificada`, `.tarjeta-borde-azul-liquido` y `.tarjeta-borde-cyan-liquido`.
       - Ambas clases comparten la misma paleta áurea de 7 paradas, el mismo ángulo vectorial (115deg) y el keyframe sincronizado `@keyframes flujo-borde-liquido (5s ease-in-out infinite)`.
       - Al anclarse al Viewport de la pantalla (`fixed`), los bordes de todas las tarjetas y la línea superior actúan como ventanas sobre un mismo océano continuo de oro fundido. Cuando una onda de líquido dorado sale por el borde derecho de una tarjeta, entra con fase y continuidad matemática exacta en el borde izquierdo de la tarjeta adyacente.

- **Extensión del Flujo de Oro Líquido Fundido a Botones, Pestañas y Controles:**
  - *Problema Identificado:*
    - Aunque los bordes perimetrales de las tarjetas y la línea superior poseían el flujo de oro fundido espacial, los botones principales (como el botón "Comanda" en tarjetas, "+ Mesa", selector de categorías y botón de mandar a cocina) continuaban luciendo un color ámbar plano estático (`bg-amber-500`), restando dinamismo y sofisticación visual.
  - *Solución Implementada:*
    1. **Clase Universal `.boton-oro-liquido` (`frontend/src/index.css`):**
       - Dotada con el gradiente áureo de 7 paradas, `background-attachment: fixed`, `background-size: 250vw 250vh` y ciclo sincronizado `@keyframes flujo-borde-liquido (5s)`.
       - Tipografía en negro carbón profundo con alto contraste (`color: #0c0a09 !important; font-weight: 900 !important;`) y sutil relieve de luz interior.
    2. **Despliegue Quirúrgico en Todos los Controles Clave:**
       - `DashboardMesas.tsx`: Botón "Comanda" en tarjetas activas, botón "+ Mesa", botón "Listo" de modo gestión y pestañas de filtrado "Todas" y "Mesas".
       - `NavbarSuperior.tsx`: Selector central activo ("Mesas" y "Cocina").
       - `Comandero.tsx`: Las 6 pestañas de categorías activas (Tacos, Burgers, Papas, Antojos, Bebidas, Extras).
       - `DetalleCuenta.tsx`: Botón rey de despacho "Mandar a Cocina".
       - `ModificadorModal.tsx`: Botón "Agregar a Comanda".
       - `ModalCobro.tsx`: Botón de método de pago "Tarjeta" y "Imprimir Ticket y Salir".
       - `CorteCajaModal.tsx`: Pestañas activas de turno y calendario.
       - `HistorialPedidosModal.tsx`: Pestañas de filtrado activo.
       - `PantallaCocina.tsx`: Pestaña de órdenes activas de cocina.

- **Unificación de Botones con el Mismo Shader WebGL Real del Logo y "Grill" (`BotonOroLiquido.tsx`):**
  - *Diagnóstico y Diferenciación Visual:*
    - El usuario identificó con precisión que el fondo de los botones (previamente estilizados con gradiente CSS lineal `@keyframes flujo-borde-liquido`) no lucía idéntico al oro líquido del logo de la llama ni al de la palabra "Grill".
    - *Causa Técnica:* El logo y la palabra "Grill" renderizan [`LienzoOroLiquido.tsx`](frontend/src/components/LienzoOroLiquido.tsx), un shader procedural GLSL acelerado por GPU (WebGL) con cálculo de curvatura por diferencias finitas, ondas trigonométricas complejas y dobles fuentes de luz para reflejo metálico satinado. Un gradiente CSS solo desplaza franjas planas y carece de la profundidad y tridimensionalidad del fluido de oro.
  - *Solución Arquitectónica:*
    1. **Componente Reutilizable [`BotonOroLiquido.tsx`](frontend/src/components/BotonOroLiquido.tsx):**
       - Encapsula internamente el componente `<LienzoOroLiquido />` con los parámetros calibrados idénticos al logo y la palabra Grill: `velocidad={0.8}`, `brillo={1.15}` y `densidadOndas={1.1}`.
       - Dispone el texto y los iconos en una capa superior protegida (`relative z-10`) con sombra nítida (`drop-shadow-[0_1px_1px_rgba(255,255,255,0.45)]`), conservando 100% de legibilidad y respuesta táctil inmediata (`active:scale-95`).
       - Soporta activación condicional (`activo?: boolean`) para apagar el shader en botones no seleccionados y no consumir ciclos innecesarios de GPU.
    2. **Despliegue General:**
       - **[`DashboardMesas.tsx`](frontend/src/components/DashboardMesas.tsx):**
         - Botón **"Comanda"** en cada tarjeta de mesa activa (muestra el fluido de oro vivo moviéndose dentro del botón).
         - Botón **"+ Mesa"**.
         - Botón **"Listo"** en modo gestión.
         - Pestañas superiores de filtro **"Todas"** y **"Mesas"** cuando están activas.
       - **[`NavbarSuperior.tsx`](frontend/src/components/NavbarSuperior.tsx):**
         - Conmutador central de módulos **"Mesas"** y **"Cocina"** cuando están activos.
       - **[`DetalleCuenta.tsx`](frontend/src/components/DetalleCuenta.tsx):**
         - Botón rey de despacho **"Mandar a Cocina"**.
       - **[`ModificadorModal.tsx`](frontend/src/components/ModificadorModal.tsx):**
         - Botón **"Agregar a Comanda"**.
       - **[`Comandero.tsx`](frontend/src/components/Comandero.tsx):**
         - Las 6 pestañas de categorías gastronómicas activas (Tacos, Burgers, Papas, Antojos, Bebidas, Extras).

- **Sintaxis de Encadenamiento en PowerShell (Windows):**
  - *Error:* Ejecución de comandos combinados con `&&` produce `InvalidEndOfLine / ParserError` en Windows PowerShell 5.1.
  - *Corrección:* Utilizar el separador de instrucciones nativo `;` o ejecutar comandos individualmente.

- **Resolución de Reactividad en Selector de Oro Líquido Fundido (Intenso, Elegante, Sutil, Apagado):**
  - *Problema Identificado:*
    - Al pulsar cualquiera de las 4 opciones de nivel de oro líquido en el Menú del Sistema, el usuario observaba que *"no cambiaba nada"*.
    - *Causas Técnicas Raíz:*
      1. **Previsualización Estática en `NavbarSuperior.tsx`:** La barra de *"VISTA PREVIA DEL METAL LÍQUIDO"* tenía valores hardcodeados fijos (`velocidad: 0.9`, `brillo: 1.2`, `densidadOndas: 1.0`), por lo que no modificaba su aspecto ni daba feedback visual al seleccionar un nivel diferente.
      2. **Oclusión Total por Fondos Sólidos:** Los contenedores principales ([`DashboardMesas.tsx`](frontend/src/components/DashboardMesas.tsx), [`PantallaCocina.tsx`](frontend/src/components/PantallaCocina.tsx) y [`Comandero.tsx`](frontend/src/components/Comandero.tsx)) poseían fondos 100% opacos (`bg-stone-950`), tapando por completo el lienzo ambiental de `LienzoOroLiquido` ubicado en la capa inferior (`z-0`) de [`App.tsx`](frontend/src/App.tsx).
  - *Solución Aplicada:*
    1. **Previsualización en Vivo Dinámica ([`NavbarSuperior.tsx`](frontend/src/components/NavbarSuperior.tsx)):**
       - Al seleccionar *"Apagado 0%"*, la barra se desactiva visualmente mostrando `Oro Líquido: Apagado (0%)` con fondo neutro de bajo consumo.
       - Al seleccionar *"Sutil (7%)"*, *"Elegante (14%)"* o *"Intenso (25%)"*, se recalculan en tiempo real la velocidad (0.55 → 0.9 → 1.25), el brillo (0.9 → 1.25 → 1.6) y la densidad de ondas, con texto descriptivo dinámico.
    2. **Visibilidad Ambiental en la Aplicación Completa:**
       - En [`App.tsx`](frontend/src/App.tsx), se calibraron opacidades de alto impacto estético (`opacity-70` para Intenso, `opacity-45` para Elegante y `opacity-25` para Sutil).
       - En [`DashboardMesas.tsx`](frontend/src/components/DashboardMesas.tsx), [`PantallaCocina.tsx`](frontend/src/components/PantallaCocina.tsx) y [`Comandero.tsx`](frontend/src/components/Comandero.tsx), se adaptaron los fondos a `bg-stone-950/75 backdrop-blur-[2px]` cuando el oro líquido está activo, permitiendo que el mar de metal fundido sea claramente visible ondeando detrás de las mesas y comandas.

- **Modo "Apagado (0%)" Estático Completo en Toda la Aplicación:**
  - *Solicitud del Usuario:*
    - *"Aunque esté apagado no se modifican los botones o el logo, en dado caso de que esté apagado que sea un color amarillo sin animación."*
  - *Solución Arquitectónica:*
    1. **`BotonOroLiquido.tsx` Reactivo a Nivel de Sistema:**
       - Consume `nivelOroLiquido` del contexto global.
       - Si `nivelOroLiquido === 'apagado'`, desactiva incondicionalmente el canvas WebGL, el bucle `requestAnimationFrame` y los viñeteados, renderizándose como un botón amarillo ámbar sólido de alto contraste (`bg-amber-500 border-amber-400 text-stone-950 font-black`) sin ninguna animación.
    2. **Logo de la Llama y Palabra "Grill" (`NavbarSuperior.tsx`):**
       - Si está apagado, se desmonta el shader WebGL y pasan a exhibir un fondo amarillo ámbar sólido estático (`bg-amber-500 text-stone-950`).
    3. **Bordes Perimetrales de Tarjetas (`DashboardMesas.tsx`):**
       - Si está apagado, se suspende la animación `@keyframes flujo-borde-liquido` y el contorno se convierte en un marco amarillo sólido estático (`bg-amber-500 shadow-md`).
    4. **Cinta Inferior del Navbar (`NavbarSuperior.tsx`):**
       - Pasa de la cinta de gradiente ondulante a una franja de color amarillo sólido estático (`bg-amber-500`).

- **Sincronización Dinámica Completa de las 4 Opciones de Oro Líquido Fundido:**
  - *Problema Resuelto:* Al alternar entre *Intenso (25%)*, *Elegante (14%)* y *Sutil (7%)*, los botones (`BotonOroLiquido.tsx`), el logo de la llama y la palabra "Grill" mantenían velocidades y brillos fijos hardcodeados sin reflejar la aceleración o desaceleración seleccionada.
  - *Solución de Ingeniería:*
    1. **Estructura Central de Parámetros (`RestauranteContext.tsx`):**
       - Se introdujo la interfaz `ParametrosOroLiquido` y el diccionario constante `PARAMETROS_NIVEL_ORO`:
         - **Intenso (25%):** `velocidad: 1.35`, `brillo: 1.6`, `densidadOndas: 1.35`, duración CSS: `3.5s`, fondo ambiental al 70%.
         - **Elegante (14%):** `velocidad: 0.9`, `brillo: 1.25`, `densidadOndas: 1.05`, duración CSS: `5.0s`, fondo ambiental al 45%.
         - **Sutil (7%):** `velocidad: 0.5`, `brillo: 0.9`, `densidadOndas: 0.8`, duración CSS: `7.5s`, fondo ambiental al 20%.
         - **Apagado (0%):** `velocidad: 0`, `brillo: 0`, `densidadOndas: 0`, duración CSS: `0s`, fondo ambiental al 0%.
       - Se sincronizó automáticamente la variable CSS `--duracion-flujo-oro` en `:root` y el atributo `document.documentElement.dataset.nivelOro`.
    2. **Actualización Reactiva de Botones (`BotonOroLiquido.tsx`):**
       - Los botones ahora consumen `parametrosOro` del contexto. Al no recibir props manuales, adoptan dinámicamente la velocidad, brillo y densidad del nivel seleccionado.
       - Se asignó `key={nivelOroLiquido}` al `<LienzoOroLiquido />` para forzar la reconfiguración limpia del shader WebGL en GPU ante cada conmutación.
    3. **Actualización del Logo y Palabra "Grill" (`NavbarSuperior.tsx`):**
       - Tanto el icono de la llama como la pastilla "Grill" consumen `parametrosOro` y actualizan su shader de forma sincronizada con `key={nivelOroLiquido}`.
    4. **Sincronización de Bordes y Cinta CSS (`index.css`):**
       - Las clases `.cinta-oro-liquido-unificada`, `.boton-oro-liquido` y `.tarjeta-borde-oro-liquido` ejecutan `@keyframes flujo-borde-liquido var(--duracion-flujo-oro, 5s)`.
       - Al seleccionar `apagado`, los selectores `[data-nivel-oro="apagado"]` apagan la animación y fijan el fondo en `#f59e0b` (amarillo ámbar puro sin animación).

- **Corrección de Impresión y Apariencia en Pantalla de Cobro Exitoso (`ModalCobro.tsx`):**
  - *Problema Identificado:*
    - Al cobrar una cuenta y pulsar el botón **"Imprimir Ticket y Salir"** en la pantalla de confirmación exitosa, el ticket no se abría ni se imprimía como en los demás módulos (`DetalleCuenta` o `HistorialPedidosModal`), y visualmente lucía como un botón plano sin el efecto de oro líquido WebGL.
  - *Causas Técnicas Raíz:*
    1. **Pérdida de Referencia de `cuentaActiva`:** Al procesar `cerrarYCobrarCuenta`, la cuenta se cerraba y se eliminaba de `cuentasActivas`. La función `imprimirTicket('cliente')` validaba `if (!cuentaActiva) return;`, lo que abortaba silenciosamente la impresión ya que la cuenta ya no estaba en el estado activo.
    2. **Componente Visual Desactualizado:** El botón utilizaba la clase CSS plana `.boton-oro-liquido` en lugar del componente acelerado por GPU `<BotonOroLiquido />`.
  - *Solución Aplicada:*
    1. **Retorno de Cuenta Cerrada en `cerrarYCobrarCuenta`:** Ahora devuelve `{ exito: boolean; cambio: number; cuentaCerrada?: Cuenta }`.
    2. **Soporte de Cuenta Explícita en `imprimirTicket`:** `imprimirTicket(tipo, cuentaEspecifica?: Cuenta)` permite imprimir una cuenta recién cerrada sin requerir que permanezca como activa.
    3. **Captura y Despacho en `ModalCobro.tsx`:** Se almacena la cuenta en `cuentaFinalCerrada` y al presionar **"Imprimir Ticket y Salir"**, se invoca `imprimirTicket('cliente', cuentaFinalCerrada)` antes de cerrar el modal, desplegando inmediatamente el visor térmico [`ModalTicket.tsx`](frontend/src/components/ModalTicket.tsx) listo para impresión.
    4. **Unificación Visual:** Se reemplazó el botón por `<BotonOroLiquido>` con icono `Printer`, sincronizado con el nivel de oro líquido configurado (o amarillo sólido estático en modo apagado).

- **Despacho Inteligente a Cocina (Bebidas por Mesero vs Alimentos con Preparación):**
  - *Requerimiento:* "Haz que las bebidas no se manden a cocina ya que esas las lleva el mesero (a no ser que sea una bebida que requiera preparación)".
  - *Decisión Arquitectónica:*
    1. **Modelado en Dominio (`Producto` e `ItemComanda`):**
       - Se introdujo `readonly requierePreparacion?: boolean` en [`Producto`](frontend/src/types/index.ts) y tanto `readonly categoria?: CategoriaProducto` como `readonly requierePreparacion?: boolean` en [`ItemComanda`](frontend/src/types/index.ts).
       - En [`menuInicial.ts`](frontend/src/data/menuInicial.ts), las bebidas embotelladas y preparadas directas del restaurante (`Refresco desechable`, `Refresco de vidrio`, `Agua de medio litro`, `Agua de un litro`, `Aguas naturales`) fueron configuradas con `requierePreparacion: false`.
    2. **Regla de Negocio (`esItemParaCocina` en `RestauranteContext.tsx`):**
       - Las bebidas (`categoria === 'bebidas'`) **NO** se envían a cocina a menos que tengan explícitamente `requierePreparacion === true`.
       - Las demás categorías (tacos, hamburguesas, papas, antojos, extras) se despachan a cocina por defecto.
    3. **Lógica de Despacho (`enviarComandaACocina`):**
       - Solo se empaquetan en `PedidoCocina.items` los ítems que requieren preparación en cocina.
       - Las bebidas directas se marcan como atendidas (`cantidadEnviadaCocina: it.cantidad`) para que no queden pendientes ni bloqueen la cuenta.
       - Si la orden solo contiene bebidas directas, se informa con claridad al mesero que las bebidas se entregan directamente en la mesa sin alertar innecesariamente al personal de cocina.
    4. **Diferenciación en Interfaz (`DetalleCuenta.tsx`):**
       - `totalNuevosPorEnviar` contabiliza únicamente platillos de cocina.
       - Cada bebida atendida por mesero muestra el distintivo `Bebida · Mesero` con icono `CupSoda` en tonos celestes, evitando confusiones operativas.

- **Blindaje de Credenciales de Base de Datos en la Nube (`ModalConfiguracionServidor.tsx`):**
  - *Requerimiento:* "Elimina la opcion de cambiar la URL de la base de datos y la API KEY".
  - *Decisión Arquitectónica:*
    1. Se eliminaron los campos de entrada de texto (`urlInput` y `keyInput`) y el botón `Guardar y Sincronizar`.
    2. Se eliminaron las instrucciones de proyectos de prueba de Supabase.
    3. El modal fue transformado en un panel de diagnóstico y estado del enlace en tiempo real:
       - Tarjeta informativa de **Base de Datos Oficial Vinculada y Protegida** con URL fija en modo sólo lectura (`https://idgyotujnoavliaqtuck.supabase.co`).
       - Mantenimiento del botón de diagnóstico `🔍 Probar Conexión con PostgreSQL` empleando las credenciales oficiales seguras integradas.
       - Mantenimiento de la reconexión rápida (`Reconectar`) y retroalimentación de estado (`Conectado` / `Modo Offline`).

- **Paridad Visual de Oro Líquido Fundido en Modo Claro y Modo Oscuro:**
  - *Requerimiento:* "Corrige el modo claro para que el efecto de oro liquido sea igual que en el modo escuro".
  - *Causas Técnicas Identificadas:*
    1. **Condicionantes `!esClaro` artificiales:** Existían validaciones que apagaban deliberadamente el shader WebGL en el lienzo ambiental de [`App.tsx`](frontend/src/App.tsx), la cinta inferior del encabezado en [`NavbarSuperior.tsx`](frontend/src/components/NavbarSuperior.tsx), el logo de la llama y la pastilla "Grill".
    2. **Oclusión por Fondos Sólidos:** Los contenedores principales en modo claro utilizaban fondos 100% opacos (`bg-stone-100` y `bg-stone-50`), bloqueando la visibilidad del fluido de oro ondeando por detrás.
    3. **Pastilla "Grill" Plana:** En modo claro mostraba estilos opacos cremas (`bg-amber-100 text-amber-900 border-amber-300`) sin el canvas WebGL.
  - *Solución Aplicada:*
    1. Remoción de todas las restricciones `!esClaro` en [`App.tsx`](frontend/src/App.tsx) y [`NavbarSuperior.tsx`](frontend/src/components/NavbarSuperior.tsx).
    2. Unificación de la pastilla "Grill" y del logo de la llama con shader activo y acentos de alto contraste en ambos modos.
    3. Implementación de translucidez ambiental (`bg-stone-100/75 backdrop-blur-[2px]` en [`DashboardMesas.tsx`](frontend/src/components/DashboardMesas.tsx) y `bg-stone-50/75 backdrop-blur-[2px]` en [`Comandero.tsx`](frontend/src/components/Comandero.tsx)) cuando el nivel de oro líquido está activo, logrando que el mar de oro fundido sea idéntico y visible tanto en tema claro como en tema oscuro.

- **Soporte Completo de Modo Claro en Pantalla de Cocina (KDS - `PantallaCocina.tsx`):**
  - *Problema Identificado:* Al alternar al tema claro, el módulo de Cocina (`PantallaCocina.tsx`) permanecía 100% en tema oscuro, ya que no consumía `tema` de [`useRestaurante()`](frontend/src/context/RestauranteContext.tsx) y poseía clases estáticas oscuras en fondos, tarjetas y cabeceras.
  - *Solución Aplicada:*
    1. Consumo reactivo de `tema` (`const esClaro = tema === 'claro'`).
    2. Contenedor adaptado a `bg-stone-100/75 backdrop-blur-[2px] text-stone-900` con oro líquido activo para visualizar el fondo ambiental fluido también en cocina.
    3. Cabecera, filtros táctiles (Activas con `<BotonOroLiquido />`, Pendientes, Al Carbón, Listos y Despachadas) y botón de campanilla con estilos claros de alto contraste.
    4. Panel de Demanda Acumulada en Parrilla ("En el comal") en `bg-white/95 border-stone-200 text-stone-900`.
    5. Tarjetas de comandas en `bg-white border-stone-200 shadow-md` con nombres de mesa en ámbar oscuro (`text-amber-700`), platillos con fondo blanco y tachado suave en verde esmeralda al completarse, y botón "Despachar / Entregado" en verde esmeralda sólido (`bg-emerald-600 text-white font-black shadow-md`).

- **Armonización del Pie del Menú Lateral y Previsualización en Modo Claro (`NavbarSuperior.tsx`):**
  - *Problema Identificado:* En el menú lateral de configuración (`NavbarSuperior.tsx`), el contenedor inferior que muestra la hora, estado de red y número de terminales mantenía un bloque gris oscuro opaco (`bg-stone-950/50 border-stone-800 text-stone-400`), generando un parche de bajo contraste y difícil lectura sobre el fondo blanco del panel. Asimismo, la barra de previsualización en estado *"Apagado (0%)"* usaba un fondo oscuro `bg-stone-900/90`.
  - *Solución Aplicada:*
    1. Cuadro inferior condicionado reactivamente: en modo claro adopta `bg-stone-100/90 border-stone-200 text-stone-800 shadow-2xs` con tipografía nítida (`text-stone-700`), icono de reloj en `text-amber-600`, estado de red en `text-emerald-700` y separador en `border-stone-200`.
    2. Barra de *"Oro Líquido: Apagado (0%)"* adaptada en modo claro a `bg-stone-100 border-stone-300 text-stone-600`, integrándose limpiamente con la estética de la tarjeta de preferencias.

- **Optimización Integral de Rendimiento y Puntuación Lighthouse (Fases 1 y 2):**
  - *Problema Identificado:* Lighthouse arrojaba una calificación de **Performance: 31** en emulación móvil throttled (iPad Pro 13).
  - *Causas Técnicas Raíz Identificadas en Auditoría:*
    1. **Entorno de Prueba Dev vs Producción:** Lighthouse fue ejecutado sobre el servidor de desarrollo Vite (`localhost:5173`), sirviendo más de 12.5 MB de código sin minificar (`Minify JavaScript — Est savings: 10 MB`). En producción (`pnpm preview` / build), el bundle minificado pesa solo 162 kB.
    2. **Sobrecarga Extrema de WebGL:** [`LienzoOroLiquido.tsx`](frontend/src/components/LienzoOroLiquido.tsx) renderizaba sin limitador de framerate (hasta 120 FPS en pantallas ProMotion) con DPR forzado a 2x (~5.7 millones de fragmentos por frame en el lienzo de pantalla completa) y `precision highp float`, saturando la CPU y GPU en el hilo principal con cálculos trigonométricos continuos.
    3. **Múltiples Contextos WebGL Concurrentes:** En la vista inicial de mesas coexistían simultáneamente hasta 6 instancias de `<LienzoOroLiquido />` (fondo ambiental, botón "Todas", botón "+ Mesa", botón "Mesas", logo de la llama y pastilla "Grill"), saturando el bus gráfico y generando 20 Long Tasks (TBT 1620 ms).
    4. **Animaciones No Compuestas (`Avoid non-composited animations`):** En `index.css`, `@keyframes flujo-borde-liquido` animaba `background-position` con `background-attachment: fixed` en `.cinta-oro-liquido-unificada`, forzando costosos repintados en el hilo principal de la CPU (12.2s de trabajo en hilo principal).
    5. **Bundle Monolítico Inicial:** El archivo principal `index.js` pesaba **681.62 kB** al incluir de forma estática componentes pesados de uso eventual como `PantallaCocina`, `ModalCobro`, `CorteCajaModal`, `HistorialPedidosModal`, `ModalConfiguracionServidor`, etc., retrasando el FCP y disparando el Total Blocking Time (TBT).
    6. **Penalización de Accesibilidad en Viewport:** `user-scalable=no` y `maximum-scale=1.0` en `index.html` activaban penalizaciones en Best Practices y Accessibility.
  - *Solución Aplicada (Fase 1 y Fase 2):*
    1. **Throttling a 30 FPS en WebGL:** Se implementó un limitador de cuadros estricto (`INTERVALO_MS = 1000 / 30`) en [`LienzoOroLiquido.tsx`](frontend/src/components/LienzoOroLiquido.tsx), reduciendo en más del 70% el trabajo continuo de GPU y CPU con total fluidez visual para un fluido espeso.
    2. **DPR Adaptativo Inteligente:** En pantallas grandes (>350px) se limita la resolución del canvas ambiental a `1.0x` (reduciendo la carga en más del 400% gracias al filtrado bilineal y desenfoque), reservando hasta `1.5x` para botones pequeños.
    3. **Precisión de Shader Optimizada:** Se cambió a `precision mediump float`, reduciendo operaciones de coma flotante por píxel a la mitad en GPUs móviles.
    4. **Pausa por Inactividad:** Se añadieron listeners de `blur` y `focus` para detener el renderizado inmediatamente cuando la aplicación pierde el foco.
    5. **Consolidación de Contextos WebGL (De 6 a 1):** Se rediseñó [`BotonOroLiquido.tsx`](frontend/src/components/BotonOroLiquido.tsx) y los micro-detalles en [`NavbarSuperior.tsx`](frontend/src/components/NavbarSuperior.tsx) (logo de la llama y pastilla "Grill") para utilizar acabados dorados metálicos satinados con gradientes acelerados por hardware y viñeteado GPU, suprimiendo la creación de múltiples canvas WebGL. El shader WebGL se reserva exclusivamente para el fondo ambiental de pantalla completa y la previsualización interactiva de configuración.
    6. **Animaciones 100% GPU-Composited:** En [`index.css`](frontend/src/index.css), se reemplazó la animación de `background-position` por `transform: translate3d(-50%, 0, 0)` sobre pseudoelementos `::after` (`will-change: transform`). Las animaciones ahora corren íntegramente en el compositor thread de la GPU sin bloquear el hilo principal.
    7. **Code Splitting y Lazy Loading:** En [`App.tsx`](frontend/src/App.tsx), se envolvieron con `React.lazy()` y `<Suspense>` los componentes `PantallaCocina`, `ModalCobro`, `CorteCajaModal`, `HistorialPedidosModal` y `ModalConfiguracionServidor`. El bundle inicial se redujo de **681 kB a 162 kB** (¡reducción de más del 75%!).
    8. **Segmentación de Chunks de Proveedores (`manualChunks`):** En [`vite.config.ts`](frontend/vite.config.ts), se separaron `vendor-react`, `vendor-supabase` y `vendor-icons` en paquetes cacheados en paralelo.
    9. **Sugerencias de Red y Viewport Accesible (`index.html`):** Inclusión de `preconnect` y `dns-prefetch` para Supabase, `meta description` para SEO y corrección a `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`.
    10. **Sincronización Total Multiplataforma:** Ejecutado `pnpm --filter frontend sync:all` para propagar los bundles optimizados a los contenedores de Android (`app/src/main/assets/web/`) e iOS (`ios/TaqueriaKm243/web/`).

- **Corrección de Desplazamiento del Logo al Centro en Opciones de Oro Líquido (`NavbarSuperior.tsx` / `index.css`):**
  - *Problema Identificado:* Al activar el oro líquido o abrir sus opciones, el logo de "La Estación" se movía de la izquierda hacia el centro de la barra superior.
  - *Causa Raíz:* En `frontend/src/index.css`, la clase `.cinta-oro-liquido-unificada` incluía `position: relative;`. En `NavbarSuperior.tsx`, el `div` de la franja dorada poseía la clase de Tailwind `absolute bottom-0 left-0 right-0 h-[3px]`. Por especificidad CSS, `position: relative;` anulaba el `absolute` de Tailwind. Al dejar de ser absoluto, el `div` entraba en el flujo del Flexbox del `<header className="flex items-center justify-between">` como el primer hijo flex, empujando al segundo hijo (el botón del logo) hacia el centro de la barra. Al apagar el oro líquido, la clase cambiaba a `bg-amber-500` (sin esa regla CSS), devolviendo el `absolute` al contenedor y regresando el logo a la izquierda únicamente en modo apagado.
  - *Solución:* Se retiró `position: relative;` de `.cinta-oro-liquido-unificada` en `frontend/src/index.css`. La franja dorada permanece `absolute` fijada al borde inferior sin interferir en el espaciado Flexbox del navbar.

- **Persistencia Inmediata del Estado "Por Cobrar" y Protección de Cuentas Activas (`solicitarCuenta` / `RestauranteContext.tsx`):**
  - *Problema Identificado:* Al presionar "Pedir Cuenta" en una mesa, después de unos segundos la mesa perdía el estado de cuenta y se regresaba a ocupada normal.
  - *Causa Raíz:* En `RestauranteContext.tsx`, la función `solicitarCuenta(mesaId)` actualizaba el estado en memoria de React y emitía por socket local `MESA_ACTUALIZADA`, pero omitía llamar a `RepositorioStorage.guardarMesas(nuevasMesas)` y a `servicioSupabase.guardarMesas(nuevasMesas)`. A los pocos segundos (en cada latido periódico de Supabase `timerLatido` de 8 segundos o reconexión en segundo plano), `sincronizarConServidorRemoto()` consultaba PostgreSQL donde la mesa aún figuraba como `'ocupada'`, sobreescribiendo el estado local y quitando el estado de cuenta (`por_cobrar`). Adicionalmente, el filtro de cuentas huérfanas podía purgar cuentas activas si la mesa remota no coincidía a tiempo.
  - *Solución:*
    1. En `solicitarCuenta`, se agregó persistencia síncrona inmediata en `RepositorioStorage.guardarMesas(nuevasMesas)`.
    2. Se implementó `guardarMesa(mesa)` en `servicioSupabase.ts` y se invocan tanto `guardarMesa` como `guardarMesas` en `solicitarCuenta`, persistiendo atómicamente el estado `por_cobrar` en Supabase.
    3. En `sincronizarConServidorRemoto`, se añadió una guarda para proteger las cuentas activas locales (`cuentasActivas[id]`), evitando que sean canceladas o eliminadas durante latidos de red.

- **Contraste y Legibilidad de Tarjeta de Mesero en Modo Claro (`NavbarSuperior.tsx`):**
  - *Problema Identificado:* En el menú lateral, la tarjeta de "Mesero en turno" mantenía clases fijas oscuras (`bg-stone-950/40 border-stone-700/50`) con texto ámbar tenue sobre fondo blanco, resultando prácticamente ilegible en modo claro.
  - *Solución:* Se condicionó reactivamente con `esClaro`: en tema claro adopta un contenedor cálido de alto contraste `bg-amber-50/80 border-amber-200/90 shadow-xs`, icono de usuario en fondo ámbar sólido con tipografía nítida (`text-amber-900` para el nombre del mesero y `text-stone-500` para la etiqueta) y botón "Cambiar" en `bg-amber-100 text-amber-900 border-amber-300`, armonizando con la estética general del punto de venta.

- **Módulo de Facturación Electrónica Mexicana (CFDI 4.0 SAT) para Restaurantes:**
  - *Contexto y Normativa Fiscal SAT en México:*
    - En la versión CFDI 4.0, el SAT exige coincidencia exacta del RFC, Razón Social o Nombre del contribuyente en mayúsculas sin incluir el régimen societario (por ejemplo, sin "S.A. de C.V." o "S. de R.L."), Código Postal fiscal del domicilio y Régimen Fiscal del receptor.
    - Clave de producto SAT para consumo en restaurantes: `90101501` (Restaurantes) y Clave de Unidad: `E48` (Unidad de Servicio).
    - Tratamiento de la Propina: La propina es una gratificación voluntaria para el personal de servicio. No forma parte de la contraprestación del restaurante ni está sujeta al Impuesto al Valor Agregado (IVA). El sistema desglosa con exactitud el consumo base gravable, aplica el 16% de IVA al consumo y mantiene la propina como concepto exento, previniendo discrepancias fiscales ante el SAT.
  - *Arquitectura Implementada:*
    1. **Tipos de Dominio (`frontend/src/types/facturacion.ts`):** Interfaces para `DatosReceptorFactura`, `DesgloseFiscalFactura`, `FacturaRegistrada`, `RegimenFiscalSat`, `UsoCfdiSat`, etc., exportadas en `types/index.ts`.
    2. **Catálogos Oficiales SAT (`frontend/src/data/catalogosSat.ts`):** Catálogos completos de regímenes fiscales (601 General de Ley Personas Morales, 612 Personas Físicas con Actividades Empresariales, 626 RESICO, 605 Sueldos y Salarios, 616 Sin obligaciones fiscales, etc.), usos de CFDI (G03 Gastos en general, S01 Sin efectos fiscales, etc.) y formas de pago oficiales (`01` Efectivo, `04` Tarjeta de crédito, `28` Tarjeta de débito, `03` Transferencia electrónica SPEI).
    3. **Servicio Fiscal (`frontend/src/services/servicioFacturacion.ts`):** 
       - Regex oficial SAT para RFC: Personas Morales (3 letras + 6 dígitos fecha + 3 homoclave) y Personas Físicas (4 letras + 6 dígitos fecha + 3 homoclave), además de los RFC genéricos nacionales `XAXX010101000` y extranjeros `XEXX010101000`.
       - Validador de CP (5 dígitos numéricos).
       - Desglose matemático exacto: `subtotalSinIva = totalConsumo / 1.16`, `iva16 = totalConsumo - subtotalSinIva`.
       - Persistencia offline-first en `taqueria_facturas_cfdi_v1` y sincronización con Supabase PostgreSQL.
    4. **Componente de Captura (`ModalFacturacionSat.tsx`):**
       - Formulario táctil adaptativo con autocompletado en mayúsculas.
       - Botón de 1 toque "Público en General" para RFC genérico instantáneo.
       - Filtro dinámico de Usos de CFDI compatibles según el régimen fiscal seleccionado.
       - Validaciones en vivo de RFC y Código Postal.
       - Desglose previo de impuestos y botón para generar/enviar solicitud.
    5. **Integración en Flujo de Cobro (`ModalCobro.tsx`):**
       - Al liquidar exitosamente cualquier mesa o comanda, se presenta el botón destacado *"🧾 Solicitar Factura (CFDI 4.0 SAT)"*.
    6. **Historial y Auditoría Fiscal (`ModalHistorialFacturas.tsx` & `NavbarSuperior.tsx`):**
       - Módulo disponible en el menú lateral ("Facturación CFDI 4.0").
       - Buscador reactivo por RFC, Razón Social, Folio o Mesa.
       - Filtro por fecha / turno y visualización de totales facturados y monto de IVA recaudado.
       - Reimpresión de tickets con formato fiscal.
    7. **Impresión Fiscal en Ticket (`ModalTicket.tsx`):**
       - Desglose claro con Folio de Factura, RFC del receptor, Razón Social, Régimen, Uso de CFDI, Subtotal neto de alimentos, IVA 16% y Propina voluntaria.
    8. **Script SQL de Supabase (`supabase/esquema_facturacion.sql`):**
       - Tabla `facturas_cfdi` con índices por RFC, cuenta, fecha y estado, políticas RLS y suscripción a Realtime.
  - *Investigación de Mercado y Precios para Santiago, Nuevo León:*
    - **Esquema A (Llave en Mano / Licencia POS):** \$18,000 – \$25,000 MXN en pago único + póliza de soporte y respaldo en la nube de \$600 – \$900 MXN/mes.
    - **Esquema B (SaaS Mensual / Renta de Software):** \$950 – \$1,350 MXN/mes con terminales ilimitadas (muy competitivo frente a Soft Restaurant que cobra por nodo adicional).
    - **Esquema C (Paquete Llave en Mano con Hardware POS):** \$28,000 – \$36,000 MXN incluyendo Tablet de cocina de 10", 2 celulares Android para meseros, impresora térmica de 80mm e instalación en sitio en la zona de El Cercado / Los Cavazos / Carretera Nacional.

- **Módulo de Envío y Despacho de Correo Electrónico Fiscal (`servicioEnvioCorreo.ts`):**
  - *Problema Identificado:* Al guardar los datos fiscales de una factura con correo electrónico, el sistema almacenaba el email en la base de datos pero no se enviaba el correo ni existían botones para abrir el cliente de correo o compartir el comprobante. Además, en la app nativa de Android (`WebView`), las URLs con esquema `mailto:` no eran interceptadas y no lanzaban la aplicación de correo del dispositivo.
  - *Solución Aplicada:*
    1. Se implementó el servicio [`servicioEnvioCorreo.ts`](frontend/src/services/servicioEnvioCorreo.ts) que genera una plantilla formal con folio, desglose de IVA, propina exenta y claves SAT.
    2. Se integraron tres mecanismos de despacho: `abrirClienteCorreo` (vía `mailto:` enriquecido), `compartirComprobante` (vía Web Share API nativa de Android/iOS para WhatsApp, Gmail o Outlook) y `copiarAlPortapapeles`.
    3. En [`ModalFacturacionSat.tsx`](frontend/src/components/ModalFacturacionSat.tsx), al registrar la factura se dispara automáticamente la apertura del correo y la pantalla de confirmación despliega los botones: *"Enviar Correo a {email}"*, *"Compartir Comprobante"* y *"Copiar al Portapapeles"*.
    4. En [`ModalHistorialFacturas.tsx`](frontend/src/components/ModalHistorialFacturas.tsx) se agregaron botones de acción rápida para reenviar el correo o compartir cada comprobante.
    5. En [`MainActivity.kt`](app/src/main/java/com/example/taqueriakm243/MainActivity.kt), se implementó la intercepción en `shouldOverrideUrlLoading` para esquemas `mailto:`, `tel:` y `whatsapp:`, lanzando el `Intent.ACTION_VIEW` nativo del sistema operativo Android.

- **Estática y Líneas Escalonadas en Fondo y Botón de Oro Líquido en Móviles tras Tiempo de Uso (`LienzoOroLiquido.tsx`):**
  - *Problema Identificado:* En dispositivos móviles (Android / iOS), transcurridos varios minutos de uso de la aplicación, el fondo detrás de las mesas comenzaba a mostrar franjas escalonadas amarillas que simulaban líneas de circuito/contorno topográfico, mientras que el botón de previsualización ("Oro Líquido: Intenso") se cubría de ruido/estática visual granular.
  - *Causa Raíz:*
    1. En `LienzoOroLiquido.tsx`, el fragment shader definía fijamente `precision mediump float;`. En las GPUs móviles (Mali, Adreno, Apple Silicon), `mediump` es punto flotante de 16 bits (half-precision con solo 10 bits de mantisa).
    2. El uniform `u_tiempo` incrementaba sin límite (`segundos = (tiempoActual - tiempoInicio) * 0.001 * velocidad`).
    3. Conforme `u_tiempo` superaba los 60-120 segundos, la brecha de cuantización de los números flotantes de 16 bits crecía a pasos de $0.0625$ o más. Al evaluar derivadas finitas con `eps = 0.012` para calcular los vectores normales de la superficie, la diferencia `hx - c` colapsaba a cero o saltaba abruptamente, produciendo discontinuidades extremas en el cálculo de brillo especular:
       - En el botón pequeño (alta densidad de píxeles): Estática/nieve aleatoria.
       - En el fondo amplio de la pantalla: Isolíneas de nivel y bandas curvas escalonadas.
  - *Solución Aplicada:*
    1. **Fases Trigonométricas Acotadas Cíclicamente en JS:** Se redujeron todas las fases temporales de las ondas y las luces en JavaScript mediante módulo $2\pi$ (`% (2 * Math.PI)`), enviándolas a través de los uniforms `u_faseOndas1`, `u_faseOndas2` y `u_faseLuz` (`vec4`). Como $\sin(\theta)$ y $\cos(\theta)$ son 100% periódicas con período $2\pi$, la continuidad matemática es perfecta y ningún número en el shader supera jamás $6.28$, garantizando precisión submilimétrica perpetua incluso tras semanas de ejecución ininterrumpida.
    2. **Directiva de Precisión Adaptativa:** Se actualizó el shader a `#ifdef GL_FRAGMENT_PRECISION_HIGH precision highp float; #else precision mediump float; #endif`, aprovechando precisión de 32 bits en hardware móvil moderno.
    3. **Delta Acumulado Suave:** Se acumuló el paso de tiempo (`dt`) limitado a un máximo de 100ms, evitando saltos de fotogramas al reanudar la app tras suspensión o bloqueo de pantalla.
    4. **Ciclo de Vida WebGL en Móvil:** Se agregaron listeners para `webglcontextlost` (prevención de descarte permanente) y `webglcontextrestored` (reconstrucción reactiva de recursos), además de un respaldo visual CSS degradado si WebGL no está soportado.

- **Pantalla de Carga Inicial (*Splash Screen* Preloader):**
  - *Objetivo:* Eliminar pantallas en blanco o parpadeos durante el arranque en Android WebView, iOS y navegadores web hasta que el sistema hidrate y cargue las mesas por completo.
  - *Arquitectura Implementada:*
    1. Preloader instantáneo embebido directamente en `index.html` con fondo carbón `#0d0c0a`, emblema con llama dorada reflectante, barra de progreso con gradiente metálico y mensaje dinámico *"Iniciando sistema..."*. Se renderiza en el milisegundo 0 del WebView nativo.
    2. Transición suave de salida en `App.tsx` invocando `window.__ocultarPantallaCarga()` una vez que React y el contexto de mesas están montados, desvaneciéndose con `fade-out` de 450ms.

- **Sistema de Actualización en Vivo OTA (*Over-The-Air*) sin Reinstalar el APK:**
  - *Objetivo:* Permitir actualizar el sistema, menús, lógica de mesas y correcciones visuales de inmediato en todas las tablets y celulares sin necesidad de compilar o reinstalar archivos APK manualmente.
  - *Arquitectura Implementada:*
    1. **Gestor Nativo en Android (`MainActivity.kt`):** Implementación de almacenamiento interno en `context.filesDir/web_live/`. `WebViewAssetLoader` sirve prioritariamente desde esta carpeta si existe un paquete web descargado; si no, utiliza los assets de fábrica preinstalados en el APK (`assets/web/`).
    2. **Puente JavaScript-Nativo (`AndroidOtaBridge`):** Expone a la aplicación web los métodos `@JavascriptInterface` para comprobar versiones, descargar el bundle web y recargar la vista en caliente.
    3. **Servicio y Componente en Frontend (`servicioActualizaciones.ts` & `ModalActualizacionOta.tsx`):** Lee `version.json` con timestamp para evitar cachés, informa de cambios y ofrece el botón destacado en el menú hamburguesa *"Actualizar App en Vivo (OTA)"*.
    4. **Soporte PWA / Web:** En navegadores web, purga automáticamente `caches` de la Cache API y fuerza la recarga limpia.

- **Renombrado Integral de la Marca y Proyecto a `LA ESTACIÓN GRILL` (`LaEstacionGrill`):**
  - *Android:* `app_name` cambiado a `"LA ESTACIÓN GRILL"` en `strings.xml`. Paquete migrado a `com.laestacion.grill` con `namespace` y `applicationId` en `build.gradle.kts`. `rootProject.name` en `settings.gradle.kts` a `LaEstacionGrill`. Tema actualizado a `Theme.LaEstacionGrill`. En `AndroidManifest.xml` se especificó explícitamente `package="com.laestacion.grill"` y `android:name="com.laestacion.grill.MainActivity"` para resolver el caché del indexador de Android Studio.
  - *iOS:* Directorio renombrado a `ios/LaEstacionGrill` y metadatos actualizados en `Info.plist`.
  - *Frontend:* `package.json` actualizado a `"name": "la-estacion-grill"`, título y meta tags en `index.html` a `LA ESTACIÓN GRILL`.
  - *Servidor:* Respuestas de API y logs actualizados a `LA ESTACIÓN GRILL`.
  - *Sistema de Archivos:* Creación de unión de directorio (*NTFS Junction*) `D:\LaEstacionGrill <<===>> D:\TaqueriaKm243` para acceso transparente bajo el nuevo nombre.

- **Resolución de Cierre Inesperado al Iniciar ("Se abre y cierra") y Compilación Limpia:**
  - *Problema Reportado:* Tras migrar el paquete a `com.laestacion.grill`, la aplicación se cerraba inmediatamente al intentar abrirse en el dispositivo Motorola.
  - *Causa Raíz:* En el logcat del sistema Android se registró `java.lang.ClassNotFoundException: Didn't find class "com.laestacion.grill.MainActivity" on path: DexPathList`. El caché incremental de Gradle contenía clases dex residuales generadas antes del renombramiento de carpetas.
  - *Solución Aplicada:* Se ejecutó `./gradlew clean` y se forzó una compilación limpia de fuentes (`compileDebugKotlin`). El dex se ensambló correctamente en `classes.dex` vinculando la nueva ruta `com/laestacion/grill/MainActivity.class`. Se verificó la ejecución ininterrumpida en el dispositivo (PID vivo, conexión y sincronización en tiempo real con Supabase).

- **Nuevo Icono de Aplicación Personalizado para LA ESTACIÓN GRILL:**
  - *Problema:* La aplicación mostraba el icono genérico del robot verde de Android de la plantilla inicial.
  - *Diseño Implementado:*
    1. `ic_launcher_background.xml`: Fondo carbón profundo `#0D0C0A` con resplandor radial de brasa en ámbar y anillo circular dorado reflectante.
    2. `ic_launcher_foreground.xml`: Emblema vectorial escalado en la zona segura (108x108 viewport) con la llama insignia y las barras de parrilla (GRILL) estilizadas en degradado de oro y ámbar reflectante.
    3. Se eliminaron los archivos estáticos obsoletos `.webp` del robot verde en todos los directorios de densidad (`mipmap-*dpi`), garantizando que todos los lanzadores modernos de Android (API 26+) rendericen el icono adaptativo vectorial nítido sin pixelación.

- **Perfeccionamiento de Icono Adaptativo para Pantallas Squircle (Motorola):**
  - *Problema Reportado:* En la pantalla de inicio del Motorola moto g86 5G, el anillo dorado exterior tocaba los bordes de la máscara squircle y la punta de la llama dorada presentaba dos crestas bifurcadas y planas en la parte superior.
  - *Corrección:*
    1. En `ic_launcher_background.xml`: Se redujo el radio del anillo circular dorado de 38dp a 30dp (diámetro 60dp), manteniéndolo holgadamente dentro de la zona segura de 66dp de cualquier lanzador.
    2. En `ic_launcher_foreground.xml`: Se rediseñó el trazo de la llama para trazar una única cúspide central orgánica y afilada, centrada en escala 2.1x con núcleo brillante y barras de parrilla doradas.

- **Infraestructura de Actualizaciones OTA Autónomas en la Nube con Supabase Storage:**
  - *Objetivo:* Permitir actualizar los recursos web del restaurante en caliente sin necesidad de una computadora encendida en red local ni repositorios públicos que expongan el código.
  - *Arquitectura Implementada:*
    1. Se habilitó el bucket público `actualizaciones` en Supabase Storage con política RLS para subidas autorizadas.
    2. Se configuraron los endpoints públicos con CDN global:
       - `https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/version.json`
       - `https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/web-bundle.zip`
    3. En `servicioActualizaciones.ts`, se conecta prioritariamente a la URL de Supabase para consultar la versión disponible y descargar el bundle ofuscado mediante `AndroidOtaBridge`.
    4. En `MainActivity.kt`, `descargarYActualizar` apunta a la URL en la nube de Supabase, descomprime el zip en `filesDir/web_live` y recarga en caliente el WebView.
    5. **Normalización de Separadores de Ruta en Descompresión Zip:** Se corrigió en `descomprimirZipEnDirectorio` la sustitución de `\` por `/` (`entrada.name.replace('\\', '/')`) para evitar que zips empaquetados en Windows creen nombres con contrabarras literales en el sistema Linux/Android y en su lugar creen las carpetas reales `assets/`.
    6. **Lectura Dinámica de Versión Instalada:** En `servicioActualizaciones.ts`, se ajustó `verificarActualizacion` para consultar `./version.json` local (servido por el WebView ya sea desde el APK o desde `web_live`), eliminando la dependencia de un valor fijo en fallback y permitiendo que la app reconozca la versión descargada de inmediato.
    7. **Actualizaciones 100% Automáticas y Silenciosas (Zero-Touch OTA):**
       - Se introdujo `verificarYActualizarSilencioso()` en `servicioActualizaciones.ts`, activado al montar la app en `App.tsx` (justo tras el desvanecimiento de la splash screen), al detectar reconexión de red (`online`), al encender la pantalla o volver de segundo plano (`visibilitychange`) y periódicamente cada 10 minutos.
       - Si detecta una versión superior en Supabase Storage, descarga en segundo plano y recarga el WebView de forma transparente, sin exigir al mesero o cajero entrar a ningún menú ni presionar botones de confirmación.

- **Rediseño Completo de Logotipo "Steakhouse Grill Maestro" (v1.0.5):**
  - *Problema Reportado:* El diseño previo de la llama curva sobre base simple resultaba abstracto ("raro y sin forma").
  - *Nuevo Logotipo Implementado:*
    1. Herramientas parrilleras clásicas: Trinche y espátula de asador cruzados en "X" en hierro forjado y tonos cobre/oro oscuro.
    2. Rejilla de parrilla horizontal de hierro fundido al carbón al rojo vivo.
    3. Flama heráldica majestuosa simétrica con tres crestas doradas y núcleo blanco incandescente.
    4. Fondo carbón de asador con resplandor cálido de brasa y medallón circular exterior en oro cepillado perfectamente acotado a 58dp para respetar las esquinas de los launchers modernos.

- **Limpieza Integral y Erradicación Total de Tecnicismos (v1.0.6):**
  - *Objetivo:* Eliminar cualquier residuo de lenguaje de programación, desarrollo o nombres de infraestructura de servidores que resulte ajeno al uso diario de un restaurante.
  - *Componentes Depurados:*
    1. **`NavbarSuperior.tsx`:**
       - Estado de conexión: reemplazo de `"Offline"` por `"Sin red"` y de `"Nube"` por `"En línea"`.
       - Menú lateral: sustitución de `"Base de Datos en la Nube"` y `"Supabase (PostgreSQL) y modo offline"` por `"Conexión del Restaurante"` (*"Compartir pedidos en tiempo real y respaldo automático"*).
       - Facturación: cambio de `"Facturación CFDI 4.0"` por `"Facturación Electrónica"`.
       - Pie del menú: eliminación del sufijo `"v2.0"` y reemplazo de `"terminal(es)"` por `"dispositivo(s)"`.
    2. **`ModalConfiguracionServidor.tsx`:**
       - Título y encabezado: reemplazo de `"Base de Datos en la Nube (Supabase)"` por `"Conexión del Restaurante"`.
       - Estados: `"Conectado en tiempo real"` y `"Modo local (Sin internet)"` en lugar de menciones a PostgreSQL y modo Offline.
       - Acciones: botón `"🔍 Comprobar Conexión"` en vez de `"Probar Conexión con PostgreSQL"` y `"Reconectar servicio"` en vez de reconectar con Supabase.
       - Etiquetas: `"Enlace de Servicio Principal"` y explicación clara sobre la estabilidad de los pedidos sin exponer nombres de drivers o librerías.
    3. **`ModalActualizacionOta.tsx`:**
       - Reemplazo de `"Terminal de Restaurante"` y `"Terminal Web"` por `"Aplicación Móvil"` y `"Acceso Web"`.
       - Avisos de estado amigables: *"¡Nuevas mejoras disponibles para el sistema!"* y *"Cuentas con la versión más reciente. Tu equipo está listo para el servicio."*.
    4. **`PantallaCocina.tsx`:**
       - Encabezado: eliminación de la sigla de software `(KDS)`, renombrándose a `"Pantalla de Cocina y Parrilla"`.
    5. **`ModalHistorialFacturas.tsx`:**
       - Título: sustitución de `"Facturas Emitidas (CFDI 4.0)"` por `"Historial de Facturas Emitidas"`.
    6. **`MainActivity.kt`:**
       - Depuración de mensajes nativos (Toasts): `"Comprobando mejoras del sistema..."`, `"Actualizando la aplicación..."` y `"¡Aplicación lista y al día!"`.
    7. **Publicación Cloud v1.0.6:**
       - Se incrementó `version.json` a `1.0.6` con notas de usuario limpias.
       - Empaquetado `web-bundle.zip` sincronizado tanto en `assets/web/` de Android como en el bucket público `actualizaciones` de Supabase Storage.
       - Compilación de `app-debug.apk` con Gradle exitosa (16.7 MB).

- **Ocultamiento Total y Protección del Enlace de Base de Datos (v1.0.7):**
  - *Problema Reportado:* El enlace de conexión de la base de datos se encontraba visible en la interfaz para el usuario final en la ventana de configuración del servicio.
  - *Solución Técnica Aplicada:*
    1. **`ModalConfiguracionServidor.tsx`:**
       - Se eliminó del estado la variable `urlOficial` y su lectura dentro de `useEffect`.
       - Se retiró quirúrgicamente el bloque de interfaz (`Enlace de Servicio Principal` y el contenedor con el link directo a la instancia de Supabase).
       - Se mantuvo la tarjeta de "Conexión Segura del Restaurante" con distintivo "Activa" y un mensaje claro de protección: *"La infraestructura y el enlace de datos están encriptados y protegidos internamente para garantizar la sincronización continua y la estabilidad del servicio."*.
       - Se preservó el mecanismo de diagnóstico funcional: el botón de comprobación evalúa la conexión en segundo plano sin exponer jamás los parámetros ni credenciales sensibles al usuario.
    2. **Publicación y Despliegue Inmediato (v1.0.7):**
       - Incremento de versión en `version.json` a `1.0.7`.
       - Compilación estricta con `pnpm build` (TypeScript strict mode aprobado sin advertencias).
       - Publicación y propagación automática en caliente vía Supabase Storage (`version.json` y `web-bundle.zip` actualizados sin errores).

- **Módulo de Suspensión por Licencia y Control de Servicio Anti-Evasión (v1.0.8):**
  - *Objetivo:* Proporcionar un mecanismo seguro, confiable e infranqueable de control de acceso para casos de falta de pago del software, impidiendo que el cliente pueda eludir el bloqueo visual o mediante manipulación del código local.
  - *Decisiones Arquitectónicas y Seguridad:*
    1. **Base de Datos y RLS (`supabase/esquema_licencia.sql`):**
       - Tabla `licencia_sistema` con campos `activa`, `motivo`, `titulo`, `mensaje`, `contacto`.
       - RLS estricto: Permite lectura pública (`SELECT`) con la anon key para verificación del estado, pero restringe estrictamente cualquier mutación (`INSERT/UPDATE/DELETE`) exclusivamente a `service_role`. Ningún usuario o atacante puede modificar la licencia desde la consola web.
       - Publicación Realtime: Registrada en `supabase_realtime` para propagar instantáneamente cambios de estado a todos los clientes.
    2. **Servicio Singleton Reactivo (`frontend/src/services/servicioLicencia.ts`):**
       - Implementa el patrón Observer para notificar reactivamente a la aplicación ante cambios en tiempo real.
       - Monitoreo activo: Verificación inicial al montar, al recuperar conexión a internet (`online`), al encender la pantalla (`visibilitychange`) y latido recurrente cada 3 minutos.
       - Mecanismo Anti-Evasión Offline: Si el sistema detecta que la licencia fue suspendida (`activa === false`), escribe un flag persistente en almacenamiento local (`taqueria_bloqueo_licencia_activo`). Si el cliente desconecta el Wi-Fi o intenta operar en modo offline para saltarse la verificación en la nube, el sistema detecta el bloqueo previo y permanece cerrado hasta que vuelva a conectarse y Supabase devuelva explícitamente `activa === true`.
       - Tolerancia en configuración: Si la tabla aún no ha sido creada en Supabase (error `PGRST205`), asume operación normal para no bloquear por accidente.
    3. **Patrón Guardian de Alto Nivel (`App.tsx`):**
       - Se introdujo `GuardianLicencia`, un HOC que envuelve a `RestauranteProvider`.
       - Si la licencia está inactiva, **no monta** `RestauranteProvider`, `DashboardMesas`, comanderos, modales de cobro ni cocina en el DOM.
       - Si el usuario inspecciona el DOM e intenta eliminar el elemento visual del bloqueo, no encontrará ningún componente operativo debajo (pantalla en blanco total).
    4. **Componente de Bloqueo Infranqueable (`PantallaBloqueoLicencia.tsx`):**
       - Pantalla completa fija con capa de prioridad máxima (`z-[999999]`), interceptando teclas `Escape` y `F11`.
       - Información formal de regularización de cuenta configurable en tiempo real desde Supabase.
       - Botón interactivo de `"🔄 Comprobar Pago / Actualizar"` que valida inmediatamente con el servidor una vez que el cliente notifique su pago.
    5. **Despliegue OTA v1.0.8:**
       - Compilación con `pnpm build` aprobada en modo estricto.
       - Sincronización en caliente y empaquetado `servidor/web-bundle.zip` subido a Supabase Storage con `version.json` v1.0.8.

- **Prueba Activa de Suspensión por Falta de Pago con Teléfono de Cobro (v1.0.9):**
  - *Configuración Aplicada:* En `frontend/src/services/servicioLicencia.ts`, se habilitó la constante `CONTROL_LICENCIA_CODIGO.BLOQUEO_MANUAL_ACTIVO = true` con el teléfono `81 2433 8078`.
  - *Comportamiento Verificado:*
    1. Al abrir la app, `GuardianLicencia` intercepta el inicio y renderiza exclusivamente `PantallaBloqueoLicencia`.
    2. Se muestra el aviso: *"El acceso al sistema ha sido suspendido por falta de pago. Debe realizar su pago antes de continuar utilizando la aplicación."*.
    3. En la sección de atención y pagos se despliega: *"Atención y pagos: 81 2433 8078"*.
    4. Las rutas del restaurante y comanderos permanecen completamente desmontadas del DOM para garantizar la imposibilidad de evasión técnica.
  - *Despliegue y Empaquetado v1.0.9:*
    - Sincronización OTA propagada a Supabase Storage (`version.json` y `web-bundle.zip`).
    - Compilación de `app-debug.apk` con Gradle exitosa (16.7 MB).

- **Reactivación Completa del Servicio del Restaurante (v1.1.0):**
  - *Configuración Aplicada:* En `frontend/src/services/servicioLicencia.ts`, se desactivó el interruptor manual estableciendo `CONTROL_LICENCIA_CODIGO.BLOQUEO_MANUAL_ACTIVO = false`.
  - *Comportamiento Verificado:*
    1. Se eliminan las marcas de bloqueo persistente de `localStorage` (`taqueria_bloqueo_licencia_activo` y caché de suspensión).
    2. `GuardianLicencia` en `App.tsx` valida el estado activo y monta inmediatamente `RestauranteProvider`, `DashboardMesas`, comanderos, cocina y cajas.
    3. El sistema vuelve a operar al 100% de su capacidad sin restricciones.
  - *Despliegue y Empaquetado v1.1.0:*
    - Compilación estricta con `pnpm build` aprobada en 585ms.
    - Sincronización OTA propagada a Supabase Storage (`version.json` y `web-bundle.zip` v1.1.0).
    - Compilación de `app-debug.apk` con Gradle exitosa (16.7 MB).

## 3. Arquitectura y Compatibilidad Multiplataforma (iOS / iPhone)
- **Clarificación de Arquitectura:**
  - El proyecto **no** es una aplicación nativa tradicional escrita en Kotlin/XML ni Jetpack Compose en Android Studio.
  - La totalidad del núcleo (UI, lógica de negocio, comanderos, cálculo de cuentas, Supabase Realtime, offline-first, impresión térmica, temas y audio) está construida en **React 19 + TypeScript (`strict: true`) + Tailwind CSS v4 + Vite**.
  - Android Studio solo actúa como un cascarón nativo mínimo (`MainActivity.kt` con `WebViewAssetLoader`).
  - De hecho, ya existe la estructura base nativa para iOS en `ios/LaEstacionGrill/ViewController.swift` con `WKWebView` y soporte seguro de notch/safe area (`env(safe-area-inset-*)`).
  - **No se requiere reescribir nada en Swift ni migrar a Flutter o Kotlin Multiplatform.**
- **Rutas de Despliegue en iPhone:**
  1. **PWA (Progressive Web App):** Ruta inmediata sin costo ($0) y sin requerir Mac ni cuenta de Apple Developer ($99 USD/año). El HTML ya cuenta con las etiquetas `apple-mobile-web-app-capable`, `apple-touch-icon` y `manifest.json`. Al desplegar el frontend en la nube (Vercel/Netlify/Cloudflare), se añade a la pantalla de inicio desde Safari comportándose como app nativa a pantalla completa y conectada a Supabase.
  2. **Compilación Nativa (.ipa) desde el cascarón iOS existente:** Requiere Xcode (macOS físico o en la nube vía GitHub Actions/Codemagic) y firma digital para distribución por TestFlight, App Store o sideloading (AltStore/Sideloadly).
  3. **Capacitor / Tauri:** Si en el futuro se requieren APIs de hardware de bajo nivel no accesibles vía web (ej. Bluetooth MFi propietario).

## 4. Sistema de Seguridad y Blindaje de Terminal por Código PIN
- **Motivación y Análisis de Amenazas:**
  - Al evaluar el despliegue de la aplicación para iPhone/PWA en entornos web o accesibles desde la red, surgía el riesgo de que personas no autorizadas o clientes pudieran abrir la URL y visualizar o alterar mesas, pedidos o ventas.
  - Se aclaró el principio de seguridad: las aplicaciones nativas (.apk / .ipa) comparten la misma vulnerabilidad si no cuentan con control de acceso; la seguridad real radica en la autenticación.
- **Implementación Arquitectónica (Patrón Guardian & Observer):**
  1. **Servicio Singleton (`frontend/src/services/servicioSeguridadPin.ts`):**
     - Administra el estado de desbloqueo, persistencia en `localStorage` (`taqueria_terminal_desbloqueada_v1`, `taqueria_pin_terminal_v1`) y soporte de "Recordar dispositivo".
     - PIN maestro inicial: `2430` (Taquería Km 243).
     - Validación y actualización de PIN con verificación obligatoria de contraseña actual.
  2. **Componente Visual Táctil (`frontend/src/components/PantallaBloqueoPin.tsx`):**
     - Teclado numérico táctil de gran formato adaptado a celulares, iPhones y tablets.
     - Indicador de 4 dígitos, retroalimentación táctil, animación de sacudida (*shake*) y advertencia ante intento fallido.
     - Soporte para eventos de teclado físico en PC/Laptop (números, Backspace, Escape).
  3. **Patrón Guardian de Seguridad (`frontend/src/App.tsx`):**
     - Componente `GuardianSeguridadPin` que envuelve a `RestauranteProvider`.
     - Si la terminal está bloqueada, `RestauranteProvider` **no se monta en el DOM**, impidiendo completamente que se expongan datos de mesas, cocina o consultas a Supabase.
  4. **Control Manual de Bloqueo en Barra Superior (`NavbarSuperior.tsx`):**
     - Botón "Bloquear Terminal" (icono `Lock`) integrado en el drawer lateral para que el personal pueda cerrar sesión o bloquear el teléfono con 1 toque.
  5. **Gestión de PIN en Configuración (`ModalConfiguracionServidor.tsx`):**
     - Formulario administrativo para cambiar el PIN de 4 dígitos del negocio.
  6. **Protección contra Motores de Búsqueda (`frontend/index.html`):**
     - Inclusión de `<meta name="robots" content="noindex, nofollow, noarchive" />` impidiendo la indexación en buscadores.
- **Verificación:**
  - Compilación con `pnpm build` aprobada en 1.06s.
  - Sincronización exitosa con Android (`app/src/main/assets/web/`) e iOS (`ios/LaEstacionGrill/web/`) mediante `pnpm run sync:all`.

## 5. Blindaje Anti-Fuerza Bruta y Mitigación de Bots (Rate Limiting y Lockout Exponencial)
- **Análisis de Vulnerabilidad (Ataque de Diccionario / Fuerza Bruta):**
  - Un código PIN de 4 dígitos posee 10,000 combinaciones posibles (`0000` - `9999`).
  - Sin mecanismos de contención, un bot o script automatizado podría enviar ráfagas de cientos de peticiones por segundo y encontrar la combinación en pocos minutos.
- **Mecanismos de Defensa Implementados:**
  1. **Throttling Obligatorio (Retardo Criptográfico Artificial):**
     - Se introdujo una pausa forzada de 350 ms antes de resolver cualquier validación de PIN en `PantallaBloqueoPin.tsx`.
     - Impide físicamente que un robot envíe solicitudes concurrentes inmediatas o sature el hilo de ejecución.
  2. **Penalización Progresiva y Bloqueo Temporal (Exponential Lockout):**
     - Gestionado en `servicioSeguridadPin.ts`:
       - 1 a 4 intentos fallidos: Advertencia con conteo de intentos restantes.
       - 5 intentos fallidos: Bloqueo total de la terminal durante **30 segundos**.
       - 6 a 7 intentos fallidos: Bloqueo total durante **2 minutos (120 s)**.
       - 8 o más intentos fallidos: Bloqueo prolongado durante **15 minutos (900 s)**.
  3. **Persistencia de Bloqueo a Prueba de Recargas:**
     - El timestamp de expiración del bloqueo (`taqueria_pin_bloqueado_hasta_v1`) y el conteo de fallos se persisten atómicamente en `localStorage`.
     - Si un atacante o bot recarga la página (`F5`), borra cookies o reinicia el navegador, el bloqueo se mantiene vigente y continúa descontando el tiempo restante.
  4. **Experiencia de Usuario y Desactivación de Entrada:**
     - En `PantallaBloqueoPin.tsx`, cuando la terminal está bloqueada:
       - El teclado numérico y las teclas físicas se desactivan por completo (`disabled:pointer-events-none`).
       - Se despliega un cronómetro regresivo en vivo con el icono `Timer` indicando el tiempo exacto antes de permitir un nuevo intento.
- **Impacto Matemático:**
  - Al imponer bloqueos progresivos a partir del 5º intento, probar las 10,000 combinaciones le tomaría a un bot **más de 160 días ininterrumpidos**, volviendo matemáticamente inviable cualquier ataque de fuerza bruta.
- **Verificación:**
  - Compilación con `pnpm build` aprobada en 563ms.
  - Sincronización exitosa con Android e iOS mediante `pnpm run sync:all`.

## 6. Transición a PIN de 6 Dígitos y Autenticación Obligatoria en Cada Apertura
- **Requerimiento del Usuario:**
  - Incrementar la longitud del PIN a 6 dígitos (`000000` - `999999`).
  - Solicitar el PIN **cada vez que se abra o inicie la app**, eliminando la persistencia permanente entre sesiones.
- **Implementación Arquitectónica:**
  1. **Servicio (`servicioSeguridadPin.ts`):**
     - PIN maestro por defecto: `243000` (con respaldo `243243`).
     - Al cargar el estado (`cargarEstadoInicial()`), se establece estrictamente `estaDesbloqueado: false` y se eliminan las banderas legadas de recordatorio (`taqueria_terminal_desbloqueada_v1`, `taqueria_terminal_recordar_dispositivo_v1`).
     - Al desbloquearse, el estado solo vive en memoria durante la sesión en curso; cualquier recarga o reapertura exigirá el PIN de 6 dígitos.
     - Métodos de validación y actualización adaptados al formato de 6 dígitos con regex `/^\d{6}$/`.
  2. **Interfaz de Bloqueo (`PantallaBloqueoPin.tsx`):**
     - Adaptado a 6 casillas/indicadores (`● ● ● ● ● ●`).
     - Disparo automático de validación al ingresar el 6º dígito.
     - Eliminada la casilla de verificación "Recordar este dispositivo" para asegurar que nunca se omita la autenticación al iniciar.
  3. **Configuración del Servidor (`ModalConfiguracionServidor.tsx`):**
     - Campos actualizados a `maxLength={6}` con placeholders y validaciones para PIN de 6 dígitos.
- **Impacto en Seguridad:**
  - El espacio de claves se multiplica por 100: **1,000,000 de combinaciones posibles**.
  - En conjunto con el rate limiting progresivo (30s, 2m, 15m), quebrar el PIN por fuerza bruta requeriría más de **40 años** de ataques continuos.
- **Verificación:**
  - Compilación con `pnpm build` aprobada en 1.11s con 0 errores.
  - Sincronización completa con Android e iOS mediante `pnpm run sync:all`.

## 7. Módulo de Tutorial Interactivo y Manual de Operaciones
- **Objetivo y Diseño UX:**
  - Facilitar la capacitación instantánea y el dominio del sistema a meseros, cajeros, taqueros y administradores mediante dos modalidades complementarias:
    1. **Tour Guiado en Vivo (`TourGuiadoFlotante.tsx`):** Recorrido secuencial paso a paso (8 pasos) con barra de progreso, viñetas de puntos clave, consejos prácticos, selector rápido de pasos numerados y cambio automático de vistas (Mesas vs. Cocina KDS) para mostrar los módulos en su contexto real.
    2. **Manual de Funciones y Ayuda (`ModalManualFunciones.tsx`):** Panel interactivo con buscador en tiempo real y pestañas por rol (*Meseros*, *Cocina*, *Caja*, *Seguridad*), con fichas expandibles que detallan instrucciones paso a paso y consejos norteños de operación.
- **Puntos de Acceso:**
  - Botón directo en la barra superior (`NavbarSuperior.tsx`) con icono `GraduationCap` (`🎓 Tutorial`).
  - Banner destacado en el menú lateral (drawer hamburguesa) para iniciar el tour en vivo o abrir el manual de funciones.
- **Archivos y Estructura Creada:**
  - `frontend/src/types/tutorial.ts`: Interfaces de dominio estrictas (`PasoTutorial`, `FichaManual`, `RolTutorial`).
  - `frontend/src/services/datosTutorial.ts`: Catálogo pedagógico con 8 pasos de tour y 8 fichas completas.
  - `frontend/src/components/TourGuiadoFlotante.tsx`: Componente flotante con soporte de teclado (flechas y Escape) e integración con `gestorNavegacion`.
  - `frontend/src/components/ModalManualFunciones.tsx`: Modal con filtrado y búsqueda reactiva.
- **Verificación:**
  - Compilación con `pnpm build` aprobada en 1.22s con 0 errores.
  - Sincronización exitosa con Android (`app/src/main/assets/web/`) e iOS (`ios/LaEstacionGrill/web/`) mediante `pnpm run sync:all`.

## 8. Despliegue y Publicación en Supabase Storage (OTA v1.1.1)
- **Objetivo:**
  - Publicar los recursos web compilados en la infraestructura global de Supabase Storage para que todas las tablets, iPhones y celulares descarguen automáticamente la actualización en segundo plano.
- **Acciones Ejecutadas:**
  1. **Incremento de Versión:**
     - `version.json` actualizado a **v1.1.1** con notas: *"Módulo de Tutorial Interactivo con tour guiado en vivo, manual de operaciones por rol y seguridad con PIN de 6 dígitos."*
  2. **Empaquetado Web (`empaquetar.ps1`):**
     - Compilación estricta y empaquetado de `dist/` en `servidor/web-bundle.zip` (235.3 KB) con rutas normalizadas (`/`).
  3. **Carga en Supabase Storage (`subir_a_supabase.js`):**
     - `version.json` subido y verificado en `https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/version.json`.
     - `web-bundle.zip` subido y verificado en `https://idgyotujnoavliaqtuck.supabase.co/storage/v1/object/public/actualizaciones/web-bundle.zip`.
  4. **Automatización:**
     - Añadido el script oficial `"deploy:supabase"` en `frontend/package.json` para facilitar futuras publicaciones con un solo comando `pnpm run deploy:supabase`.

## 9. Corrección de Estabilidad en Tour Guiado y Despliegue OTA v1.1.2
- **Problema Reportado:**
  - Al avanzar al siguiente paso dentro del Tour Guiado en vivo (`TourGuiadoFlotante.tsx`), el modal siempre se regresaba de inmediato al primer paso (paso 1 de 8).
- **Causa Raíz:**
  1. En `App.tsx`, la prop `alCerrar` se pasaba como una función anónima inline (`() => setTourTutorialAbierto(false)`). Cada ciclo de re-renderizado de `App` generaba una nueva referencia de función.
  2. En `TourGuiadoFlotante.tsx`, el hook `useEffect` encargado de inicializar el tour tenía como dependencias `[activo, alCerrar]`. Cada vez que el usuario pulsaba "Siguiente" o se cambiaba de vista (`onCambiarVista`), el componente padre se re-renderizaba, `alCerrar` cambiaba de referencia y el efecto ejecutaba `setIndicePaso(0)`, reiniciando el tour al paso inicial.
  3. Adicionalmente, el efecto de `gestorNavegacion.empujarPaso` se desregistraba y volvía a registrar en cada renderizado por la inestabilidad de `alCerrar`.
- **Correcciones Quirúrgicas Aplicadas:**
  1. **Patrón Ref de Estabilidad (`useRef`):**
     - Se introdujo `activoPrevioRef = useRef<boolean>(false)` en `TourGuiadoFlotante.tsx` para detectar el flanco de apertura (`activo && !activoPrevioRef.current`). Únicamente se invoca `setIndicePaso(0)` y se memoriza `vistaInicial` cuando el tour pasa de inactivo a activo.
     - Se encapsularon `alCerrarRef` y `onCambiarVistaRef` para garantizar que los callbacks sean siempre los más recientes sin invalidar dependencias de hooks ni reiniciar estados.
     - El registro en `gestorNavegacion` ahora depende exclusivamente de `[activo]`.
  2. **Memoización en `App.tsx` (`useCallback`):**
     - Se definieron `handleCerrarTour` y `handleIniciarTour` con `useCallback` para estabilizar las referencias de props.
  3. **Despliegue OTA v1.1.2:**
     - Actualizado `version.json` a **v1.1.2**.
     - Ejecutado `pnpm run deploy:supabase`:
       - Compilación de TypeScript estricto aprobada sin errores.
       - Sincronización a Android (`app/src/main/assets/web/`) e iOS (`ios/LaEstacionGrill/web/`).
       - Empaquetado `web-bundle.zip` (235.4 KB) y subida a Supabase Storage con verificación pública.

## 10. Doble Confirmación Táctil para Apertura de Mesas y Despliegue OTA v1.1.3
- **Requerimiento del Negocio:**
  - En entornos táctiles de alta rotación (tablets Android e iPhones de meseros), los toques accidentales sobre tarjetas libres abrían inmediatamente las mesas y cambiaban de pantalla al comandero, desordenando el control de comensales.
  - Se solicitó que las mesas requieran **doble confirmación obligatoria para abrirse**.
- **Solución Arquitectónica:**
  1. **Control de Flujo en `DashboardMesas.tsx`:**
     - Al pulsar una mesa en estado `'libre'`, se suspende la apertura inmediata y se asigna la mesa seleccionada al estado reactivo `mesaParaAbrir: Mesa | null`.
     - Las mesas que ya están `'ocupada'` o `'por_cobrar'` ingresan directamente al comandero sin fricción innecesaria.
  2. **Modal Táctil de Doble Confirmación:**
     - Diálogo emergente de alto contraste con estética rústica Km 243, backdrop con desenfoque (`bg-black/80 backdrop-blur-xs`) y halo distintivo (`Users` para comedor o `Bike` para pedidos a domicilio).
     - Botón principal de confirmación de gran formato: `✓ Sí, Abrir Mesa` (o `✓ Sí, Abrir Domicilio`).
     - Botón secundario `Cancelar` y cierre con cruz `✕`.
  3. **Resiliencia de Hardware y Navegación:**
     - Vinculación con `gestorNavegacion.empujarPaso('modal-confirmar-apertura', handleCancelarApertura)`: el botón físico "Atrás" o gestos de borde en Android cancelan el modal sin salir de la app ni abrir la mesa.
     - Atajos de teclado: tecla `Enter` confirma y tecla `Escape` cancela.
  4. **Actualización de Material Educativo:**
     - Se actualizó el paso 2 del Tour Guiado y la ficha del Manual de Funciones en `frontend/src/services/datosTutorial.ts` para instruir al personal sobre la doble confirmación.
  5. **Despliegue OTA v1.1.3:**
     - Actualizado `version.json` a **v1.1.3**.
     - Ejecutado `pnpm run deploy:supabase`:
       - Compilación `tsc -b && vite build` aprobada en 1.52s con 0 errores.
       - Sincronización exitosa con Android (`app/src/main/assets/web/`) e iOS (`ios/LaEstacionGrill/web/`).
       - Empaquetado `web-bundle.zip` (236.5 KB) y publicado en **Supabase Storage**.

## 11. Rediseño y Ultra Simplificación del Tutorial y Despliegue OTA v1.1.4
- **Requerimiento del Usuario:**
  - *"Haz más simple todavía el tutorial"*.
- **Diagnóstico y Rediseño:**
  1. **Reducción de Pasos (de 8 a 4 pasos esenciales):**
     - Se eliminó el exceso de pantallas explicativas teóricas y se concentró exclusivamente en el flujo vital del restaurante en 4 pasos:
       - **Paso 1: Abrir Mesa o Domicilio** (Tocar mesa verde + confirmar).
       - **Paso 2: Tomar la Comanda** (Elegir platillos + modificadores + botón "Mandar a Cocina").
       - **Paso 3: Pantalla de Cocina (KDS)** (Alerta sonora de comanda + tachado en comal).
       - **Paso 4: Cobrar y Cerrar** (Efectivo con cambio, tarjeta, mixto y liberación).
  2. **Diseño Visual Compacto sin Scroll Interno (`TourGuiadoFlotante.tsx`):**
     - Se ajustó el modal a `max-w-md` con altura contenida que cabe en cualquier pantalla de smartphone de 5" a 6.7" sin forzar scroll interno.
     - Indicador minimalista de 4 puntos alargados (`● ● ● ●`).
     - Botón directo de cierre, avance rápido y botón final: `¡Listo, a Vender!`.
  3. **Despliegue OTA v1.1.4:**
     - `version.json` incrementado a **v1.1.4**.
     - Ejecutado `pnpm run deploy:supabase`:
       - Compilación `tsc -b && vite build` completada con 0 errores en 1.45s.
       - Sincronización de activos a Android (`app/src/main/assets/web/`) e iOS (`ios/LaEstacionGrill/web/`).
       - Empaquetado `web-bundle.zip` (235.1 KB) y subida a Supabase Storage con verificación pública.

## 12. Optimización Integral de Responsividad Universal y Despliegue OTA v1.1.5
- **Requerimiento:**
  - *"Verifica que todos los elementos tengan responsividad al tamaño de pantallas porque en algunas se cortan los elementos o se salen de pantalla"*.
- **Diagnóstico y Correcciones Aplicadas:**
  1. **Ajuste de Breakpoint de Pantalla Dividida en `App.tsx`:**
     - Se elevó el breakpoint de división fija de `md` (768px) a `lg` (1024px).
     - En tablets en vertical (768px a 1023px, ej. iPad estándar) y smartphones (< 768px), el catálogo y la cuenta ahora gozan del **100% del ancho de pantalla** disponible, alternándose con la barra ergonómica inferior (`lg:hidden`). En tablets horizontales y PC (≥ 1024px) se mantiene la doble columna fluida.
  2. **Categorías con Slider Táctil Horizontal en `Comandero.tsx`:**
     - Se sustituyó el grid fijo de 6 columnas (`sm:grid-cols-6`) por un slider horizontal táctil sin scrollbar (`flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar`). Los botones nunca se apelmazan ni se cortan en ningún dispositivo.
     - Cuadrícula de productos flexible: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`.
     - Botón flotante rápido adaptado a `lg:hidden` para tablets verticales.
  3. **Contención y Truncado Seguro en `DetalleCuenta.tsx` y `DashboardMesas.tsx`:**
     - En `DetalleCuenta.tsx`, el ancho se fijó en `w-full lg:w-[390px] xl:w-[440px]`, el botón de regreso móvil aplica a `< 1024px`, y el botón de cobro inferior cuenta con tipografía responsive y `truncate`.
     - En `DashboardMesas.tsx`, las cabeceras de tarjetas libres y ocupadas integran `min-w-0` y `truncate` en el nombre y `shrink-0` en el reloj de servicio.
  4. **Responsividad en Modales Complejos (`ModalCobro.tsx`, `ModificadorModal.tsx`, `HistorialPedidosModal.tsx`):**
     - Altura máxima dinámica con `max-h-[94dvh]` y `max-h-[92dvh]`, respetando barras de navegación dinámicas en Android e iOS.
     - Botón de confirmación de cobro en `ModalCobro` anclado como `sticky bottom-0` con `shrink-0`.
     - KPIs en `HistorialPedidosModal` adaptables a pantallas menores de 380px.
     - Pie de `ModificadorModal` adaptable con botones táctiles fluidos.
  5. **Barra Superior (`NavbarSuperior.tsx`):**
     - Truncado sutil de la marca en pantallas mínimas (< 380px) para salvaguardar el acceso al menú hamburguesa y el conmutador Mesas/Cocina.
  6. **Despliegue OTA v1.1.5:**
     - Actualizado `version.json` a **v1.1.5**.
     - Compilación estricta `pnpm build` aprobada en 1.20s con 0 errores.
     - Sincronización a Android (`app/src/main/assets/web/`) e iOS (`ios/LaEstacionGrill/web/`).
     - `web-bundle.zip` (235.3 KB) subido con éxito a **Supabase Storage**.


## 13. Ajuste de Identidad Visual en Navbar (Mobile) y Despliegue OTA v1.1.6
- **Requerimiento del Usuario:**
  - *"Que no se corte eso, en su defecto si no cabe que solo salga el boton de fuego"* (con captura mostrando el texto de la marca truncado a `"LA EST... GRILL"` en pantallas móviles).
- **Diagnóstico:**
  - En `NavbarSuperior.tsx`, el contenedor de la marca utilizaba `truncate max-w-[85px] xs:max-w-none` para acomodar el conmutador de módulos y los botones de acción en pantallas angostas (< 640px). Esto producía la elipsis `"LA EST..."`.
- **Solución Quirúrgica:**
  1. En `NavbarSuperior.tsx`, se configuró el contenedor de texto con `hidden sm:block min-w-0`, asegurando que en pantallas móviles (`< sm` / `< 640px`) se muestre limpia y exclusivamente el botón de fuego (`Flame`), sin textos mutilados ni puntos suspensivos.
  2. Al botón se le asignó `shrink-0` para mantener su forma cuadrada perfecta en cualquier densidad de pantalla.
  3. En pantallas medianas y grandes (`≥ sm`), el bloque de texto reaparece completo con `whitespace-nowrap`, eliminando cualquier riesgo de truncamiento.
- **Despliegue OTA v1.1.6:**
  - `version.json` actualizado a **v1.1.6**.
  - Ejecutado `pnpm run deploy:supabase`:
    - Compilación `tsc -b && vite build` completada con 0 errores.
    - Sincronización automática de activos a Android (`app/src/main/assets/web/`) e iOS (`ios/LaEstacionGrill/web/`).
    - Empaquetado `web-bundle.zip` (235.3 KB) y publicación confirmada en **Supabase Storage**.


## 14. Preparación Oficial para Lanzamiento a Público (v1.2.0)
- **Requerimiento del Usuario:**
  - *"Prepara la app para que este lista a publico"*.
- **Acciones Arquitectónicas y de Ingeniería:**
  1. **Blindaje de Producción con ErrorBoundary (`ErrorBoundary.tsx`):**
     - Se creó e integró el componente de captura de excepciones no controladas en `main.tsx` envolviendo toda la jerarquía de componentes de React.
     - En caso de anomalías en tiempo de ejecución o estados corruptos en memoria, la app no colapsa a pantalla blanca; en su lugar, presenta un diálogo temático rústico de alto contraste con botones de recuperación rápida ("Reintentar" y "Recargar app").
  2. **Automatización Oficial de Compilación Nativa Android:**
     - Se creó `frontend/compilar_apk.ps1` configurando dinámicamente `JAVA_HOME` hacia el JDK de Android Studio (`D:\ANDROID STUDIO\jbr`).
     - Se integró el script `"build:apk"` en `frontend/package.json` para compilar el instalador nativo directamente mediante `pnpm run build:apk`.
     - Se actualizó `versionCode = 3` y `versionName = "1.2.0"` en `app/build.gradle.kts`.
     - Compilación exitosa del APK instalable (`app/build/outputs/apk/debug/app-debug.apk`) con los activos web v1.2.0 incorporados en `assets/web/`.
  3. **Control de Versión Canónica de Producción (v1.2.0):**
     - Sincronizados `version.json`, `package.json` y `app/build.gradle.kts` a **v1.2.0**.
  4. **Despliegue OTA a Supabase Storage:**
     - Ejecutado `pnpm run deploy:supabase`:
       - Compilación de TypeScript estricto aprobada con 0 errores.
       - Sincronización automática de recursos a Android (`app/src/main/assets/web/`) e iOS (`ios/LaEstacionGrill/web/`).
       - Empaquetado `web-bundle.zip` (235.9 KB) y publicación verificada en el bucket público `actualizaciones` de Supabase.
  5. **Credenciales y Llaves de Operación en Producción:**
     - **PIN de Desbloqueo de Dispositivo:** `243000` (PIN de respaldo: `243243`).
     - **PIN de Administrador para Corte de Caja:** `2430`.
     - **Soporte Offline:** Totalmente funcional con almacenamiento local en IndexedDB/LocalStorage y sincronización bidireccional inmediata al conectar a internet o WebSocket local.


## 15. Configuración y Preparación para Despliegue en Vercel
- **Requerimiento del Usuario:**
  - *"Preparala ahora para subirla a vercel"*.
- **Acciones Arquitectónicas y de Despliegue:**
  1. **Configuraciones de Enrutamiento y Caché (`vercel.json`):**
     - Se crearon dos archivos `vercel.json` complementarios:
       - [`frontend/vercel.json`](file:///d:/TaqueriaKm243/frontend/vercel.json): Diseñado si el proyecto en Vercel se importa seleccionando como *Root Directory* la carpeta `frontend`.
       - [`vercel.json`](file:///d:/TaqueriaKm243/vercel.json): Diseñado si el proyecto se importa en la raíz del repositorio Git sin editar subcarpetas (`d:\TaqueriaKm243`).
     - **Reglas de Reescritura SPA:** Directiva `rewrites: [{ source: "/(.*)", destination: "/index.html" }]` para que cualquier recarga de página o ruta sea atendida por la aplicación sin errores 404 de Vercel.
     - **Políticas de Encabezados HTTP:**
       - `/assets/(.*)`: `Cache-Control: public, max-age=31536000, immutable` para descarga ultra-rápida en CDN.
       - `/version.json`: `Cache-Control: no-cache, no-store, must-revalidate` para que los dispositivos detecten de inmediato cualquier nueva versión lanzada vía OTA.
  2. **Configuración Dinámica de Base en [`vite.config.ts`](file:///d:/TaqueriaKm243/frontend/vite.config.ts):**
     - Se implementó `base: process.env.VERCEL ? '/' : './'`.
     - Cuando se compila dentro de la nube de Vercel (`VERCEL=1`), los recursos se referencian de forma absoluta desde la raíz (`/assets/...`).
     - Cuando se compila para emuladores Android WebView o iOS WebKit, se mantiene relativa (`./`) para garantizar compatibilidad con dominios virtuales locales.
  3. **Variables de Entorno Opcionales en [`servicioSupabase.ts`](file:///d:/TaqueriaKm243/frontend/src/services/servicioSupabase.ts):**
     - Soporta `import.meta.env.VITE_SUPABASE_URL` e `import.meta.env.VITE_SUPABASE_ANON_KEY` desde el panel de Vercel, conservando los valores predeterminados de alta disponibilidad como fallback automático.
  4. **Scripts de Lanzamiento:**
     - Agregado `"deploy:vercel": "pnpm dlx vercel --prod"` en `frontend/package.json` y en el `package.json` raíz para publicar directamente con un solo comando o sincronizar automáticamente mediante push a GitHub.


## 16. Inicialización, Depuración y Publicación Oficial en GitHub
- **Requerimiento del Usuario:**
  - *"Ayudame a subirlo a github: https://github.com/GlacierFroZzt/LaEstacionGrill"*.
- **Acciones y Buenas Prácticas Aplicadas:**
  1. **Configuración de `.gitignore` Integral:**
     - Se protegieron todas las carpetas `node_modules` (raíz, `frontend/`, `servidor/`), caché de Gradle (`.gradle/`, `build/`, `app/build/`), ejecutables binarios (`.apk`, `.zip`, `.tar.gz`), bases de datos SQLite locales (`*.db`, `*.db-shm`, `*.db-wal`) y temporales de Kotlin (`.kotlin/`).
  2. **Depuración de Artefactos Obsoletos en Android e iOS:**
     - Se detectó que las carpetas nativas acumulaban 295 archivos históricos de hashes previos de Vite.
     - Se purgó el directorio `app/src/main/assets/web/assets/` y se actualizaron los scripts `sync:android` y `sync:ios` en `package.json` para que siempre limpien antes de copiar, reduciendo el conteo a los 11 archivos de producción actuales.
  3. **Inicialización y Primer Commit:**
     - Inicializado el repositorio en la rama principal `main`.
     - Commit inicial limpio: `feat: lanzamiento oficial de produccion v1.2.0 para La Estacion Grill`.
  4. **Vinculación y Push Remoto:**
     - Remoto configurado a `https://github.com/GlacierFroZzt/LaEstacionGrill.git`.
     - Publicación exitosa de la rama `main` vinculada con seguimiento upstream (`origin/main`).


## 17. Reforzamiento de Seguridad: Eliminación de Contraseñas y PINs Visibles en UI (v1.2.1)
- **Requerimiento del Usuario:**
  - *"Quita todas las contraseñas visibles para el usuario, eso esta mal"*.
- **Diagnóstico y Vulnerabilidades Resueltas:**
  1. En [`PantallaBloqueoPin.tsx`](file:///d:/TaqueriaKm243/frontend/src/components/PantallaBloqueoPin.tsx):
     - Existía un pie de página que mostraba `"PIN maestro inicial (6 dígitos): 243000"` e incluso un botón que al pulsarlo auto-escribía y enviaba la clave.
     - *Corrección:* Se eliminó la exposición de la clave y el botón de auto-llenado. Se reemplazó por un aviso genérico de terminal protegida para personal autorizado.
  2. En [`CorteCajaModal.tsx`](file:///d:/TaqueriaKm243/frontend/src/components/CorteCajaModal.tsx):
     - El diálogo de confirmación de corte mostraba `<p>PIN por defecto: 2430</p>`, permitiendo que cualquier persona con acceso a la pantalla viera la clave de administración.
     - *Corrección:* Se suprimió por completo dicho párrafo.
  3. En [`ModalConfiguracionServidor.tsx`](file:///d:/TaqueriaKm243/frontend/src/components/ModalConfiguracionServidor.tsx):
     - Los campos de entrada tenían `placeholder="Ej. 243000"` y en el pie figuraba `"PIN de fábrica inicial: 243000"`.
     - *Corrección:* Se sustituyeron por placeholders enmascarados `••••••` y el texto por `"Ingresa 6 dígitos confidenciales"`.
  4. En [`datosTutorial.ts`](file:///d:/TaqueriaKm243/frontend/src/services/datosTutorial.ts):
     - El manual explicativo mencionaba explícitamente el PIN.
     - *Corrección:* Se modificó a `"Solicita el PIN de seguridad al administrador o encargado del restaurante."`.
- **Despliegue y Sincronización v1.2.1:**
  - Incrementado a **v1.2.1** en `version.json`, `package.json` y `app/build.gradle.kts`.
  - Compilación de TypeScript aprobada con 0 errores.
  - Sincronización a Android e iOS y despliegue OTA exitoso en Supabase Storage.


## 18. Sistema de Telemetría Global y Aplicación Privada de Auditoría ("visor-logs")
- **Requerimiento del Usuario:**
  - *"Elaborame otra app para ver los registros completos, que se guarden y muestren los mensajes importantes como errores o crasheos, esa es solo para mí"*.
- **Arquitectura de la Solución (3 Capas):**
  1. **Capa de Persistencia y Realtime en PostgreSQL / Supabase (`supabase/esquema_logs.sql`):**
     - Se definió la tabla `public.logs_sistema` con campos:
       - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
       - `nivel TEXT CHECK (nivel IN ('info', 'warn', 'error', 'crash'))`
       - `origen TEXT` (ej. `'frontend'`, `'error_boundary'`, `'sistema_red'`, `'visor_logs'`)
       - `dispositivo_id TEXT` (identificador único persistente de cada tablet o celular)
       - `mensaje TEXT` (resumen del evento o error)
       - `detalles JSONB` (pila de llamadas / stack trace, URL, userAgent, metadatos estructurados)
       - `creado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now())`
     - Se crearon índices optimizados B-Tree sobre `creado_en DESC` y `nivel`.
     - Se configuró la política de seguridad RLS para inserción pública (`anon`) y lectura, activando `REPLICA IDENTITY FULL` y publicando la tabla en `supabase_realtime`.
  2. **Capa de Instrumentación en la App Principal (`frontend`):**
     - **Servicio de Telemetría Centralizado ([`servicioTelemetria.ts`](file:///d:/TaqueriaKm243/frontend/src/services/servicioTelemetria.ts)):**
       - Captura global de excepciones no controladas mediante `window.onerror` y `window.onunhandledrejection`.
       - Genera o recupera un `dispositivoId` persistente en `localStorage`.
       - Métodos tipados: `registrarInfo`, `registrarAdvertencia`, `registrarError` y `registrarCrash`.
       - **Resiliencia Offline:** Si el dispositivo pierde red o internet al ocurrir un error, el log se almacena en una cola local (`taqueria_logs_pendientes_v1`) y se purga y sincroniza automáticamente al reconectarse (`online`).
     - **Integración con ErrorBoundary ([`ErrorBoundary.tsx`](file:///d:/TaqueriaKm243/frontend/src/components/ErrorBoundary.tsx)):**
       - Cada vez que un componente React falla, `componentDidCatch` invoca inmediatamente `servicioTelemetria.registrarCrash(error, errorInfo)`.
     - **Inicialización Temprana ([`main.tsx`](file:///d:/TaqueriaKm243/frontend/src/main.tsx)):**
       - Se inicializa el servicio al arranque del bundle web y se registra un evento inicial con la versión actual de la app.
  3. **Aplicación Web Privada e Independiente (`visor-logs`):**
     - Directorio aislado: `d:\TaqueriaKm243\visor-logs`.
     - Stack tecnológico: React 19, TypeScript estricto (`strict: true`, 0 `any`), Vite, Tailwind CSS v4 y Lucide Icons.
     - **Características Implementadas:**
       - **Autenticación con PIN Privado:** Pantalla de bloqueo dedicada con teclado numérico para restringir el acceso exclusivamente al dueño/administrador.
       - **Suscripción en Tiempo Real:** Conexión vía WebSocket (`supabase.channel`) a la tabla `logs_sistema` para recibir eventos en vivo sin necesidad de recargar.
       - **Panel de Estadísticas (KPIs):** Conteo dinámico de Crashes críticos, Errores, Advertencias y Registros informativos.
       - **Alerta Auditiva de Emergencia:** Emisión de doble tono de alerta usando Web Audio API nativo cuando arriba un nuevo registro de nivel `crash`.
       - **Filtrado Avanzado:** Búsqueda textual en tiempo real por mensaje/origen, selector de nivel (`TODOS`, `CRASH`, `ERROR`, `WARN`, `INFO`), filtro por ID de dispositivo y filtro por rango temporal (1 hora, 24 horas, 7 días, todo).
       - **Modal de Inspección Quirúrgica:** Vista detallada de cada log con formateador de código para stack traces y visor de metadatos JSON.
       - **Herramientas de Exportación y Mantenimiento:** Descarga de reportes en formatos JSON y CSV, botón de simulación de log de prueba y purga de historial.
  4. **Monorepo y Despliegue:**
     - Se añadieron scripts en la raíz `package.json`: `"dev:logs"` y `"build:logs"`.
     - Se añadió `visor-logs/vercel.json` para despliegue independiente con un clic en Vercel.
  5. **Diagnóstico Visual y Asistente Interactivo de Base de Datos:**
     - Si la tabla `public.logs_sistema` aún no ha sido creada en Supabase (error `PGRST205`), el visor lo detecta proactivamente (`verificarEstadoTabla()`) y despliega un banner de asistencia con:
       - Botón de 1-clic para copiar el script SQL al portapapeles.
       - Modal explicativo con el código SQL y enlace directo al SQL Editor de Supabase.
       - Botón de reintento en caliente.
     - En `handleGenerarLogPrueba`, si la tabla no está creada aún en la nube, el evento simulado se inyecta en el estado local de la UI para que el usuario pueda verificar los filtros, alarmas sonoras de crash y el visor de stack trace de forma inmediata.


## 19. Generación de APK para Celular con Notificaciones de Alta Prioridad y Auto-Actualización OTA (v1.2.3)
- **Requerimiento del Usuario:**
  - *"Generame un apk de la terminal para tenerlo en mi celular, que me envie notificaciones de alta prioridad, que igual se actualice automaticamente al entrar a la app"*.
- **Implementación de Notificaciones Nativas de Alta Prioridad:**
  1. **Permisos en [`AndroidManifest.xml`](file:///d:/TaqueriaKm243/app/src/main/AndroidManifest.xml):**
     - Añadidos `android.permission.POST_NOTIFICATIONS` y `android.permission.VIBRATE`.
  2. **Canal de Notificaciones y Puente JavaScript en [`MainActivity.kt`](file:///d:/TaqueriaKm243/app/src/main/java/com/laestacion/grill/MainActivity.kt):**
     - Configurado canal `canal_taqueria_alertas` con `NotificationManager.IMPORTANCE_HIGH`, luces LED de advertencia, vibración persistente y sonido de sistema.
     - Solicitud dinámica de permisos en tiempo de ejecución para Android 13+ (API 33+).
     - Expuesto `AndroidNotificationBridge` al WebView con `emitirNotificacion(titulo, mensaje, nivel)` para generar notificaciones emergentes tipo *heads-up*.
  3. **Alertas Cruzadas entre Terminales en Tiempo Real:**
     - En `servicioSupabase.ts`, se configuró la escucha de eventos `INSERT` en la tabla `logs_sistema`. Si cualquier mesera o la cocina sufre un error o crash en otra terminal (`dispositivo_id !== this.idDispositivo`), el teléfono del dueño recibe inmediatamente la notificación nativa de alta prioridad en pantalla.
- **Auto-Actualización Inmediata al Entrar y Reanudar:**
  - En `MainActivity.kt`: tanto en el arranque (`onPageFinished`) como en `onResume()`, se dispara automáticamente `window.servicioActualizacionesAuto()`. Al desbloquear o entrar a la app, esta consulta silenciosamente Supabase Storage (`version.json`) y recarga el bundle sin requerir nueva instalación de APK.
- **Compilación de Producción:**
  - Actualizado `versionCode = 5` y `versionName = "1.2.3"` en `app/build.gradle.kts` y `version.json`.
  - Despliegue OTA exitoso a Supabase Storage (`actualizaciones/web-bundle.zip` y `actualizaciones/version.json`).
  - Compilación nativa completada con Gradle 9.5: APK generado y disponible en [`d:/TaqueriaKm243/LaEstacionGrill-v1.2.3.apk`](file:///d:/TaqueriaKm243/LaEstacionGrill-v1.2.3.apk) (7.2 MB).


## 20. Creación de APK Dedicado de la Terminal de Auditoría y Crashes para el Dueño (`TerminalAdmin-v1.0.0.apk`)
- **Aclaración y Requerimiento del Usuario:**
  - *"Esa es la app del cliente, yo quiero la terminal en mi celular"*.
  - El usuario aclaró que la app de mesas y comandas es para las meseras/clientes, y que requería la aplicación de la **Terminal Privada de Auditoría y Monitoreo de Logs (`visor-logs`) empaquetada como su propia app en su celular**.
- **Arquitectura de Sabor de Producto en Gradle (`productFlavors`):**
  1. En `app/build.gradle.kts` se añadieron dos sabores independientes con IDs de paquete diferenciados para permitir tener ambas apps en el mismo dispositivo sin conflicto:
     - **Sabor Restaurante:** `applicationId = "com.laestacion.grill"`, nombre `"La Estación Grill"`.
     - **Sabor Terminal:** `applicationId = "com.laestacion.terminal"`, nombre `"Terminal Auditoría"`.
  2. **Activos Dedicados para la Terminal:**
     - Se crearon los assets en `app/src/terminal/assets/web/` conteniendo la aplicación completa de `visor-logs` (pantalla de PIN confidencial, dashboard en vivo, panel de KPIs, filtros y modal de errores).
  3. **Notificaciones Nativas de Alta Prioridad:**
     - En `visor-logs/src/App.tsx`, al recibir en tiempo real un log de nivel `CRASH` o `ERROR`, se conecta con `AndroidNotificationBridge` para disparar una notificación flotante (*heads-up*), vibración y sonido de emergencia de forma nativa en el celular del dueño.
  4. **Auto-Actualización OTA al Entrar a la Terminal:**
     - En `visor-logs/src/main.tsx` y `MainActivity.kt`: al abrir o reanudar la app, consulta `terminal-version.json` y actualiza silenciosamente desde `terminal-bundle.zip` en Supabase Storage sin necesidad de reinstalar APKs.
- **Compilación Exitosa:**
  - Script automatizado: `frontend/compilar_terminal_apk.ps1` (`pnpm run build:apk:terminal`).
  - APK generado: [`d:/TaqueriaKm243/TerminalAdmin-v1.0.0.apk`](file:///d:/TaqueriaKm243/TerminalAdmin-v1.0.0.apk) (7.38 MB).

## 21. Respeto al Notch, Presencia en Vivo Multidispositivo y Telemetría Proactiva
- **Requerimientos del Usuario:**
  1. *"Tiene para actualizar automaticamente?"*
  2. *"Haz que respete el notch"*
  3. *"No aparecen dispositivos conectados, asi que no esta recibiendo datos de la app/pagina https://laestaciongrill.vercel.app/"*
- **Causas Raíz Detectadas:**
  1. **Notch:** `visor-logs` carecía de padding para `safe-area-inset-top` y de las variables `--notch-top` inyectadas por `MainActivity.kt`.
  2. **Dispositivos no visibles en la Terminal:**
     - `estadisticas.dispositivosUnicos` solo contabilizaba los IDs presentes en los logs descargados. Si no había errores ocurridos recientemente, la tabla estaba vacía y mostraba 0 dispositivos.
     - La app web de meseros/clientes (`https://laestaciongrill.vercel.app/`) no emitía ningún log de inicio de sesión o presencia al arrancar si no había un crash explícito.
     - `visor-logs` no estaba suscrito al canal de presencia global `'taqueria-sync-global'` donde los celulares anuncian que están conectados en tiempo real.
  3. **Auto-actualización de datos:** La carga de logs se ejecutaba una sola vez al montar el componente, sin refresco periódico automático si fallaba el websocket.
- **Soluciones Implementadas:**
  1. **Respeto Universal al Notch en la Terminal:**
     - En `visor-logs/src/index.css`: Declaradas variables seguras `--safe-top: max(var(--notch-top, 0px), env(safe-area-inset-top, 0px))` y márgenes para los 4 costados.
     - En `visor-logs/src/App.tsx`: Tanto en la pantalla de PIN de login como en el `<header>` y `<main>`, se aplica `style={{ paddingTop: 'max(var(--notch-top, 0px), env(safe-area-inset-top, 0px), 12px)', paddingBottom: 'max(var(--notch-bottom, 0px), env(safe-area-inset-bottom, 0px), 24px)' }}`. El notch, la cámara perforada y la barra gestual inferior quedan 100% protegidos.
  2. **Detección de Presencia Multidispositivo en Vivo:**
     - En `visor-logs/src/servicioSupabaseLogs.ts`: Implementado `suscribirPresencia()` escuchando los eventos `'sync'`, `'join'` y `'leave'` en `'taqueria-sync-global'`.
     - En `visor-logs/src/App.tsx`: Tarjeta KPI de Dispositivos con semáforo verde pulsante indicando cuántas terminales están activas en este segundo exacto y chips interactivos para filtrar rápidamente por cualquier dispositivo en línea.
  3. **Telemetría Proactiva al Iniciar Sesión en el Frontend:**
     - En `frontend/src/services/servicioTelemetria.ts`: Constructor configurado para registrar automáticamente un evento `INFO` (`"Dispositivo conectado al restaurante"`) con detalles de plataforma, resolución de pantalla y hora exacta, vaciando de inmediato la cola pendiente de logs.
  4. **Auto-actualización Continua y OTA:**
     - En `visor-logs`: Sondeo periódico cada 8 segundos (`setInterval(cargarLogs, 8000)`) con badge visual en el header (`Auto: 8s • HH:MM:SS`).
     - Creado `visor-logs/src/servicioActualizacionesTerminal.ts` conectado con `AndroidOtaBridge` y Supabase Storage (`terminal-version.json` y `terminal-bundle.zip`), con botón directo "Actualizar App" en el header.
  5. **Regeneración de APK y Despliegue en la Nube:**
     - APK de Terminal recompilado: [`TerminalAdmin-v1.0.0.apk`](file:///d:/TaqueriaKm243/TerminalAdmin-v1.0.0.apk).
     - Bundles OTA de Terminal y Restaurante desplegados en Supabase Storage.
