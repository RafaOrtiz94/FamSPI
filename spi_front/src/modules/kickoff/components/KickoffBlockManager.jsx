import React, { useState, useEffect, useCallback } from 'react';
import kickoffApi from '../api/kickoffApi';
import toast from 'react-hot-toast';

const BLOCK_TYPES = ['image', 'info', 'text', 'question', 'poll', 'video', 'custom'];

const EMPTY_BLOCK = { title: '', content: '', image_url: '', block_type: 'image', sort_order: 0 };

const inputCls = 'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

export default function KickoffBlockManager({ presentationId, presentationTitle }) {
  const [blocks,   setBlocks]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState(null);   // null | {…block} — null = cerrado
  const [isNew,    setIsNew]    = useState(false);

  const load = useCallback(async () => {
    if (!presentationId) return;
    setLoading(true);
    try {
      const res = await kickoffApi.getPresentation(presentationId);
      setBlocks(res.data?.blocks || []);
    } catch {
      toast.error('Error al cargar diapositivas');
    } finally {
      setLoading(false);
    }
  }, [presentationId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    const nextOrder = blocks.length > 0
      ? Math.max(...blocks.map(b => b.sort_order)) + 1
      : 1;
    setForm({ ...EMPTY_BLOCK, sort_order: nextOrder });
    setIsNew(true);
  };

  const openEdit = (block) => {
    setForm({ ...block });
    setIsNew(false);
  };

  const closeForm = () => { setForm(null); setIsNew(false); };

  const save = async () => {
    if (!form) return;
    if (!form.title && !form.image_url) {
      toast.error('Agrega al menos un título o una URL de imagen');
      return;
    }
    setSaving(true);
    try {
      await kickoffApi.upsertBlock(presentationId, {
        id:         isNew ? undefined : form.id,
        title:      form.title || '',
        content:    form.content || '',
        image_url:  form.image_url || null,
        block_type: form.block_type || 'image',
        sort_order: Number(form.sort_order) || 0,
      });
      toast.success(isNew ? 'Diapositiva agregada' : 'Diapositiva actualizada');
      closeForm();
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (block) => {
    if (!window.confirm(`¿Eliminar la diapositiva "${block.title || `#${block.sort_order}`}"?`)) return;
    try {
      await kickoffApi.deleteBlock(presentationId, block.id);
      toast.success('Diapositiva eliminada');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al eliminar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-800">Diapositivas</h4>
          <p className="text-xs text-slate-400 mt-0.5">{presentationTitle} — {blocks.length} diapositiva{blocks.length !== 1 ? 's' : ''} configurada{blocks.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          + Agregar diapositiva
        </button>
      </div>

      {/* Lista de bloques */}
      {blocks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
          <p className="text-slate-400 text-sm">Sin diapositivas configuradas</p>
          <p className="text-slate-300 text-xs mt-1">Agrega una diapositiva para que el proyector pueda mostrarla</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...blocks].sort((a, b) => a.sort_order - b.sort_order).map((block) => (
            <div
              key={block.id}
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3"
            >
              {/* Thumbnail */}
              <div className="w-14 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                {block.image_url ? (
                  <img src={block.image_url} alt={block.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 text-lg">
                    {block.block_type === 'image' ? '🖼️' : '📝'}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {block.title || <span className="text-slate-400 italic">Sin título</span>}
                </p>
                <p className="text-xs text-slate-400">
                  Orden {block.sort_order} · {block.block_type}
                  {block.is_active && (
                    <span className="ml-2 text-green-600 font-semibold">● activa</span>
                  )}
                </p>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => openEdit(block)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Editar
                </button>
                <button
                  onClick={() => remove(block)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de edición / creación */}
      {form && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 flex flex-col gap-4 mt-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-bold text-blue-900">
              {isNew ? 'Nueva diapositiva' : `Editando: ${form.title || 'sin título'}`}
            </h5>
            <button onClick={closeForm} className="text-xs text-blue-400 hover:text-blue-600">✕ Cancelar</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={inputCls}
                placeholder="Título de la diapositiva"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</label>
              <select
                value={form.block_type}
                onChange={e => setForm(f => ({ ...f, block_type: e.target.value }))}
                className={inputCls}
              >
                {BLOCK_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              URL de imagen
              <span className="ml-1 text-slate-400 normal-case font-normal">(exportada de Canva, Drive, Imgur, etc.)</span>
            </label>
            <input
              value={form.image_url}
              onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
              className={inputCls + ' font-mono text-xs'}
              placeholder="https://…/slide-1.png"
            />
            {form.image_url && (
              <img
                src={form.image_url}
                alt="preview"
                className="mt-1 max-h-32 rounded-xl object-contain border border-slate-200 bg-slate-50"
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contenido / Notas</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={2}
              className={inputCls}
              placeholder="Texto que se muestra si no hay imagen…"
            />
          </div>

          <div className="flex flex-col gap-1.5 w-28">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Orden</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
              className={inputCls}
              min={0}
            />
          </div>

          <button
            disabled={saving}
            onClick={save}
            className="self-start px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : isNew ? '+ Agregar' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}
