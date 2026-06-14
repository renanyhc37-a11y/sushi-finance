import { useState, useEffect, createContext, useContext } from 'react';

// ──────────────────────────────────────────────────────────────
//  Personalização da interface (estilo Windows)
//  - fundo:     'aurora' | 'estrelas' | 'galaxia' | 'terra' | 'liso'
//  - animacao:  true | false   (movimento suave / estrelas cadentes)
//  - densidade: 'confortavel' | 'compacto'
//  Persistido no navegador e aplicado como atributos no <html>,
//  para o CSS reagir (data-fundo / data-densidade / data-animacao).
// ──────────────────────────────────────────────────────────────

const PADRAO = { fundo: 'aurora', animacao: true, densidade: 'confortavel' };

function carregar() {
  try {
    const raw = localStorage.getItem('personalizacao');
    if (raw) return { ...PADRAO, ...JSON.parse(raw) };
  } catch {}
  return PADRAO;
}

function aplicar(p) {
  const el = document.documentElement;
  el.setAttribute('data-fundo', p.fundo);
  el.setAttribute('data-densidade', p.densidade);
  el.setAttribute('data-animacao', p.animacao ? 'on' : 'off');
}

const PersonalizacaoCtx = createContext(null);

export function PersonalizacaoProvider({ children }) {
  const [config, setConfig] = useState(carregar);

  useEffect(() => {
    aplicar(config);
    localStorage.setItem('personalizacao', JSON.stringify(config));
  }, [config]);

  const set = (chave, valor) => setConfig(c => ({ ...c, [chave]: valor }));

  return (
    <PersonalizacaoCtx.Provider value={{ config, set }}>
      {children}
    </PersonalizacaoCtx.Provider>
  );
}

export function usePersonalizacao() {
  const ctx = useContext(PersonalizacaoCtx);
  if (!ctx) return { config: PADRAO, set: () => {} };
  return ctx;
}
