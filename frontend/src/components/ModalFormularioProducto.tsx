import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Trash2,
  Plus,
  Check,
  Utensils,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { CategoriaProducto, Producto, FormularioProductoDTO } from '../types';
import { MODIFICADORES_POR_CATEGORIA } from '../data/menuInicial';
import { comprimirImagenADataUrl } from '../utils/compresorImagenes';

interface ModalFormularioProductoProps {
  readonly abierto: boolean;
  readonly productoParaEditar: Producto | null;
  readonly categoriaInicial?: CategoriaProducto;
  readonly onCerrar: () => void;
  readonly onGuardar: (datos: FormularioProductoDTO) => Promise<void> | void;
  readonly esClaro?: boolean;
}

const CATEGORIAS_DISPONIBLES: { id: CategoriaProducto; nombre: string }[] = [
  { id: 'tacos', nombre: '1. Tacos' },
  { id: 'hamburguesas', nombre: '2. Hamburguesas' },
  { id: 'papas', nombre: '3. Papas Asadas' },
  { id: 'antojos', nombre: '4. Antojos' },
  { id: 'bebidas', nombre: '5. Bebidas' },
  { id: 'extras', nombre: '6. Extras' },
];

export const ModalFormularioProducto: React.FC<ModalFormularioProductoProps> = ({
  abierto,
  productoParaEditar,
  categoriaInicial = 'tacos',
  onCerrar,
  onGuardar,
  esClaro = false,
}) => {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [categoria, setCategoria] = useState<CategoriaProducto>(categoriaInicial);
  const [descripcion, setDescripcion] = useState('');
  const [imagenUrl, setImagenUrl] = useState<string | undefined>(undefined);
  const [requierePreparacion, setRequierePreparacion] = useState(true);
  const [modificadores, setModificadores] = useState<string[]>([]);
  const [nuevoModificador, setNuevoModificador] = useState('');

  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  // Inicializar o limpiar campos al abrir el modal o cambiar de producto
  useEffect(() => {
    if (productoParaEditar) {
      setNombre(productoParaEditar.nombre);
      setPrecio(productoParaEditar.precio.toString());
      setCategoria(productoParaEditar.categoria);
      setDescripcion(productoParaEditar.descripcion || '');
      setImagenUrl(productoParaEditar.imagenUrl);
      setRequierePreparacion(
        productoParaEditar.requierePreparacion !== undefined
          ? productoParaEditar.requierePreparacion
          : productoParaEditar.categoria !== 'bebidas'
      );
      setModificadores(
        productoParaEditar.modificadoresSugeridos
          ? [...productoParaEditar.modificadoresSugeridos]
          : []
      );
    } else {
      setNombre('');
      setPrecio('');
      setCategoria(categoriaInicial);
      setDescripcion('');
      setImagenUrl(undefined);
      setRequierePreparacion(categoriaInicial !== 'bebidas');
      setModificadores([]);
    }
    setNuevoModificador('');
    setErrorValidacion(null);
  }, [productoParaEditar, categoriaInicial, abierto]);

  // Si cambia la categoría y es bebida, sugerir por defecto que no va a cocina
  const handleCambiarCategoria = (nuevaCat: CategoriaProducto): void => {
    setCategoria(nuevaCat);
    if (!productoParaEditar) {
      setRequierePreparacion(nuevaCat !== 'bebidas');
    }
  };

  const handleSubirArchivoImagen = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const archivos = e.target.files;
    if (!archivos || archivos.length === 0) return;

    const archivo = archivos[0];
    setProcesandoImagen(true);
    setErrorValidacion(null);

    try {
      const dataUrl = await comprimirImagenADataUrl(archivo, {
        maxAncho: 640,
        maxAlto: 640,
        calidad: 0.82,
        formato: 'image/webp',
      });
      setImagenUrl(dataUrl);
    } catch (err: unknown) {
      console.error('[ModalFormularioProducto] Error al procesar imagen:', err);
      setErrorValidacion('No se pudo procesar la imagen seleccionada. Intenta con otra imagen.');
    } finally {
      setProcesandoImagen(false);
      if (inputArchivoRef.current) {
        inputArchivoRef.current.value = '';
      }
    }
  };

  const handleRemoverImagen = (): void => {
    setImagenUrl(undefined);
    if (inputArchivoRef.current) {
      inputArchivoRef.current.value = '';
    }
  };

  const handleAgregarModificador = (): void => {
    const limpio = nuevoModificador.trim();
    if (!limpio) return;
    if (modificadores.includes(limpio)) {
      setNuevoModificador('');
      return;
    }
    setModificadores([...modificadores, limpio]);
    setNuevoModificador('');
  };

  const handleEliminarModificador = (modAEliminar: string): void => {
    setModificadores(modificadores.filter((m) => m !== modAEliminar));
  };

  const handleCargarSugerenciasCategoria = (): void => {
    const sugeridos = MODIFICADORES_POR_CATEGORIA[categoria] || [];
    const combinados = Array.from(new Set([...modificadores, ...sugeridos]));
    setModificadores(combinados);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const nombreLimpio = nombre.trim();
    const precioNum = Number(precio);

    if (!nombreLimpio) {
      setErrorValidacion('Por favor ingresa el nombre del producto.');
      return;
    }

    if (isNaN(precioNum) || precioNum <= 0) {
      setErrorValidacion('Por favor ingresa un precio válido mayor a 0.');
      return;
    }

    setGuardando(true);
    setErrorValidacion(null);

    try {
      const datos: FormularioProductoDTO = {
        id: productoParaEditar ? productoParaEditar.id : undefined,
        nombre: nombreLimpio,
        descripcion: descripcion.trim(),
        precio: precioNum,
        categoria,
        requierePreparacion,
        imagenUrl: imagenUrl || undefined,
        modificadoresSugeridos: modificadores.length > 0 ? modificadores : undefined,
      };

      await onGuardar(datos);
      onCerrar();
    } catch (err: unknown) {
      console.error('[ModalFormularioProducto] Error al guardar producto:', err);
      setErrorValidacion('Ocurrió un error al guardar el producto. Intenta nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-producto"
    >
      <div
        className={`w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden border shadow-2xl transition-all ${
          esClaro
            ? 'bg-white border-stone-200 text-stone-900 shadow-amber-900/20'
            : 'bg-stone-900 border-amber-500/40 text-stone-100 shadow-black/80'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div
          className={`p-4 border-b flex items-center justify-between shrink-0 ${
            esClaro ? 'border-stone-100 bg-amber-50/50' : 'border-stone-800 bg-stone-950/40'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 id="titulo-modal-producto" className="font-black text-lg leading-tight">
                {productoParaEditar ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <p className="text-xs text-stone-400">
                {productoParaEditar
                  ? 'Modifica los datos y la fotografía del menú'
                  : 'Agrega un nuevo platillo o bebida al menú'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className={`p-2 rounded-full transition-colors ${
              esClaro
                ? 'hover:bg-stone-200 text-stone-500'
                : 'hover:bg-stone-800 text-stone-400'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario con Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorValidacion && (
            <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center gap-2.5 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorValidacion}</span>
            </div>
          )}

          {/* Fotografía del Producto */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-amber-500 mb-2">
              Fotografía del Platillo (Opcional)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div
                className={`relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0 transition-colors ${
                  imagenUrl
                    ? 'border-amber-500/50 bg-stone-950'
                    : esClaro
                    ? 'border-stone-300 bg-stone-100 hover:border-amber-500'
                    : 'border-stone-700 bg-stone-950/60 hover:border-amber-500/60'
                }`}
              >
                {procesandoImagen ? (
                  <div className="flex flex-col items-center justify-center text-xs text-amber-500 font-bold p-2 text-center animate-pulse">
                    <Sparkles className="w-6 h-6 mb-1 animate-spin" />
                    <span>Comprimiendo...</span>
                  </div>
                ) : imagenUrl ? (
                  <>
                    <img
                      src={imagenUrl}
                      alt="Vista previa"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoverImagen}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-red-600/90 hover:bg-red-500 text-white shadow-md active:scale-95 transition-all"
                      title="Quitar foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-3 text-stone-400">
                    <Upload className="w-8 h-8 mb-1 stroke-1 opacity-60" />
                    <span className="text-[11px] font-bold">Sin fotografía</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 flex-1 w-full text-center sm:text-left">
                <input
                  ref={inputArchivoRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSubirArchivoImagen}
                  className="hidden"
                  id="input-foto-producto"
                />
                <label
                  htmlFor="input-foto-producto"
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black cursor-pointer bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md transition-all active:scale-95 w-full sm:w-auto"
                >
                  <Upload className="w-4 h-4" />
                  <span>{imagenUrl ? 'Cambiar Fotografía' : 'Subir desde Dispositivo'}</span>
                </label>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Las fotos se redimensionan y optimizan automáticamente en formato WebP para un
                  guardado ultraligero y offline.
                </p>
              </div>
            </div>
          </div>

          {/* Nombre y Precio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-300 mb-1">
                Nombre del Producto <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Tacos de Barbacoa"
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border outline-none transition-all ${
                  esClaro
                    ? 'bg-stone-50 border-stone-300 text-stone-900 focus:border-amber-500 focus:bg-white'
                    : 'bg-stone-950/80 border-stone-700 text-stone-100 focus:border-amber-500 focus:bg-stone-950'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">
                Precio ($ MXN) <span className="text-amber-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.5"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0.00"
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-black border outline-none transition-all ${
                  esClaro
                    ? 'bg-stone-50 border-stone-300 text-stone-900 focus:border-amber-500 focus:bg-white'
                    : 'bg-stone-950/80 border-stone-700 text-stone-100 focus:border-amber-500 focus:bg-stone-950'
                }`}
              />
            </div>
          </div>

          {/* Selector de Categoría */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">Categoría</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIAS_DISPONIBLES.map((cat) => {
                const seleccionada = categoria === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCambiarCategoria(cat.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all border text-left flex items-center justify-between ${
                      seleccionada
                        ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md'
                        : esClaro
                        ? 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                        : 'bg-stone-800/80 border-stone-700/80 text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    <span>{cat.nombre}</span>
                    {seleccionada && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1">
              Descripción o Ingredientes
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalla qué incluye el platillo o receta especial..."
              className={`w-full px-3.5 py-2 rounded-xl text-xs font-medium border outline-none transition-all resize-none ${
                esClaro
                  ? 'bg-stone-50 border-stone-300 text-stone-900 focus:border-amber-500 focus:bg-white'
                  : 'bg-stone-950/80 border-stone-700 text-stone-100 focus:border-amber-500 focus:bg-stone-950'
              }`}
            />
          </div>

          {/* Switch de Preparación en Cocina (KDS) */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
              esClaro ? 'bg-amber-50/50 border-stone-200' : 'bg-stone-950/40 border-stone-800'
            }`}
          >
            <div>
              <span className="text-xs font-bold text-stone-200 block">
                ¿Enviar orden a pantalla de cocina (KDS)?
              </span>
              <p className="text-[11px] text-stone-400">
                {requierePreparacion
                  ? 'Sí: se mostrará al taquero/cocinero en la pantalla de pedidos.'
                  : 'No: bebida o producto directo despachado de inmediato por el mesero.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRequierePreparacion(!requierePreparacion)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
                requierePreparacion ? 'bg-amber-500' : 'bg-stone-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  requierePreparacion ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Modificadores Rápidos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-300">
                Modificadores Rápidos Contextuales
              </label>
              <button
                type="button"
                onClick={handleCargarSugerenciasCategoria}
                className="text-[11px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cargar sugerencias</span>
              </button>
            </div>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={nuevoModificador}
                onChange={(e) => setNuevoModificador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAgregarModificador();
                  }
                }}
                placeholder="Ej. Con aguacate, Salsa aparte..."
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border outline-none ${
                  esClaro
                    ? 'bg-stone-50 border-stone-300 text-stone-900 focus:border-amber-500'
                    : 'bg-stone-950/80 border-stone-700 text-stone-100 focus:border-amber-500'
                }`}
              />
              <button
                type="button"
                onClick={handleAgregarModificador}
                className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1 active:scale-95 border border-stone-700"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </div>

            {modificadores.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 rounded-xl bg-stone-950/30 border border-stone-800/80">
                {modificadores.map((mod) => (
                  <span
                    key={mod}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                      esClaro
                        ? 'bg-stone-100 border-stone-200 text-stone-800'
                        : 'bg-stone-800 border-stone-700 text-stone-200'
                    }`}
                  >
                    <span>{mod}</span>
                    <button
                      type="button"
                      onClick={() => handleEliminarModificador(mod)}
                      className="hover:text-red-400 p-0.5 rounded transition-colors"
                      title="Eliminar modificador"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Pie con Acciones */}
        <div
          className={`p-4 border-t flex items-center justify-end gap-3 shrink-0 ${
            esClaro ? 'border-stone-100 bg-stone-50' : 'border-stone-800 bg-stone-950/50'
          }`}
        >
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              esClaro
                ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
            }`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={guardando || procesandoImagen}
            className="py-2.5 px-5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {guardando ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{productoParaEditar ? 'Actualizar Producto' : 'Guardar Producto'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
