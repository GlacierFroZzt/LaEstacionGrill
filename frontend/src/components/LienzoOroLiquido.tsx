import React, { useEffect, useRef } from 'react';

/**
 * Propiedades para personalizar el efecto de oro líquido fundido.
 */
export interface PropsLienzoOroLiquido {
  readonly className?: string;
  readonly velocidad?: number; // Factor de velocidad del flujo (defecto: 1.0)
  readonly brillo?: number; // Intensidad de destellos especulares (defecto: 1.0)
  readonly contraste?: number; // Contraste de las ondas (defecto: 1.0)
  readonly densidadOndas?: number; // Escala de los pliegues y ondas (defecto: 3.5)
}

// Shader de vértices mínimo: cubre toda la pantalla/contenedor con 2 triángulos
const VERTEX_SHADER = `
attribute vec2 a_posicion;
varying vec2 v_uv;
void main() {
  v_uv = (a_posicion + 1.0) * 0.5;
  gl_Position = vec4(a_posicion, 0.0, 1.0);
}
`;

// Fragment shader: simulación de oro fundido en estado líquido con cáusticas y brillos especulares
const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_uv;
uniform vec2 u_resolucion;
uniform vec4 u_faseOndas1;
uniform vec4 u_faseOndas2;
uniform vec4 u_faseLuz;
uniform float u_brillo;
uniform float u_contraste;
uniform float u_densidad;

// Simulación de pliegues viscosos y pesados de metal derretido en flujo continuo
// Las fases u_faseOndas se mantienen acotadas en [0, 2π) desde JavaScript para
// garantizar precisión matemática perfecta y evitar degradación por tiempo en móviles.
float mapaAltura(vec2 uv) {
  // Escala amplia para que las ondas sean grandes y fluidas, no diminutas ni ruidosas
  vec2 p = uv * (u_densidad * 0.75);
  
  // Corriente primaria de fluido espeso
  vec2 d1 = vec2(
    sin(p.y * 1.4 + u_faseOndas1.x),
    cos(p.x * 1.3 - u_faseOndas1.y)
  ) * 0.55;
  
  // Remolino secundario suave (simula la viscosidad del oro fundido)
  vec2 d2 = vec2(
    cos((p.x + d1.x) * 1.6 - u_faseOndas1.z),
    sin((p.y + d1.y) * 1.5 + u_faseOndas1.w)
  ) * 0.35;
  
  vec2 coordFluida = p + d1 + d2;
  
  // Ondas amplias y ondulantes
  float onda1 = sin(coordFluida.x * 1.5 + u_faseOndas2.x);
  float onda2 = cos(coordFluida.y * 1.4 - u_faseOndas2.y);
  float onda3 = sin((coordFluida.x + coordFluida.y) * 1.1 + u_faseOndas2.z);
  
  float h = (onda1 * 0.45 + onda2 * 0.40 + onda3 * 0.15);
  return h * 0.5 + 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolucion.xy;
  float aspecto = u_resolucion.x / u_resolucion.y;
  vec2 uvCorregida = vec2(uv.x * aspecto, uv.y);

  // Diferencias finitas con espaciado amplio para normales suaves y curvadas
  float eps = 0.012;
  float c = mapaAltura(uvCorregida);
  float hx = mapaAltura(uvCorregida + vec2(eps, 0.0));
  float hy = mapaAltura(uvCorregida + vec2(0.0, eps));
  
  // Normal suave y curvada (elimina por completo el grano de purpurina)
  vec3 normal = normalize(vec3((hx - c) / eps * 1.4, (hy - c) / eps * 1.4, 0.65));
  
  // Fuente de luz principal
  vec3 posLuz1 = normalize(vec3(
    sin(u_faseLuz.x) * 0.6,
    cos(u_faseLuz.y) * 0.5 + 0.3,
    0.85
  ));
  
  vec3 posLuz2 = normalize(vec3(
    -cos(u_faseLuz.z) * 0.7,
    -sin(u_faseLuz.w) * 0.6,
    0.70
  ));
  
  vec3 direccionVista = vec3(0.0, 0.0, 1.0);
  vec3 mitadLuz1 = normalize(posLuz1 + direccionVista);
  vec3 mitadLuz2 = normalize(posLuz2 + direccionVista);
  
  float difusa1 = max(dot(normal, posLuz1), 0.0);
  float difusa2 = max(dot(normal, posLuz2), 0.0);
  
  // Especular satinado y amplio de metal líquido (NO destellos puntuales de grano)
  float especularSatinado = pow(max(dot(normal, mitadLuz1), 0.0), 14.0) * (u_brillo * 0.85);
  float destelloCresta = pow(max(dot(normal, mitadLuz1), 0.0), 32.0) * (u_brillo * 0.65);
  float especularCruzado = pow(max(dot(normal, mitadLuz2), 0.0), 16.0) * (u_brillo * 0.45);
  
  float fresnel = pow(1.0 - max(dot(normal, direccionVista), 0.0), 2.2);
  
  // Paleta de Oro Fundido en Estado Líquido:
  // - Ámbar tostado profundo (fondos y valles): #261603
  // - Oro bronce cálido: #78350f
  // - Oro clásico 24K fundido: #d4af37
  // - Oro solar brillante: #facc15
  // - Reflejo líquido champaña suave: #fff8db
  vec3 colorProfundo = vec3(0.15, 0.09, 0.02);
  vec3 colorBronce = vec3(0.52, 0.28, 0.04);
  vec3 colorOroPuro = vec3(0.86, 0.70, 0.22);
  vec3 colorOroBrillante = vec3(0.99, 0.85, 0.28);
  vec3 colorLuzLiquida = vec3(1.0, 0.98, 0.86);
  
  // Mezcla fluida y suave sin cortes bruscos
  vec3 colorBase = mix(colorProfundo, colorBronce, smoothstep(0.10, 0.40, c));
  colorBase = mix(colorBase, colorOroPuro, smoothstep(0.35, 0.70, c));
  colorBase = mix(colorBase, colorOroBrillante, smoothstep(0.65, 0.95, c));
  
  // Aplicación del reflejo metálico líquido satinado
  vec3 colorFinal = colorBase * (0.60 + 0.30 * difusa1 * u_contraste + 0.10 * difusa2)
                  + colorLuzLiquida * (especularSatinado + destelloCresta + especularCruzado)
                  + colorOroBrillante * (fresnel * 0.40);
                  
  gl_FragColor = vec4(colorFinal, 1.0);
}
`;

/**
 * Componente LienzoOroLiquido: Renderiza un fluido de oro derretido en tiempo real
 * con aceleración GPU (WebGL).
 */
export const LienzoOroLiquido: React.FC<PropsLienzoOroLiquido> = ({
  className = '',
  velocidad = 1.0,
  brillo = 1.0,
  contraste = 1.0,
  densidadOndas = 1.2,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [soportaWebGL, setSoportaWebGL] = React.useState<boolean>(true);
  const [intentosRestauracion, setIntentosRestauracion] = React.useState<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Obtener contexto WebGL con bandera de bajo consumo para cuidar batería en móviles
    const gl = (canvas.getContext('webgl', { powerPreference: 'low-power', alpha: false }) ||
      canvas.getContext('experimental-webgl', {
        powerPreference: 'low-power',
        alpha: false,
      })) as WebGLRenderingContext | null;

    if (!gl) {
      console.warn('WebGL no disponible en este dispositivo, aplicando respaldo estático.');
      setSoportaWebGL(false);
      return;
    }
    setSoportaWebGL(true);

    const compilarShader = (tipo: number, fuente: string): WebGLShader | null => {
      const shader = gl.createShader(tipo);
      if (!shader) return null;
      gl.shaderSource(shader, fuente);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compilando shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertShader = compilarShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragShader = compilarShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    if (!vertShader || !fragShader) return;

    const programa = gl.createProgram();
    if (!programa) return;

    gl.attachShader(programa, vertShader);
    gl.attachShader(programa, fragShader);
    gl.linkProgram(programa);

    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
      console.error('Error enlazando programa WebGL:', gl.getProgramInfoLog(programa));
      return;
    }

    gl.useProgram(programa);

    // Definición de cuadrilátero que llena el área visible
    const vertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]);

    const bufferVertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferVertices);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const locPosicion = gl.getAttribLocation(programa, 'a_posicion');
    gl.enableVertexAttribArray(locPosicion);
    gl.vertexAttribPointer(locPosicion, 2, gl.FLOAT, false, 0, 0);

    // Uniformes del shader
    const locResolucion = gl.getUniformLocation(programa, 'u_resolucion');
    const locFaseOndas1 = gl.getUniformLocation(programa, 'u_faseOndas1');
    const locFaseOndas2 = gl.getUniformLocation(programa, 'u_faseOndas2');
    const locFaseLuz = gl.getUniformLocation(programa, 'u_faseLuz');
    const locBrillo = gl.getUniformLocation(programa, 'u_brillo');
    const locContraste = gl.getUniformLocation(programa, 'u_contraste');
    const locDensidad = gl.getUniformLocation(programa, 'u_densidad');

    let idAnimacion = 0;
    let tiempoAcumulado = 0;
    let ultimoTiempo = performance.now();
    let ultimoFrame = 0;
    let esVisible = true;
    let contextoPerdido = false;

    // Normalizador de ángulo módulo 2π. Garantiza que los valores enviados a la GPU
    // estén estrictamente en el intervalo [0, 2π). Esto elimina por completo el aliasing
    // y la pérdida de precisión en tipos mediump float de GPUs móviles con el paso del tiempo.
    const TAU = Math.PI * 2;
    const normalizarFase = (fase: number): number => {
      const residuo = fase % TAU;
      return residuo >= 0 ? residuo : residuo + TAU;
    };

    // Ajuste dinámico de dimensiones con escala adaptativa:
    // Los fondos amplios (>350px) se escalan a 1.0x para máxima ligereza en GPU y batería,
    // mientras que los botones pequeños aprovechan hasta 1.5x para mantener nitidez en texto.
    const ajustarTamano = () => {
      const esLienzoAmplio = canvas.clientWidth > 350 || canvas.clientHeight > 350;
      const dpr = esLienzoAmplio
        ? Math.min(window.devicePixelRatio || 1, 1.0)
        : Math.min(window.devicePixelRatio || 1, 1.5);

      const anchoDisplay = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const altoDisplay = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width !== anchoDisplay || canvas.height !== altoDisplay) {
        canvas.width = anchoDisplay;
        canvas.height = altoDisplay;
        gl.viewport(0, 0, anchoDisplay, altoDisplay);
      }
    };

    ajustarTamano();
    window.addEventListener('resize', ajustarTamano);

    // Pausar renderizado cuando el componente no está visible en pantalla (ahorro de batería)
    const observer = new IntersectionObserver(
      (entradas) => {
        const entrada = entradas[0];
        if (entrada) {
          esVisible = entrada.isIntersecting;
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    // Manejo de cambio de pestaña y pérdida de foco para suspender ciclos en segundo plano
    const manejarVisibilidadPestana = () => {
      esVisible = !document.hidden;
    };
    const manejarPerdidaFoco = () => {
      esVisible = false;
    };
    const manejarRecuperacionFoco = () => {
      esVisible = !document.hidden;
    };

    document.addEventListener('visibilitychange', manejarVisibilidadPestana);
    window.addEventListener('blur', manejarPerdidaFoco);
    window.addEventListener('focus', manejarRecuperacionFoco);

    // Manejo de eventos de ciclo de vida del contexto WebGL en móviles
    const manejarContextoPerdido = (evento: Event) => {
      evento.preventDefault();
      contextoPerdido = true;
      cancelAnimationFrame(idAnimacion);
    };

    const manejarContextoRestaurado = () => {
      setIntentosRestauracion((prev) => prev + 1);
    };

    canvas.addEventListener('webglcontextlost', manejarContextoPerdido, false);
    canvas.addEventListener('webglcontextrestored', manejarContextoRestaurado, false);

    // Limitador de tasa de cuadros a 30 FPS:
    // Para un fluido denso y continuo de metal derretido, 30 FPS ofrece una suavidad visual
    // indistinguible de 60/120 FPS pero reduce en más del 70% el trabajo de la GPU y CPU.
    const INTERVALO_MS = 1000 / 30;

    const render = (tiempoActual: number) => {
      idAnimacion = requestAnimationFrame(render);

      if (!esVisible || contextoPerdido) {
        ultimoTiempo = tiempoActual;
        return;
      }

      const delta = tiempoActual - ultimoFrame;
      if (delta < INTERVALO_MS) return;

      ultimoFrame = tiempoActual - (delta % INTERVALO_MS);

      // Delta de tiempo seguro (limitado a 100ms) para evitar saltos si el teléfono estuvo en reposo
      const pasoMs = Math.min(Math.max(tiempoActual - ultimoTiempo, 0), 100);
      ultimoTiempo = tiempoActual;

      tiempoAcumulado += pasoMs * 0.001 * velocidad;
      const t = tiempoAcumulado;

      gl.uniform2f(locResolucion, canvas.width, canvas.height);
      gl.uniform4f(
        locFaseOndas1,
        normalizarFase(t * 0.455),
        normalizarFase(t * 0.39),
        normalizarFase(t * 0.2925),
        normalizarFase(t * 0.3575)
      );
      gl.uniform4f(
        locFaseOndas2,
        normalizarFase(t * 0.325),
        normalizarFase(t * 0.26),
        normalizarFase(t * 0.2275),
        0.0
      );
      gl.uniform4f(
        locFaseLuz,
        normalizarFase(t * 0.4),
        normalizarFase(t * 0.5),
        normalizarFase(t * 0.45),
        normalizarFase(t * 0.35)
      );
      gl.uniform1f(locBrillo, brillo);
      gl.uniform1f(locContraste, contraste);
      gl.uniform1f(locDensidad, densidadOndas);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    idAnimacion = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(idAnimacion);
      window.removeEventListener('resize', ajustarTamano);
      document.removeEventListener('visibilitychange', manejarVisibilidadPestana);
      window.removeEventListener('blur', manejarPerdidaFoco);
      window.removeEventListener('focus', manejarRecuperacionFoco);
      canvas.removeEventListener('webglcontextlost', manejarContextoPerdido);
      canvas.removeEventListener('webglcontextrestored', manejarContextoRestaurado);
      observer.disconnect();

      if (!contextoPerdido) {
        if (bufferVertices) gl.deleteBuffer(bufferVertices);
        if (vertShader) gl.deleteShader(vertShader);
        if (fragShader) gl.deleteShader(fragShader);
        if (programa) gl.deleteProgram(programa);
        const loseContextExt = gl.getExtension('WEBGL_lose_context');
        if (loseContextExt) loseContextExt.loseContext();
      }
    };
  }, [velocidad, brillo, contraste, densidadOndas, intentosRestauracion]);

  if (!soportaWebGL) {
    return (
      <div
        className={`block w-full h-full pointer-events-none select-none bg-gradient-to-br from-amber-600 via-amber-400 to-amber-700 opacity-80 ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full h-full pointer-events-none select-none ${className}`}
      aria-hidden="true"
    />
  );
};
