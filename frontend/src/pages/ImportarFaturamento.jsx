import React, { useState, useRef } from 'react';
import { getToken } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Wallet,
  RefreshCw,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });

const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brDate = s => s.split('-').reverse().join('/');

export default function ImportarFaturamento() {
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [modo, setModo] = useState('pular');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  async function carregarPreview(file) {
    setPreview(null);
    setResultado(null);
    setLoading(true);
    const fd = new FormData();
    fd.append('arquivo', file);
    try {
      const r = await fetch(`${BASE}/importar/faturamento/preview`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao ler arquivo');
      setPreview(d);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  function onFile(file) {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Use um arquivo .xlsx ou .xls');
      return;
    }
    setArquivo(file);
    carregarPreview(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files?.[0]);
  }

  async function confirmar() {
    if (!arquivo) return;
    setConfirmando(true);
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    fd.append('modo', modo);
    try {
      const r = await fetch(`${BASE}/importar/faturamento/confirmar`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro');
      setResultado(d);
      toast.success(`Importação concluída! ${d.criados} criados, ${d.sobrescritos} sobrescritos, ${d.ignorados} ignorados.`);
    } catch (e) { toast.error(e.message); }
    finally { setConfirmando(false); }
  }

  function resetar() {
    setArquivo(null);
    setPreview(null);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />

      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <Wallet size={20} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">Importar Faturamento</h1>
          <p className="text-sm text-slate-400">Traga o histórico de outro PDV para o Faturamento Diário</p>
        </div>
        {(arquivo || resultado) && (
          <button onClick={resetar} className="ml-auto flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg">
            <RefreshCw size={14} /> Nova importação
          </button>
        )}
      </div>

      {resultado && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <span className="font-semibold text-emerald-300">Importação concluída</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total processado', val: resultado.total, color: 'text-slate-200' },
              { label: 'Criados',       val: resultado.criados,     color: 'text-emerald-400' },
              { label: 'Sobrescritos',  val: resultado.sobrescritos, color: 'text-amber-400' },
              { label: 'Ignorados',     val: resultado.ignorados,    color: 'text-slate-400' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!preview && !loading && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all p-12 text-center mb-6
            ${dragging ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'}`}
        >
          <FileSpreadsheet size={40} className={`mx-auto mb-3 ${dragging ? 'text-emerald-400' : 'text-slate-500'}`} />
          <p className="text-slate-300 font-medium mb-1">Arraste o arquivo ou clique para selecionar</p>
          <p className="text-sm text-slate-500">Exportação de outro PDV com as abas "Movimentação Financeira" e "Geral" — .xlsx</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center mb-6">
          <RefreshCw size={32} className="mx-auto text-emerald-400 animate-spin mb-3" />
          <p className="text-slate-400">Lendo planilha…</p>
        </div>
      )}

      {preview && !resultado && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet size={16} className="text-emerald-400" />
              <span className="font-medium text-slate-200">{arquivo?.name}</span>
            </div>
            <div className="flex gap-3 text-sm text-slate-400">
              <span><strong className="text-slate-200">{preview.total_dias}</strong> dias</span>
              <span>{brDate(preview.periodo.inicio)} a {brDate(preview.periodo.fim)}</span>
              {preview.qtd_conflitos > 0 && (
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle size={14} /> {preview.qtd_conflitos} já têm lançamento
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-400">Data</th>
                    <th className="px-3 py-2 text-right text-slate-400">Pedidos</th>
                    <th className="px-3 py-2 text-right text-slate-400">Total</th>
                    <th className="px-3 py-2 text-right text-slate-400">PIX</th>
                    <th className="px-3 py-2 text-right text-slate-400">Dinheiro</th>
                    <th className="px-3 py-2 text-right text-slate-400">Cartão</th>
                    <th className="px-3 py-2 text-right text-slate-400">Débito</th>
                    <th className="px-3 py-2 text-left text-slate-400"></th>
                  </tr>
                </thead>
                <tbody>
                  {preview.dias.map(d => (
                    <tr key={d.data} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                      <td className="px-3 py-1.5 text-slate-300 whitespace-nowrap">{brDate(d.data)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-300">{d.quantidade_pedidos}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-slate-100">{brl(d.total_bruto)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{brl(d.pix)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{brl(d.dinheiro)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{brl(d.credito)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{brl(d.debito)}</td>
                      <td className="px-3 py-1.5">
                        {d.ja_existe && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-400 whitespace-nowrap">
                            já existe ({brl(d.valor_atual)})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-wrap items-center gap-4">
            {preview.qtd_conflitos > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-300 mb-2">Dias que já têm lançamento:</p>
                <div className="flex gap-2">
                  {[
                    { val: 'pular',        label: 'Pular',        desc: 'Mantém o lançamento existente' },
                    { val: 'sobrescrever', label: 'Sobrescrever', desc: 'Substitui pelo valor da planilha' },
                  ].map(({ val, label, desc }) => (
                    <button
                      key={val}
                      onClick={() => setModo(val)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                        modo === val
                          ? 'bg-emerald-500 text-slate-900 border-emerald-400'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {label}
                      <span className={`block text-[10px] font-normal ${modo === val ? 'text-slate-800' : 'text-slate-500'}`}>{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="ml-auto flex gap-3">
              <button onClick={resetar} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors">
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={confirmando}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {confirmando ? <><RefreshCw size={14} className="animate-spin" /> Importando…</> : <><Upload size={14} /> Importar {preview.total_dias} dias</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
