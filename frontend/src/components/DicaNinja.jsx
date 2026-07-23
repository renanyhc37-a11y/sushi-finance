import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { dicasDaPagina, dicaOculta, ocultarDica } from '../lib/onboarding';

/**
 * Dicas do ninja no topo de uma página — em CARROSSEL: arrasta pro lado (dedo no
 * mobile, mouse no desktop) pra ver as outras. Dispensável e com memória: quando
 * o dono fecha, não volta a aparecer (localStorage). Legal sem ser chato.
 *
 * Uso:  <DicaNinja id="fichas" />
 * Puxa a dica específica da página (lib/onboarding.js) + as dicas gerais.
 */
export default function DicaNinja({ id }) {
  const dicas = dicasDaPagina(id);
  const [fechada, setFechada] = useState(() => dicaOculta(id));
  const [ativa, setAtiva] = useState(0);
  const trilhoRef = useRef(null);

  if (fechada || !dicas.length) return null;

  const fechar = () => { ocultarDica(id); setFechada(true); };

  const aoRolar = () => {
    const el = trilhoRef.current;
    if (!el) return;
    setAtiva(Math.round(el.scrollLeft / el.clientWidth));
  };

  const irPara = (i) => {
    const el = trilhoRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div
      className="relative mb-4 rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, var(--accent-soft), transparent 70%)',
        border: '1px solid rgba(var(--accent-rgb), 0.28)',
      }}
    >
      {/* fechar */}
      <button
        onClick={fechar}
        title="Entendi, pode fechar"
        className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-90"
        style={{ color: 'var(--txt-dim)' }}
      >
        <X size={15} strokeWidth={2} />
      </button>

      {/* trilho arrastável */}
      <div
        ref={trilhoRef}
        onScroll={aoRolar}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        {dicas.map((d, i) => (
          <div key={i} className="flex w-full shrink-0 snap-center items-start gap-3 p-3.5 pr-10">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
              style={{ background: 'rgba(var(--accent-rgb), 0.15)', border: '1px solid rgba(var(--accent-rgb), 0.3)' }}
              aria-hidden
            >
              🥷
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold leading-tight" style={{ color: 'var(--txt-strong)' }}>
                <span style={{ color: 'var(--accent)' }}>Dica do ninja · </span>{d.titulo}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: 'var(--txt)' }}>
                {d.texto}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* bolinhas de navegação (só se tiver mais de uma) */}
      {dicas.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-2.5">
          {dicas.map((_, i) => (
            <button
              key={i}
              onClick={() => irPara(i)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === ativa ? 16 : 5,
                background: i === ativa ? 'var(--accent)' : 'rgba(var(--accent-rgb),0.35)',
              }}
              aria-label={`Dica ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
