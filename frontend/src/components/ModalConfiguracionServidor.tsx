import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, Lock, KeyRound, Smartphone } from 'lucide-react';
import { servicioSupabase } from '../services/servicioSupabase';
import { servicioSeguridadPin } from '../services/servicioSeguridadPin';
import { RepositorioStorage } from '../services/repositorioStorage';

interface PropsModalConfiguracionServidor {
  abierto: boolean;
  alCerrar: () => void;
  estaConectado: boolean;
  totalDispositivos: number;
}

export const ModalConfiguracionServidor: React.FC<PropsModalConfiguracionServidor> = ({
  abierto,
  alCerrar,
  estaConectado,
}) => {
  const [probando, setProbando] = useState<boolean>(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<{
    tipo: 'exito' | 'error' | null;
    mensaje: string;
  }>({ tipo: null, mensaje: '' });
  const [pinActualInput, setPinActualInput] = useState<string>('');
  const [pinNuevoInput, setPinNuevoInput] = useState<string>('');
  const [mensajePin, setMensajePin] = useState<{ tipo: 'exito' | 'error' | null; texto: string }>({
    tipo: null,
    texto: '',
  });
  const [nombreDispositivo, setNombreDispositivo] = useState<string>(() =>
    RepositorioStorage.obtenerNombreDispositivo()
  );
  const [mensajeNombre, setMensajeNombre] = useState<{ tipo: 'exito' | 'error' | null; texto: string }>({
    tipo: null,
    texto: '',
  });

  useEffect(() => {
    if (abierto) {
      setResultadoPrueba({ tipo: null, mensaje: '' });
      setMensajePin({ tipo: null, texto: '' });
      setPinActualInput('');
      setPinNuevoInput('');
      setNombreDispositivo(RepositorioStorage.obtenerNombreDispositivo());
      setMensajeNombre({ tipo: null, texto: '' });
    }
  }, [abierto]);

  if (!abierto) return null;

  const manejarPruebaConexion = async (): Promise<void> => {
    setProbando(true);
    setResultadoPrueba({ tipo: null, mensaje: '' });
    try {
      const creds = servicioSupabase.obtenerCredenciales();
      const res = await servicioSupabase.probarConexion(creds.url, creds.key);
      setResultadoPrueba({
        tipo: res.ok ? 'exito' : 'error',
        mensaje: res.mensaje,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setResultadoPrueba({
        tipo: 'error',
        mensaje: `Error al probar: ${errorMsg}`,
      });
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 text-white flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☁️</span>
            <div>
              <h3 className="text-lg font-bold">Conexión del Restaurante</h3>
              <p className="text-xs text-slate-400">Sincronización en tiempo real y respaldo sin internet</p>
            </div>
          </div>
          <button
            onClick={alCerrar}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Estado actual */}
        <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3.5 h-3.5 rounded-full ${
                estaConectado ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <div>
              <p className="text-sm font-semibold">
                {estaConectado ? 'Conectado en tiempo real' : 'Modo local (Sin internet)'}
              </p>
              <p className="text-xs text-slate-400">
                {estaConectado
                  ? 'Los pedidos se comparten de inmediato entre todos los dispositivos'
                  : 'Puedes seguir tomando pedidos; se sincronizarán al recuperar la señal'}
              </p>
            </div>
          </div>
          <button
            onClick={() => servicioSupabase.reiniciarCliente()}
            className="px-2.5 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
            title="Reconectar servicio"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reconectar</span>
          </button>
        </div>

        {/* Conexión Oficial Protegida */}
        <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Conexión Segura del Restaurante</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              Activa
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            La infraestructura y el enlace de datos están encriptados y protegidos internamente para garantizar la sincronización continua y la estabilidad del servicio.
          </p>
        </div>

        {/* Botón de Diagnóstico */}
        <button
          onClick={manejarPruebaConexion}
          disabled={probando}
          className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow cursor-pointer active:scale-98"
        >
          {probando ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Comprobando estado del enlace...
            </span>
          ) : (
            '🔍 Comprobar Conexión'
          )}
        </button>

        {/* Feedback de la prueba */}
        {resultadoPrueba.tipo && (
          <div
            className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ${
              resultadoPrueba.tipo === 'exito'
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
            }`}
          >
            {resultadoPrueba.tipo === 'exito' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold mb-0.5">
                {resultadoPrueba.tipo === 'exito' ? 'Conexión Confirmada' : 'Error de Conexión'}
              </p>
              <p>{resultadoPrueba.mensaje}</p>
            </div>
          </div>
        )}

        {/* Sección de Nombre del Dispositivo */}
        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Nombre de este Dispositivo / Terminal</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              Auditoría
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Identifica a este celular o tablet en la terminal de auditoría, logs y conexiones (ej:{' '}
            <strong className="text-slate-300">iPhone de Juan</strong>,{' '}
            <strong className="text-slate-300">Tablet Barra</strong>).
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const limpio = nombreDispositivo.trim();
              if (!limpio) {
                setMensajeNombre({ tipo: 'error', texto: 'El nombre no puede estar vacío.' });
                return;
              }
              RepositorioStorage.guardarNombreDispositivo(limpio);
              servicioSupabase.actualizarPresencia().catch(console.error);
              setMensajeNombre({ tipo: 'exito', texto: `¡Nombre guardado como "${limpio}"!` });
              setTimeout(() => setMensajeNombre({ tipo: null, texto: '' }), 3500);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={nombreDispositivo}
              onChange={(e) => {
                setNombreDispositivo(e.target.value);
                if (mensajeNombre.tipo) setMensajeNombre({ tipo: null, texto: '' });
              }}
              placeholder="Ej. iPhone de Juan, Tablet Caja..."
              maxLength={35}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-amber-500 font-medium"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 shadow-sm"
            >
              Guardar
            </button>
          </form>

          {mensajeNombre.tipo && (
            <div
              className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                mensajeNombre.tipo === 'exito'
                  ? 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-700/60 text-rose-300'
              }`}
            >
              {mensajeNombre.tipo === 'exito' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span>{mensajeNombre.texto}</span>
            </div>
          )}
        </div>

        {/* Sección de Seguridad y PIN de Terminal */}
        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Seguridad y PIN de Terminal</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              6 Dígitos
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Protege el acceso a la app en iPhones y tablets. Los dispositivos requerirán este código de 6 dígitos cada vez que se abra la app.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const res = servicioSeguridadPin.actualizarPin(pinActualInput, pinNuevoInput);
              if (res.ok) {
                setMensajePin({ tipo: 'exito', texto: res.mensaje });
                setPinActualInput('');
                setPinNuevoInput('');
              } else {
                setMensajePin({ tipo: 'error', texto: res.mensaje });
              }
            }}
            className="space-y-3 pt-1"
          >
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  PIN Actual
                </label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="••••••"
                  value={pinActualInput}
                  onChange={(e) => setPinActualInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Nuevo PIN (6 dígitos)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="••••••"
                  value={pinNuevoInput}
                  onChange={(e) => setPinNuevoInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {mensajePin.texto && (
              <div
                className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                  mensajePin.tipo === 'exito'
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-800 text-rose-300'
                }`}
              >
                {mensajePin.tipo === 'exito' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{mensajePin.texto}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-500">
                Ingresa 6 dígitos confidenciales
              </span>
              <button
                type="submit"
                disabled={pinActualInput.length !== 6 || pinNuevoInput.length !== 6}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Guardar Nuevo PIN</span>
              </button>
            </div>
          </form>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={alCerrar}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer active:scale-95 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
