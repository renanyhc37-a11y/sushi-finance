import React, { useState, useRef, useCallback } from 'react';
import { getToken } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Users,
  RefreshCw, ChevronDown, ChevronUp, Eye, ArrowRight, X, Info,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });

const CAMPOS = [
  { key: 'nome',        label: 'Nome',         required: true  },
  { key: 'telefone',    label: 'Telefone',      required: true  },
  { key: 'endereco',    label: 'Endereço',      required: false },
  { key: 'bairro',      label: 'Bairro',        required: false },
  { key: 'email',       label: 'E-mail',        required: false },
  { key: 'aniversario', label: 'Aniversário',   required: false },
  { key: 'obs',         label: 'Observação',    required: false },
  { key: 'pedidos',     label: 'Qtd. Pedidos',  required: false },
];

export default function ImportarClientes() {
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapa, setMapa] = useState({});
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [modo, setModo] = useState('pular');
  const [sheet, setSheet] = useState(null);
  const [previewAberto, setPreviewAberto] = useState(true);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  async function carregarPreview(file, sheetName) {
    setPreview(null);
    setResultado(null);
    setLoading(true);
    const fd = new FormData();
    fd.append('arquivo', file);
    if (sheetName) fd.append('sheet', sheetName);
    try {
      const r = await fetch(`${BASE}/importar/clientes/preview`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao ler arquivo');
      setPreview(d);
      setMapa(d.mapa);
      if (!sheetName && d.sheets?.length > 0) setSheet(d.sheets[0]);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  function onFile(file) {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Use um arquivo .xlsx, .xls ou .csv');
      return;
    }
    setArquivo(file);
    setSheet(null);
    carregarPreview(file, null);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files?.[0]);
  }

  function trocarSheet(s) {
    setSheet(s);
    if (arquivo) carregarPreview(arquivo, s);
  }

  async function confirmar() {
    if (!arquivo) return;
    setConfirmando(true);
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    fd.append('mapa', JSON.stringify(mapa));
    fd.append('modo', modo);
    if (sheet) fd.append('sheet', sheet);
    try {
      const r = await fetch(`${BASE}/importar/clientes/confirmar`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro');
      setResultado(d);
      toast.success(`Importação concluída! ${d.criados} criados, ${d.atualizados} atualizados.`);
    } catch (e) { toast.error(e.message); }
    finally { setConfirmando(false); }
  }

  function resetar() {
    setArquivo(null);
    setPreview(null);
    setMapa({});
    setResultado(null);
    setSheet(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const colOpts = preview
    ? [{ val: -1, label: '— ignorar —' }, ...preview.colunas.map((c, i) => ({ val: i, label: c || `Coluna ${i + 1}` }))]
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Users size={20} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">Importar Clientes</h1>
          <p className="text-sm text-slate-400">Importe sua base do CRM via planilha Excel</p>
        </div>
        {(arquivo || resultado) && (
          <button onClick={resetar} className="ml-auto flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg">
            <RefreshCw size={14} /> Nova importação
          </button>
        )}
      </div>

      {/* Resultado final */}
      {resultado && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <span className="font-semibold text-emerald-300">Importação concluída com sucesso</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Total processado', val: resultado.total, color: 'text-slate-200' },
              { label: 'Criados', val: resultado.criados, color: 'text-emerald-400' },
              { label: 'Atualizados', val: resultado.atualizados, color: 'text-amber-400' },
              { label: 'Ignorados', val: resultado.ignorados, color: 'text-slate-400' },
              { label: 'Erros', val: resultado.erros, color: 'text-red-400' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {resultado.detalhes?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-200">
                Ver detalhes ({resultado.detalhes.length} registros)
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-700">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-400">Nome</th>
                      <th className="px-3 py-2 text-left text-slate-400">Telefone</th>
                      <th className="px-3 py-2 text-left text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.detalhes.map((d, i) => (
                      <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/50">
                        <td className="px-3 py-1.5">{d.nome || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-400">{d.tel || '—'}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            d.status === 'criado' ? 'bg-emerald-500/20 text-emerald-400' :
                            d.status === 'atualizado' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>{d.status || d.erro || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Dropzone */}
      {!preview && !loading && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all p-12 text-center mb-6
            ${dragging ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'}`}
        >
          <FileSpreadsheet size={40} className={`mx-auto mb-3 ${dragging ? 'text-amber-400' : 'text-slate-500'}`} />
          <p className="text-slate-300 font-medium mb-1">Arraste o arquivo ou clique para selecionar</p>
          <p className="text-sm text-slate-500">Suporta .xlsx, .xls e .csv — máx. 10 MB</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center mb-6">
          <RefreshCw size={32} className="mx-auto text-amber-400 animate-spin mb-3" />
          <p className="text-slate-400">Lendo planilha…</p>
        </div>
      )}

      {/* Preview + mapeamento */}
      {preview && !resultado && (
        <div className="space-y-4">
          {/* Info + sheets */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet size={16} className="text-amber-400" />
              <span className="font-medium text-slate-200">{arquivo?.name}</span>
            </div>
            <div className="flex gap-3 text-sm text-slate-400">
              <span><strong className="text-slate-200">{preview.total_linhas}</strong> linhas</span>
              <span><strong className="text-emerald-400">{preview.com_telefone}</strong> com telefone</span>
              <span><strong className="text-slate-200">{preview.colunas.length}</strong> colunas</span>
            </div>
            {preview.sheets?.length > 1 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-slate-500">Aba:</span>
                <div className="flex gap-1">
                  {preview.sheets.map(s => (
                    <button
                      key={s}
                      onClick={() => trocarSheet(s)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        sheet === s ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mapeamento de colunas */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowRight size={16} className="text-amber-400" />
              <h2 className="font-semibold text-slate-200">Mapeamento de colunas</h2>
              <span className="ml-auto text-xs text-slate-500 flex items-center gap-1">
                <Info size={12} /> Detectado automaticamente — ajuste se necessário
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {CAMPOS.map(({ key, label, required }) => (
                <div key={key} className="bg-slate-800/60 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm font-medium text-slate-300">{label}</span>
                    {required && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">obrigatório</span>}
                  </div>
                  <select
                    value={mapa[key] ?? -1}
                    onChange={e => setMapa(m => ({ ...m, [key]: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {colOpts.map(o => (
                      <option key={o.val} value={o.val}>{o.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview da tabela */}
          {preview.preview?.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <button
                onClick={() => setPreviewAberto(p => !p)}
                className="w-full flex items-center gap-2 px-5 py-3 hover:bg-slate-800/40 transition-colors"
              >
                <Eye size={16} className="text-amber-400" />
                <span className="font-semibold text-slate-200 text-sm">Prévia dos dados ({preview.preview.length} primeiras linhas)</span>
                <span className="ml-auto">{previewAberto ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}</span>
              </button>
              {previewAberto && (
                <div className="overflow-x-auto border-t border-slate-800">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800">
                      <tr>
                        {preview.colunas.map((c, i) => (
                          <th key={i} className="px-3 py-2 text-left text-slate-400 whitespace-nowrap font-medium">
                            {c || `Col ${i + 1}`}
                            {Object.entries(mapa).find(([, v]) => v === i) && (
                              <span className="ml-1 text-[10px] text-amber-400 font-normal">
                                → {CAMPOS.find(f => f.key === Object.entries(mapa).find(([, v]) => v === i)?.[0])?.label}
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((row, i) => (
                        <tr key={i} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                          {preview.colunas.map((c, j) => (
                            <td key={j} className="px-3 py-1.5 text-slate-300 whitespace-nowrap max-w-[160px] truncate">
                              {row[c] || <span className="text-slate-600">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Modo + confirmar */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-sm font-medium text-slate-300 mb-2">Duplicatas (mesmo telefone):</p>
              <div className="flex gap-2">
                {[
                  { val: 'pular',    label: 'Ignorar',   desc: 'Mantém dados existentes' },
                  { val: 'atualizar',label: 'Atualizar', desc: 'Complementa dados em branco' },
                ].map(({ val, label, desc }) => (
                  <button
                    key={val}
                    onClick={() => setModo(val)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      modo === val
                        ? 'bg-amber-500 text-slate-900 border-amber-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {label}
                    <span className={`block text-[10px] font-normal ${modo === val ? 'text-slate-800' : 'text-slate-500'}`}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto flex gap-3">
              <button onClick={resetar} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors">
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={confirmando || mapa.telefone === -1 || mapa.telefone === undefined}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {confirmando ? <><RefreshCw size={14} className="animate-spin" /> Importando…</> : <><Upload size={14} /> Importar {preview.total_linhas} clientes</>}
              </button>
            </div>
          </div>

          {mapa.telefone === -1 || mapa.telefone === undefined ? (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-2.5 border border-red-500/20">
              <AlertCircle size={15} />
              Selecione a coluna de <strong>Telefone</strong> antes de importar — ela é obrigatória para identificar duplicatas.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
