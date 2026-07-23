import { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, Loader2, Check, X, Receipt, FileText, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';

const CATEGORIAS = ['Supermercado', 'Fornecedor', 'Farmácia', 'Combustível', 'Outros'];

// Câmera ao vivo só rola em contexto seguro (https ou localhost). Em http://IP
// o navegador bloqueia getUserMedia — aí caímos no input de arquivo (que no
// celular já abre a câmera nativa via 'capture').
const temCameraAoVivo = () =>
  typeof navigator !== 'undefined' &&
  window.isSecureContext &&
  !!navigator.mediaDevices?.getUserMedia;

/**
 * "Lançar por foto" — o dono tira/sobe uma foto de cupom OU boleto; a IA (Vision)
 * lê, distingue o tipo e mostra um preview editável antes de gravar.
 *   • Comprovante → DESPESA (variável) + itens (custo de ingrediente aprendido).
 *   • Boleto → tela de BOLETOS.
 * Reusa a mesma lógica do assistente do WhatsApp, sem depender do bot ligado.
 */
export default function LancarPorFoto({ onSaved }) {
  const inputCameraRef = useRef(null); // input com 'capture' (câmera no mobile)
  const inputArquivoRef = useRef(null); // input normal (galeria/arquivo)
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState('escolha'); // escolha | camera | lendo | preview | salvando
  const [tipo, setTipo] = useState(null);
  const [dados, setDados] = useState(null);

  // Conecta o stream ao <video> quando entra no modo câmera.
  useEffect(() => {
    if (etapa === 'camera' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play?.().catch(() => {});
    }
  }, [etapa]);

  // Garante que a câmera desliga se o componente sair.
  useEffect(() => () => pararCamera(), []);

  function pararCamera() {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
  }

  function abrir() { setDados(null); setTipo(null); setEtapa('escolha'); setAberto(true); }
  function fechar() { pararCamera(); setAberto(false); setEtapa('escolha'); setDados(null); setTipo(null); }

  // ── Câmera ao vivo ─────────────────────────────────────────────
  async function tirarFoto() {
    if (!temCameraAoVivo()) {
      // Sem câmera ao vivo (http/IP ou sem permissão): usa o input com 'capture'.
      // No celular isso abre a câmera nativa; no PC, o seletor de arquivo.
      inputCameraRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setEtapa('camera');
    } catch (e) {
      toast.error('Não consegui abrir a câmera. Use "Enviar arquivo".');
      inputCameraRef.current?.click();
    }
  }

  function capturar() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 1080;
    canvas.height = v.videoHeight || 1440;
    canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
    pararCamera();
    canvas.toBlob(
      (blob) => { if (blob) analisar(new File([blob], 'foto.jpg', { type: 'image/jpeg' })); },
      'image/jpeg', 0.9
    );
  }

  // ── Upload / análise ───────────────────────────────────────────
  function aoSelecionar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) analisar(file);
  }

  async function analisar(file) {
    setEtapa('lendo');
    try {
      const fd = new FormData();
      fd.append('foto', file);
      const d = await api.postForm('/despesas/comprovante/analisar', fd);
      setTipo(d.tipo);
      setDados(d);
      setEtapa('preview');
    } catch (err) {
      toast.error(err.message || 'Não consegui ler a foto.');
      setEtapa('escolha');
    }
  }

  function set(campo, valor) { setDados((d) => ({ ...d, [campo]: valor })); }

  async function confirmar() {
    setEtapa('salvando');
    try {
      const r = await api.post('/despesas/comprovante/confirmar', { tipo, dados });
      toast.success(
        r.tipo === 'boleto'
          ? '📄 Boleto registrado! Confere na tela de Boletos.'
          : `🧾 Despesa registrada!${r.itens ? ` ${r.itens} item(ns) guardados.` : ''}`,
        { duration: 5000 }
      );
      fechar();
      onSaved?.(r);
    } catch (err) {
      toast.error(err.message || 'Não consegui gravar.');
      setEtapa('preview');
    }
  }

  const itens = Array.isArray(dados?.itens) ? dados.itens : [];

  return (
    <>
      <input ref={inputCameraRef} type="file" accept="image/*" capture="environment" onChange={aoSelecionar} className="hidden" />
      <input ref={inputArquivoRef} type="file" accept="image/*" onChange={aoSelecionar} className="hidden" />

      <button onClick={abrir}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95"
        style={{ background: 'var(--space-elev)', border: '1px solid rgba(var(--accent-rgb),0.35)', color: 'var(--accent)' }}>
        <Camera size={16} strokeWidth={2.2} /> Lançar por foto
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(6,8,13,0.72)', backdropFilter: 'blur(5px)' }}
          onClick={(e) => e.target === e.currentTarget && etapa !== 'salvando' && fechar()}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
            style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline-strong)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
              <div className="flex items-center gap-2.5">
                {tipo === 'boleto'
                  ? <FileText size={18} style={{ color: 'var(--accent)' }} />
                  : tipo === 'comprovante'
                    ? <Receipt size={18} style={{ color: 'var(--accent)' }} />
                    : <Camera size={18} style={{ color: 'var(--accent)' }} />}
                <p className="font-black" style={{ color: 'var(--txt-strong)' }}>
                  {etapa === 'lendo' ? 'Lendo a foto…'
                    : etapa === 'camera' ? 'Enquadre o cupom / boleto'
                    : tipo === 'boleto' ? 'Boleto detectado'
                    : tipo === 'comprovante' ? 'Comprovante detectado'
                    : 'Lançar por foto'}
                </p>
              </div>
              {etapa !== 'salvando' && (
                <button onClick={fechar} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}>
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Corpo */}
            <div className="overflow-y-auto px-5 py-4">
              {/* Escolha: tirar foto x enviar arquivo */}
              {etapa === 'escolha' && (
                <div className="grid grid-cols-2 gap-3 py-2">
                  <button onClick={tirarFoto}
                    className="flex flex-col items-center gap-2 py-6 rounded-2xl transition active:scale-95"
                    style={{ background: 'rgba(var(--accent-rgb),0.10)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
                    <Camera size={26} style={{ color: 'var(--accent)' }} />
                    <span className="text-[13px] font-bold" style={{ color: 'var(--txt-strong)' }}>Tirar foto</span>
                  </button>
                  <button onClick={() => inputArquivoRef.current?.click()}
                    className="flex flex-col items-center gap-2 py-6 rounded-2xl transition active:scale-95"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}>
                    <ImageIcon size={26} style={{ color: 'var(--txt-dim)' }} />
                    <span className="text-[13px] font-bold" style={{ color: 'var(--txt-strong)' }}>Enviar arquivo</span>
                  </button>
                  <p className="col-span-2 text-[11.5px] text-center mt-1" style={{ color: 'var(--txt-dim)' }}>
                    🥷 No celular, "Tirar foto" abre a câmera direto. No PC, a câmera ao vivo funciona quando o site estiver em HTTPS.
                  </p>
                </div>
              )}

              {/* Câmera ao vivo */}
              {etapa === 'camera' && (
                <div className="space-y-3">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-2xl bg-black" style={{ maxHeight: '55vh' }} />
                  <div className="flex gap-2">
                    <button onClick={() => { pararCamera(); setEtapa('escolha'); }}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}>
                      Voltar
                    </button>
                    <button onClick={capturar}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white"
                      style={{ background: 'var(--accent)' }}>
                      <Camera size={16} /> Capturar
                    </button>
                  </div>
                </div>
              )}

              {/* Lendo */}
              {etapa === 'lendo' && (
                <div className="flex flex-col items-center gap-3 py-10">
                  <Loader2 size={30} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <p className="text-sm text-center" style={{ color: 'var(--txt-dim)' }}>O ninja tá lendo a foto e separando os valores… 🥷</p>
                </div>
              )}

              {/* Preview editável */}
              {(etapa === 'preview' || etapa === 'salvando') && dados && (
                <div className="space-y-3">
                  {tipo === 'boleto' ? (
                    <>
                      <Campo label="Fornecedor / Beneficiário" value={dados.fornecedor || ''} onChange={(v) => set('fornecedor', v)} />
                      <div className="grid grid-cols-2 gap-3">
                        <Campo label="Valor (R$)" type="number" value={dados.valor || ''} onChange={(v) => set('valor', v)} />
                        <Campo label="Vencimento" type="date" value={dados.vencimento || ''} onChange={(v) => set('vencimento', v)} />
                      </div>
                    </>
                  ) : (
                    <>
                      <Campo label="Estabelecimento" value={dados.estabelecimento || ''} onChange={(v) => set('estabelecimento', v)} />
                      <div className="grid grid-cols-2 gap-3">
                        <Campo label="Total (R$)" type="number" value={dados.valor || ''} onChange={(v) => set('valor', v)} />
                        <Campo label="Data" type="date" value={dados.data || ''} onChange={(v) => set('data', v)} />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--txt-faint)' }}>CATEGORIA</label>
                        <select value={dados.categoria || 'Supermercado'} onChange={(e) => set('categoria', e.target.value)}
                          className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
                          style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)', outline: 'none' }}>
                          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      {itens.length > 0 && (
                        <div>
                          <label className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--txt-faint)' }}>{itens.length} ITEM(NS) LIDO(S)</label>
                          <div className="mt-1 rounded-xl divide-y max-h-48 overflow-y-auto" style={{ background: 'var(--card-items-bg)', border: '1px solid var(--hairline)' }}>
                            {itens.map((it, i) => (
                              <div key={i} className="flex justify-between gap-2 px-3 py-2 text-[13px]" style={{ borderColor: 'var(--hairline)' }}>
                                <span className="truncate" style={{ color: 'var(--txt)' }}>{it.descricao}</span>
                                <span className="shrink-0 font-semibold" style={{ color: 'var(--txt-strong)' }}>R$ {it.valor}</span>
                              </div>
                            ))}
                          </div>
                          <p className="mt-1.5 text-[11.5px]" style={{ color: 'var(--txt-dim)' }}>
                            🥷 Itens já ensinados atualizam o custo do ingrediente sozinhos. Os novos ficam pendentes de vínculo em Ingredientes.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  <button onClick={() => { setDados(null); setTipo(null); setEtapa('escolha'); }}
                    className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--txt-dim)' }}>
                    <RefreshCw size={12} /> Tirar outra foto
                  </button>
                </div>
              )}
            </div>

            {/* Footer (só no preview) */}
            {(etapa === 'preview' || etapa === 'salvando') && dados && (
              <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--hairline)' }}>
                <button onClick={fechar} disabled={etapa === 'salvando'}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}>
                  Cancelar
                </button>
                <button onClick={confirmar} disabled={etapa === 'salvando'}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white"
                  style={{ background: 'var(--accent)', opacity: etapa === 'salvando' ? 0.6 : 1 }}>
                  {etapa === 'salvando'
                    ? <><Loader2 size={15} className="animate-spin" /> Gravando…</>
                    : <><Check size={15} /> {tipo === 'boleto' ? 'Registrar boleto' : 'Registrar despesa'}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Campo({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--txt-faint)' }}>{label.toUpperCase()}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        step={type === 'number' ? '0.01' : undefined}
        className="w-full mt-1 rounded-xl px-3 py-2 text-sm"
        style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)', outline: 'none' }} />
    </div>
  );
}
