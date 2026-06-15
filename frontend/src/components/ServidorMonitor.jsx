import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

// ──────────────────────────────────────────────────────────────
//  Camada 4 — monitor de servidor (avisar ANTES do cliente)
//  Faz ping no /api/health a cada 8s. Se o SERVIDOR parar de responder
//  (processo caído, banco travado, rede da loja fora), mostra um banner
//  vermelho gritante no topo + som — pra o operador saber NA HORA, em vez
//  de descobrir só quando o cliente reclamar. Diferente do OfflineIndicator,
//  que só vê a internet do aparelho: este testa o nosso servidor de verdade.
// ──────────────────────────────────────────────────────────────

function beep() {} // som desativado

export default function ServidorMonitor() {
  const [estado, setEstado] = useState('ok'); // 'ok' | 'fora' | 'voltou'
  const [dispensado, setDispensado] = useState(false); // operador fechou o aviso
  const falhasRef = useRef(0);
  const foraRef = useRef(false);
  const desdeRef = useRef(null);
  const dispensadoRef = useRef(false);
  function dispensar() { dispensadoRef.current = true; setDispensado(true); }

  useEffect(() => {
    let beepIv = null;

    async function checar() {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(t);
        if (!r.ok) throw new Error('health nao ok');
        falhasRef.current = 0;
        if (foraRef.current) {
          // Voltou: mostra "voltou" por 4s e silencia. Reseta o "dispensado"
          // para que uma PRÓXIMA queda volte a alertar normalmente.
          foraRef.current = false;
          desdeRef.current = null;
          dispensadoRef.current = false;
          setDispensado(false);
          const eraDispensado = dispensado;
          setEstado('voltou');
          if (!eraDispensado) beep(523, 784); // som de alívio (só se não tinha dispensado)
          setTimeout(() => setEstado('ok'), 4000);
        }
      } catch {
        falhasRef.current++;
        // 6 falhas seguidas (≈80s) = considera fora, evita alarme por engasgo
        if (falhasRef.current >= 6 && !foraRef.current) {
          foraRef.current = true;
          desdeRef.current = new Date();
          setEstado('fora');
          beep();
        }
      }
    }

    checar();
    const iv = setInterval(checar, 15000);
    // Enquanto fora E não dispensado, repete o som a cada 20s
    beepIv = setInterval(() => { if (foraRef.current && !dispensadoRef.current) beep(); }, 20000);

    return () => { clearInterval(iv); clearInterval(beepIv); };
  }, []);

  if (estado === 'ok') return null;

  const fora = estado === 'fora';
  // Se o operador fechou o aviso de "fora do ar", não mostra mais (até voltar)
  if (fora && dispensado) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      padding: '12px 16px', fontWeight: 800, fontSize: 15, color: '#fff',
      background: fora ? 'linear-gradient(90deg,#b91c1c,#dc2626,#b91c1c)' : 'linear-gradient(90deg,#15803d,#16a34a,#15803d)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      animation: fora ? 'svmon-pisca 1s ease-in-out infinite' : 'none',
    }}>
      <style>{`@keyframes svmon-pisca{0%,100%{opacity:1}50%{opacity:.72}}`}</style>
      <span style={{ fontSize: 18 }}>{fora ? '🚨' : '✅'}</span>
      {fora
        ? <span>SISTEMA FORA DO AR — verifique o servidor (a janela do Sushi Control deve estar aberta)</span>
        : <span>Sistema reconectado — tudo normal</span>}
      {fora && (
        <button onClick={dispensar} title="Dispensar aviso"
          style={{ marginLeft: 8, width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
          <X size={16} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
